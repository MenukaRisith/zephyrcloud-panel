import { Injectable, Logger } from '@nestjs/common';
import { CoolifyClient } from './coolify.client';

// --- Interfaces ---

interface CoolifyApplication {
  uuid: string;
  name?: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
  [key: string]: unknown;
}

interface CoolifyDatabase {
  uuid: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

interface CoolifyProject {
  uuid: string;
  name?: string;
  [key: string]: unknown;
}

type CoolifyEnvironment = { uuid: string; name: string };
type CoolifyServer = { uuid: string; name?: string };

type CoolifyDestinationLike = {
  uuid: string;
  name?: string;
  server_uuid?: string;
  [key: string]: unknown;
};

type CoolifyGithubApp = {
  id: number;
  uuid: string;
  name?: string;
  is_public?: boolean;
  [key: string]: unknown;
};

type GithubAppListItem = {
  id: number;
  uuid: string;
  name: string;
};

type ResolvedGithubApp = GithubAppListItem & {
  is_public?: boolean;
};

type GithubRepoListItem = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
};

export type ManagedDatabaseEngine = 'mariadb' | 'mysql' | 'postgresql';

export type CoolifyEnvVar = {
  uuid?: string;
  key: string;
  value: string;
  is_preview?: boolean;
  is_buildtime?: boolean;
  is_build_time?: boolean;
  is_literal?: boolean;
  is_multiline?: boolean;
  is_shown_once?: boolean;
};

type CoolifyEnvInput = {
  key: string;
  value: string;
  is_preview?: boolean;
  is_buildtime?: boolean;
  is_build_time?: boolean;
  is_literal?: boolean;
  is_multiline?: boolean;
  is_shown_once?: boolean;
};

type UpdateApplicationCommandsInput = {
  install_command?: string | null;
  build_command?: string | null;
  start_command?: string | null;
};

type CreatePrivateKeyInput = {
  name: string;
  description?: string;
  private_key: string;
  is_git_related?: boolean;
};

type CreateProjectConfig = {
  name: string;
  type: string;
  repo_url?: string;
  repo_branch?: string;
  auto_deploy?: boolean;
  cpu_limit: number;
  memory_mb: number;
  build_command?: string;
  start_command?: string;
  install_command?: string;
  github_app_id?: string | number;
  private_key_uuid?: string;
  db?: CoolifyDbDetails;
};

export type CoolifyDeployment = {
  deployment_uuid: string;
  uuid?: string;
  status: string;
  commit?: string;
  commit_sha?: string;
  commit_message?: string;
  is_webhook?: boolean;
  updated_at: string;
  created_at: string;
};

export type CoolifyResourceType = 'application' | 'service' | 'database';

export type CoolifyDbDetails = {
  engine: 'mariadb' | 'mysql';
  host: string;
  port: number;
  db_name: string;
  username: string;
  password: string;
  root_password?: string;
};

export type CoolifyApplicationSummary = {
  uuid: string;
  name: string;
  status?: string;
  fqdn?: string;
  base_directory?: string;
};

export type CoolifyDatabaseSummary = {
  uuid: string;
  name: string;
  status?: string;
};

export type CoolifyProjectSummary = {
  uuid: string;
  name: string;
};

type CoolifyDatabaseResource = CoolifyDatabase & {
  destination?: CoolifyDestinationLike & {
    server?: {
      ip?: string;
      [key: string]: unknown;
    };
  };
  external_db_url?: string | null;
  internal_db_url?: string | null;
  is_public?: boolean;
  public_port?: number | null;
  ssl_mode?: string | null;
  mariadb_database?: string | null;
  mariadb_password?: string | null;
  mariadb_user?: string | null;
  mysql_database?: string | null;
  mysql_password?: string | null;
  mysql_user?: string | null;
  postgres_db?: string | null;
  postgres_password?: string | null;
  postgres_user?: string | null;
};

export type CoolifyManagedDatabase = {
  projectId: string;
  databaseId: string;
  engine: ManagedDatabaseEngine;
  host: string;
  port: number;
  dbName: string;
  username: string;
  password: string;
  externalUrl: string;
  publicPort?: number;
  sslMode?: string;
};

@Injectable()
export class CoolifyService {
  private readonly logger = new Logger(CoolifyService.name);

  private readonly destinationOverrideUuid = (
    process.env.COOLIFY_DESTINATION_UUID ?? ''
  ).trim();

  private readonly serverOverrideUuid = (
    process.env.COOLIFY_SERVER_UUID ?? ''
  ).trim();

  public constructor(private readonly client: CoolifyClient) {}

  // --- Health ---
  async health(): Promise<{ ok: boolean; tried: string[]; error?: string }> {
    const tried = ['/api/v1/projects'];
    try {
      await this.client.get(tried[0]);
      return { ok: true, tried };
    } catch (error: unknown) {
      return { ok: false, tried, error: this.formatError(error) };
    }
  }

  // --- Project Creation ---

  async createProject(config: CreateProjectConfig): Promise<{
    projectId: string;
    resourceId: string;
    serverUuid: string;
    destinationUuid: string;
    resourceType: CoolifyResourceType;
    dbHost?: string;
    dbPassword?: string;
    dbUser?: string;
    dbName?: string;
  }> {
    this.logger.log(`[createProject] start name="${config.name}"`);

    const servers = await this.client.get<CoolifyServer[]>('/api/v1/servers');
    const serverUuid = this.serverOverrideUuid || servers?.[0]?.uuid;
    if (!serverUuid) throw new Error('No Coolify server found.');

    const destination = this.resolveDestination(serverUuid);
    if (!destination)
      throw new Error('No Coolify destination UUID configured.');

    const project = await this.client.post<CoolifyProject>('/api/v1/projects', {
      name: config.name,
      description: `Project for ${config.name}`,
    });

    const projectDetails = await this.client.get<{
      environments: CoolifyEnvironment[];
    }>(`/api/v1/projects/${project.uuid}`);
    const environment = projectDetails?.environments?.[0];
    if (!environment)
      throw new Error(`No environment found for project ${project.uuid}`);

    let resourceUuid: string;
    let resourceType: CoolifyResourceType;
    let dbHostUsed: string | undefined;
    let dbPasswordUsed: string | undefined;
    let dbUserUsed: string | undefined;
    let dbNameUsed: string | undefined;

    if (config.type === 'wordpress') {
      resourceType = 'application';
      const bundle = await this.createWordpressBundle({
        name: config.name,
        projectUuid: project.uuid,
        serverUuid,
        environment,
        destinationUuid: destination.uuid,
        db: config.db,
      });
      resourceUuid = bundle.appUuid;
      dbHostUsed = bundle.dbHost;
      dbPasswordUsed = bundle.dbPassword;
      dbUserUsed = bundle.dbUser;
      dbNameUsed = bundle.dbName;
    } else {
      resourceType = 'application';
      resourceUuid = await this.createApplication({
        config,
        projectUuid: project.uuid,
        serverUuid,
        environment,
        destinationUuid: destination.uuid,
      });
    }

    return {
      projectId: project.uuid,
      resourceId: resourceUuid,
      serverUuid,
      destinationUuid: destination.uuid,
      resourceType,
      dbHost: dbHostUsed,
      dbPassword: dbPasswordUsed,
      dbUser: dbUserUsed,
      dbName: dbNameUsed,
    };
  }

  // --- Environment Variables Management ---

  async getEnvs(resourceUuid: string): Promise<CoolifyEnvVar[]> {
    try {
      const envs = await this.client.get<unknown>(
        `/api/v1/applications/${resourceUuid}/envs`,
      );
      if (!Array.isArray(envs)) return [];
      return envs
        .map((env) => this.toEnvVar(env))
        .filter((env): env is CoolifyEnvVar => env !== null);
    } catch (error: unknown) {
      this.logger.error(`[getEnvs] Failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async getApplications(): Promise<CoolifyApplicationSummary[]> {
    try {
      const apps = await this.client.get<CoolifyApplication[]>(
        '/api/v1/applications',
      );
      if (!Array.isArray(apps)) return [];
      const results: CoolifyApplicationSummary[] = [];
      for (const app of apps) {
        const uuid = this.toStringValue(app?.uuid);
        if (!uuid) continue;
        results.push({
          uuid,
          name: this.toStringValue(app?.name) ?? uuid,
          status: this.toStringValue(app?.status) ?? undefined,
          fqdn: this.toStringValue(app?.fqdn) ?? undefined,
          base_directory: this.toStringValue(app?.base_directory) ?? undefined,
        });
      }
      return results;
    } catch (error: unknown) {
      this.logger.error(`[getApplications] Failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async getDatabases(): Promise<CoolifyDatabaseSummary[]> {
    try {
      const databases = await this.client.get<CoolifyDatabase[]>(
        '/api/v1/databases',
      );
      if (!Array.isArray(databases)) return [];
      return databases
        .map((db) => {
          const uuid = this.toStringValue(db?.uuid);
          if (!uuid) return null;
          return {
            uuid,
            name: this.toStringValue(db?.name) ?? uuid,
            status: this.toStringValue(db?.status) ?? undefined,
          };
        })
        .filter((db): db is CoolifyDatabaseSummary => db !== null);
    } catch (error: unknown) {
      this.logger.error(`[getDatabases] Failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async getProjects(): Promise<CoolifyProjectSummary[]> {
    try {
      const projects = await this.client.get<CoolifyProject[]>(
        '/api/v1/projects',
      );
      if (!Array.isArray(projects)) return [];
      return projects
        .map((project) => {
          const uuid = this.toStringValue(project?.uuid);
          if (!uuid) return null;
          return {
            uuid,
            name: this.toStringValue(project?.name) ?? uuid,
          };
        })
        .filter((project): project is CoolifyProjectSummary => project !== null);
    } catch (error: unknown) {
      this.logger.error(`[getProjects] Failed: ${this.formatError(error)}`);
      return [];
    }
  }

  async createEnv(resourceUuid: string, data: CoolifyEnvInput) {
    const payload = this.stripUndefined({
      key: data.key,
      value: data.value,
      is_preview: data.is_preview,
      is_buildtime: data.is_buildtime ?? data.is_build_time,
      is_literal: data.is_literal ?? true,
      is_multiline: data.is_multiline,
      is_shown_once: data.is_shown_once,
    });

    try {
      const envs = await this.getEnvs(resourceUuid);
      const exists = envs.find((env) => env.key === data.key);

      if (exists) {
        await this.client.patch(
          `/api/v1/applications/${resourceUuid}/envs`,
          payload,
        );
        return { success: true, updated: true };
      }

      await this.client.post(
        `/api/v1/applications/${resourceUuid}/envs`,
        payload,
      );
      return { success: true, created: true };
    } catch (error: unknown) {
      throw new Error(
        `Failed to create/update env: ${this.formatError(error)}`,
      );
    }
  }

  async deleteEnv(resourceUuid: string, key: string) {
    try {
      const envs = await this.getEnvs(resourceUuid);
      const targets = envs.filter((env) => env.key === key && env.uuid);

      if (!targets.length) return { success: false, message: 'Env not found' };

      await Promise.all(
        targets.map((target) =>
          this.client.delete(
            `/api/v1/applications/${resourceUuid}/envs/${target.uuid}`,
          ),
        ),
      );
      return { success: true, deleted: targets.length };
    } catch (error: unknown) {
      throw new Error(`Failed to delete env: ${this.formatError(error)}`);
    }
  }

  async updateApplicationCommands(
    uuid: string,
    input: UpdateApplicationCommandsInput,
  ): Promise<void> {
    if (!uuid) throw new Error('Resource UUID missing');
    const payload = this.stripUndefined({
      install_command: input.install_command ?? undefined,
      build_command: input.build_command ?? undefined,
      start_command: input.start_command ?? undefined,
    });
    if (!Object.keys(payload).length) return;

    try {
      await this.client.patch(`/api/v1/applications/${uuid}`, payload);
    } catch (error: unknown) {
      this.logger.warn(
        `[updateApplicationCommands] Failed to update commands for ${uuid}: ${this.formatError(error)}`,
      );
    }
  }

  async createPrivateKey(
    input: CreatePrivateKeyInput,
  ): Promise<{ uuid: string }> {
    const payload = this.stripUndefined({
      name: input.name,
      description: input.description,
      private_key: input.private_key,
      is_git_related: input.is_git_related ?? true,
    });

    return this.client.post<{ uuid: string }>('/api/v1/security/keys', payload);
  }

  async deletePrivateKey(keyUuid: string): Promise<void> {
    await this.client.delete(`/api/v1/security/keys/${keyUuid}`);
  }

  async deleteApplication(
    uuid: string,
    options?: {
      delete_configurations?: boolean;
      delete_volumes?: boolean;
      docker_cleanup?: boolean;
      delete_connected_networks?: boolean;
    },
  ): Promise<void> {
    if (!uuid) throw new Error('Application UUID missing');
    const query = this.buildQueryString({
      delete_configurations: options?.delete_configurations ?? true,
      delete_volumes: options?.delete_volumes ?? true,
      docker_cleanup: options?.docker_cleanup ?? true,
      delete_connected_networks: options?.delete_connected_networks ?? true,
    });
    await this.client.delete(`/api/v1/applications/${uuid}${query}`);
  }

  async deleteDatabase(uuid: string): Promise<void> {
    if (!uuid) throw new Error('Database UUID missing');
    await this.client.delete(`/api/v1/databases/${uuid}`);
  }

  async deleteProject(uuid: string): Promise<void> {
    if (!uuid) throw new Error('Project UUID missing');
    await this.client.delete(`/api/v1/projects/${uuid}`);
  }

  // --- GitHub Helpers ---

  async getGithubApps(): Promise<GithubAppListItem[]> {
    try {
      const apps = await this.client.get<CoolifyGithubApp[]>(
        '/api/v1/github-apps',
      );
      return (Array.isArray(apps) ? apps : [])
        .filter((a) => typeof a?.id === 'number' && typeof a?.uuid === 'string')
        .map((a) => ({
          id: a.id,
          uuid: a.uuid,
          name: String(a.name ?? `GitHub App ${a.id}`),
        }));
    } catch (error) {
      this.logger.error(`[getGithubApps] failed: ${this.formatError(error)}`);
      throw error;
    }
  }

  async resolveGithubAppUuid(appRef: string | number): Promise<string> {
    const app = await this.resolveGithubAppRecord(appRef);
    return app.uuid;
  }

  async getGithubRepos(
    appRef: string | number,
    page = 1,
    perPage = 100,
  ): Promise<GithubRepoListItem[]> {
    const githubAppId = await this.resolveGithubAppId(appRef);
    const url = `/api/v1/github-apps/${githubAppId}/repositories?page=${page}&limit=${perPage}`;
    try {
      const res = await this.client.get<unknown>(url);
      return this.normalizeGithubReposResponse(res);
    } catch {
      const fallback = `/api/v1/github-apps/${githubAppId}/repositories`;
      const res = await this.client.get<unknown>(fallback);
      return this.normalizeGithubReposResponse(res);
    }
  }

  async getGithubBranches(
    appRef: string | number,
    owner: string,
    repo: string,
  ): Promise<unknown> {
    const githubAppId = await this.resolveGithubAppId(appRef);
    const url = `/api/v1/github-apps/${githubAppId}/repositories/${owner}/${repo}/branches`;
    return await this.client.get<unknown>(url);
  }

  // --- Deployments & Status ---

  async getDeployments(
    resourceUuid: string,
    resourceType: CoolifyResourceType,
  ): Promise<CoolifyDeployment[]> {
    if (!resourceUuid) return [];
    if (resourceType === 'service') return [];

    const url = `/api/v1/deployments/applications/${resourceUuid}`;
    try {
      const res = await this.client.get<unknown>(url);
      const list = Array.isArray(res)
        ? res
        : this.getArrayProperty(res, 'deployments');
      return list
        .map((item) => this.toDeployment(item))
        .filter(
          (deployment): deployment is CoolifyDeployment => deployment !== null,
        );
    } catch {
      return [];
    }
  }

  /**
   * Fetches the direct resource object to get the real-time status.
   * Uses specific endpoints (applications/databases/services) instead of server scanning.
   */
  async getResourceStatus(args: {
    resourceId: string;
    resourceType: CoolifyResourceType;
  }): Promise<{ found: boolean; status?: string; raw?: unknown }> {
    const { resourceId, resourceType } = args;

    let url = '';
    switch (resourceType) {
      case 'database':
        url = `/api/v1/databases/${resourceId}`;
        break;
      case 'service':
        url = `/api/v1/services/${resourceId}`;
        break;
      default: // application
        url = `/api/v1/applications/${resourceId}`;
        break;
    }

    try {
      const resource = await this.client.get<unknown>(url);
      if (!this.isRecord(resource)) {
        return { found: false };
      }

      const resourceUuid = this.toStringValue(resource.uuid);
      if (!resourceUuid) {
        return { found: false };
      }

      const statusValue = this.toStringValue(resource.status) ?? '';
      const stateValue = this.toStringValue(resource.state) ?? '';
      const combined = [stateValue, statusValue].filter(Boolean).join(' ');
      const status = String(combined).trim();
      return { found: true, status, raw: resource };
    } catch {
      return { found: false };
    }
  }

  async getApplicationDomains(uuid: string): Promise<string[]> {
    if (!uuid) throw new Error('Application UUID missing');
    try {
      const resource = await this.client.get<unknown>(
        `/api/v1/applications/${uuid}`,
      );
      if (!this.isRecord(resource)) return [];
      const fqdn =
        this.toStringValue(resource.coolify_fqdn) ??
        this.toStringValue(resource.fqdn) ??
        '';
      return fqdn
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    } catch {
      return [];
    }
  }

  // Kept for backward compatibility if needed, but getResourceStatus is preferred
  async getLiveResourceStatus(args: {
    serverUuid: string;
    resourceId: string;
  }): Promise<{ found: boolean; status?: string; raw?: unknown }> {
    // Forward to the new method defaulting to application if not specified
    return this.getResourceStatus({
      resourceId: args.resourceId,
      resourceType: 'application',
    });
  }

  // --- Add Domain ---

  async addDomain(
    type: CoolifyResourceType,
    uuid: string,
    domainUrl: string,
  ): Promise<void> {
    if (!uuid) throw new Error('Resource UUID missing');
    if (type === 'service' || type === 'database') {
      this.logger.warn(
        `[addDomain] Skipping domain sync for ${type} ${uuid} (manual config required).`,
      );
      return;
    }

    const endpoint = `/api/v1/applications/${uuid}`;

    try {
      const resource = await this.client.get<unknown>(endpoint);
      if (!this.isRecord(resource)) {
        this.logger.warn(
          `[addDomain] Resource ${uuid} response is not an object.`,
        );
        return;
      }
      const currentFqdn = this.toStringValue(resource.fqdn) ?? '';

      const domains = currentFqdn
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      if (domains.includes(domainUrl)) {
        return;
      }

      domains.push(domainUrl);
      const newFqdn = domains.join(',');

      this.logger.log(`[addDomain] Updating FQDN for ${uuid} to: ${newFqdn}`);

      const buildPack = this.toStringValue(resource.build_pack);
      const isDockerImage = buildPack === 'dockerimage' || !buildPack;

      if (isDockerImage) {
        this.logger.log(
          `[addDomain] Docker Image detected. Setting FQDN via Environment Variable.`,
        );
        await this.setEnv(uuid, 'FQDN', newFqdn);
        await this.deployResource('application', uuid);
      } else {
        try {
          await this.client.patch(endpoint, { fqdn: newFqdn });
        } catch (patchError: unknown) {
          if (this.getHttpStatus(patchError) === 422) {
            this.logger.warn(
              `[addDomain] PATCH not supported (422). Falling back to FQDN env var.`,
            );
            await this.setEnv(uuid, 'FQDN', newFqdn);
            await this.deployResource('application', uuid);
          } else {
            throw patchError;
          }
        }
      }
    } catch (error: unknown) {
      const message = this.formatError(error);
      this.logger.error(`[addDomain] Failed to sync to Coolify: ${message}`);
      throw new Error(message);
    }
  }

  async deployResource(
    type: string,
    uuid: string,
    options?: { force?: boolean; instantDeploy?: boolean },
  ) {
    if (!uuid?.trim()) throw new Error('Missing resourceId');
    const force = options?.force ?? false;
    const instantDeploy = options?.instantDeploy ?? false;
    const params = new URLSearchParams({
      uuid,
      force: String(force),
      instant_deploy: String(instantDeploy),
    });
    this.logger.debug(
      `[deployResource] type=${type} uuid=${uuid} force=${force} instant_deploy=${instantDeploy}`,
    );
    await this.client.get(`/api/v1/deploy?${params.toString()}`);
  }

  async restartResource(type: string, uuid: string) {
    if (!uuid?.trim()) throw new Error('Missing resourceId');
    if (type === 'service') {
      try {
        await this.client.get(`/api/v1/services/${uuid}/restart`);
      } catch {
        await this.client.get(`/api/v1/services/${uuid}/deploy`);
      }
    } else if (type === 'database') {
      await this.client.get(`/api/v1/databases/${uuid}/restart`);
    } else {
      await this.client.get(`/api/v1/applications/${uuid}/restart`);
    }
  }

  async startResource(type: string, uuid: string) {
    if (!uuid?.trim()) throw new Error('Missing resourceId');
    if (type === 'service') {
      try {
        await this.client.get(`/api/v1/services/${uuid}/start`);
      } catch {
        await this.client.get(`/api/v1/services/${uuid}/deploy`);
      }
      return;
    }
    if (type === 'database') {
      try {
        await this.client.get(`/api/v1/databases/${uuid}/start`);
      } catch {
        await this.client.get(`/api/v1/deploy?uuid=${uuid}&force=false`);
      }
      return;
    }
    await this.client.get(`/api/v1/applications/${uuid}/start`);
  }

  async stopResource(type: string, uuid: string) {
    if (!uuid?.trim()) throw new Error('Missing resourceId');
    if (type === 'service') {
      await this.client.get(`/api/v1/services/${uuid}/stop`);
      return;
    }
    if (type === 'database') {
      await this.client.get(`/api/v1/databases/${uuid}/stop`);
      return;
    }
    await this.client.get(`/api/v1/applications/${uuid}/stop`);
  }

  async createPublicDatabase(args: {
    name: string;
    engine: ManagedDatabaseEngine;
    dbName: string;
    username: string;
    password: string;
    rootPassword?: string;
  }): Promise<CoolifyManagedDatabase> {
    const servers = await this.client.get<CoolifyServer[]>('/api/v1/servers');
    const serverUuid = this.serverOverrideUuid || servers?.[0]?.uuid;
    if (!serverUuid) throw new Error('No Coolify server found.');

    const destination = this.resolveDestination(serverUuid);
    if (!destination) {
      throw new Error('No Coolify destination UUID configured.');
    }

    const project = await this.client.post<CoolifyProject>('/api/v1/projects', {
      name: args.name,
      description: `Database project for ${args.name}`,
    });

    const projectDetails = await this.client.get<{
      environments: CoolifyEnvironment[];
    }>(`/api/v1/projects/${project.uuid}`);
    const environment = projectDetails?.environments?.[0];
    if (!environment) {
      throw new Error(`No environment found for project ${project.uuid}`);
    }

    const endpoint = `/api/v1/databases/${args.engine}`;
    const basePayload = {
      project_uuid: project.uuid,
      server_uuid: serverUuid,
      environment_uuid: environment.uuid,
      destination_uuid: destination.uuid,
      name: args.name,
      instant_deploy: true,
      is_public: true,
      image: this.getDatabaseImage(args.engine),
    };

    let payload: Record<string, unknown>;
    if (args.engine === 'mariadb') {
      payload = {
        ...basePayload,
        mariadb_root_password: args.rootPassword ?? args.password,
        mariadb_user: args.username,
        mariadb_password: args.password,
        mariadb_database: args.dbName,
      };
    } else if (args.engine === 'mysql') {
      payload = {
        ...basePayload,
        mysql_root_password: args.rootPassword ?? args.password,
        mysql_user: args.username,
        mysql_password: args.password,
        mysql_database: args.dbName,
      };
    } else {
      payload = {
        ...basePayload,
        postgres_user: args.username,
        postgres_password: args.password,
        postgres_db: args.dbName,
      };
    }

    const created = await this.client.post<CoolifyDatabase>(endpoint, payload);
    const resource = await this.waitForPublicDatabase(created.uuid);
    const details = this.extractManagedDatabase(resource, args.engine);

    return {
      projectId: project.uuid,
      databaseId: created.uuid,
      ...details,
    };
  }

  async getDatabase(uuid: string): Promise<CoolifyDatabaseResource> {
    return this.client.get<CoolifyDatabaseResource>(`/api/v1/databases/${uuid}`);
  }

  async getLogs(type: string, uuid: string, lines = 200): Promise<string> {
    if (!uuid?.trim()) throw new Error('Missing resourceId');
    const boundedLines = Math.min(5000, Math.max(10, Math.trunc(lines)));
    const query = `lines=${boundedLines}`;
    const url =
      type === 'service'
        ? `/api/v1/services/${uuid}/logs?${query}`
        : `/api/v1/applications/${uuid}/logs?${query}`;
    try {
      const res = await this.client.get<unknown>(url);
      if (this.isRecord(res)) {
        const logs = this.toStringValue(res.logs);
        const message = this.toStringValue(res.message);
        if (typeof logs === 'string') return logs;
        if (typeof message === 'string') return message;
      }
      return '';
    } catch {
      return 'No logs available.';
    }
  }

  // --- Internal Helpers ---

  private async createApplication(args: {
    config: CreateProjectConfig;
    projectUuid: string;
    serverUuid: string;
    environment: CoolifyEnvironment;
    destinationUuid: string;
  }): Promise<string> {
    const { config, projectUuid, serverUuid, environment, destinationUuid } =
      args;
    const hasGithubApp = this.hasGithubAppSelection(config.github_app_id);
    const hasPrivateDeployKey = this.hasPrivateDeployKeySelection(
      config.private_key_uuid,
    );
    const exposedPort = this.getExposedPortForType(config.type);
    const basePayload = this.stripUndefined({
      project_uuid: projectUuid,
      server_uuid: serverUuid,
      environment_uuid: environment.uuid,
      environment_name: environment.name,
      destination_uuid: destinationUuid,
      name: config.name,
      ports_exposes: exposedPort,
      limits_memory: `${config.memory_mb}M`,
      limits_cpus: String(config.cpu_limit),
      install_command: config.install_command,
      build_command: config.build_command,
      start_command: config.start_command,
    });

    let appUuid = '';

    if (hasGithubApp) {
      const endpoint = '/api/v1/applications/private-github-app';
      const payload = this.stripUndefined({
        ...basePayload,
        build_pack: config.type === 'static' ? 'static' : 'nixpacks',
        github_app_uuid: String(config.github_app_id),
        git_repository: config.repo_url,
        git_branch: config.repo_branch ?? 'main',
        is_static: config.type === 'static',
        instant_deploy: true,
      });
      const app = await this.client.post<CoolifyApplication>(endpoint, payload);
      appUuid = app.uuid;
    } else if (hasPrivateDeployKey) {
      const endpoint = '/api/v1/applications/private-deploy-key';
      const payload = this.stripUndefined({
        ...basePayload,
        build_pack: config.type === 'static' ? 'static' : 'nixpacks',
        private_key_uuid: String(config.private_key_uuid),
        git_repository: config.repo_url,
        git_branch: config.repo_branch ?? 'main',
        is_static: config.type === 'static',
        instant_deploy: true,
      });
      const app = await this.client.post<CoolifyApplication>(endpoint, payload);
      appUuid = app.uuid;
    } else if (config.repo_url) {
      const endpoint = '/api/v1/applications/public';
      const payload = this.stripUndefined({
        ...basePayload,
        build_pack: config.type === 'static' ? 'static' : 'nixpacks',
        git_repository: config.repo_url,
        git_branch: config.repo_branch ?? 'main',
        is_static: config.type === 'static',
        instant_deploy: true,
      });
      const app = await this.client.post<CoolifyApplication>(endpoint, payload);
      appUuid = app.uuid;
    } else {
      const endpoint = '/api/v1/applications/dockerimage';
      const payload = this.stripUndefined({
        ...basePayload,
        docker_registry_image_name: this.getDockerImageForType(config.type),
      });
      const app = await this.client.post<CoolifyApplication>(endpoint, payload);
      appUuid = app.uuid;
    }

    if (!hasGithubApp && !hasPrivateDeployKey && !config.repo_url) {
      this.deployResource('application', appUuid).catch(() => {});
    }

    if (config.type === 'node' || config.type === 'python') {
      await this.setEnv(appUuid, 'PORT', exposedPort);
    }

    return appUuid;
  }

  private async createDatabase(args: {
    name: string;
    projectUuid: string;
    serverUuid: string;
    environment: CoolifyEnvironment;
    destinationUuid: string;
    image: string;
    password?: string;
  }): Promise<{ uuid: string; password?: string }> {
    const {
      name,
      projectUuid,
      serverUuid,
      environment,
      destinationUuid,
      image,
      password,
    } = args;

    const endpoint = '/api/v1/databases/mariadb';

    const payload = {
      project_uuid: projectUuid,
      server_uuid: serverUuid,
      environment_uuid: environment.uuid,
      destination_uuid: destinationUuid,
      name: name,
      image: image,
      mariadb_root_password: password,
      mariadb_database: 'wordpress',
      instant_deploy: true,
    };

    const db = await this.client.post<CoolifyDatabase>(endpoint, payload);

    return { uuid: db.uuid, password: password };
  }

  private async createWordpressBundle(args: {
    name: string;
    projectUuid: string;
    serverUuid: string;
    environment: CoolifyEnvironment;
    destinationUuid: string;
    db?: CoolifyDbDetails;
  }): Promise<{
    appUuid: string;
    dbHost: string;
    dbPassword?: string;
    dbUser?: string;
    dbName?: string;
  }> {
    const { name, projectUuid, serverUuid, environment, destinationUuid, db } =
      args;
    if (!db) throw new Error('Database config required for WordPress bundle');

    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dbName = `${safeName}-db`;
    const appName = `${safeName}-app`;
    const wpVolumeName = `${safeName}-wp-data`;

    const dbRes = await this.createDatabase({
      name: dbName,
      projectUuid,
      serverUuid,
      environment,
      destinationUuid,
      image: 'mariadb:11',
      password: db.root_password,
    });

    this.logger.log(
      `[createWordpressBundle] Deploying Native Database ${dbName}...`,
    );

    const wpAppPayload = {
      project_uuid: projectUuid,
      server_uuid: serverUuid,
      environment_uuid: environment.uuid,
      destination_uuid: destinationUuid,
      name: appName,
      docker_registry_image_name: 'wordpress:latest',
      ports_exposes: '80',
      limits_memory: '512M',
      limits_cpus: '1',
      custom_docker_run_options: `--mount type=volume,source=${wpVolumeName},target=/var/www/html`,
    };
    const wpApp = await this.client.post<CoolifyApplication>(
      '/api/v1/applications/dockerimage',
      wpAppPayload,
    );

    await this.setEnv(wpApp.uuid, 'WORDPRESS_DB_USER', 'root');
    await this.setEnv(
      wpApp.uuid,
      'WORDPRESS_DB_PASSWORD',
      dbRes.password || 'root',
    );
    await this.setEnv(wpApp.uuid, 'WORDPRESS_DB_NAME', 'wordpress');

    const finalDbHost = `${dbRes.uuid}:3306`;
    await this.setEnv(wpApp.uuid, 'WORDPRESS_DB_HOST', finalDbHost);
    await this.setEnv(wpApp.uuid, 'PORT', '80');

    const sslFix = `if (isset($$_SERVER["HTTP_X_FORWARDED_PROTO"]) && strpos($$_SERVER["HTTP_X_FORWARDED_PROTO"], "https") !== false) { $$_SERVER["HTTPS"] = "on"; }`;
    await this.setEnv(wpApp.uuid, 'WORDPRESS_CONFIG_EXTRA', sslFix);

    this.logger.log(
      `[createWordpressBundle] Deploying WordPress ${appName}...`,
    );
    this.client
      .get(`/api/v1/deploy?uuid=${wpApp.uuid}`)
      .catch((e) => this.logger.warn('WP deploy trigger failed', e));

    return {
      appUuid: wpApp.uuid,
      dbHost: finalDbHost,
      dbPassword: dbRes.password,
      dbUser: 'root',
      dbName: 'wordpress',
    };
  }

  private async setEnv(appUuid: string, key: string, value: string) {
    try {
      const envs = await this.client.get<unknown>(
        `/api/v1/applications/${appUuid}/envs`,
      );
      const exists = Array.isArray(envs)
        ? envs
            .map((env) => this.toEnvVar(env))
            .find(
              (env): env is CoolifyEnvVar => env !== null && env.key === key,
            )
        : undefined;

      if (exists) {
        await this.client.patch(`/api/v1/applications/${appUuid}/envs`, {
          key,
          value,
        });
      } else {
        await this.client.post(`/api/v1/applications/${appUuid}/envs`, {
          key,
          value,
          is_literal: true,
        });
      }
    } catch (error: unknown) {
      if (this.getHttpStatus(error) === 422) {
        try {
          await this.client.post(`/api/v1/applications/${appUuid}/envs`, {
            key,
            value,
          });
          return;
        } catch {
          // ignore and continue with common warning path
        }
      }
      this.logger.warn(`Failed to set env ${key}: ${this.formatError(error)}`);
    }
  }

  private normalizeGithubReposResponse(res: unknown): GithubRepoListItem[] {
    const list = Array.isArray(res)
      ? res
      : this.getArrayProperty(res, 'repositories').length > 0
        ? this.getArrayProperty(res, 'repositories')
        : this.getArrayProperty(res, 'data');

    return list
      .map((repo) => this.toGithubRepo(repo))
      .filter((repo): repo is GithubRepoListItem => repo !== null);
  }

  private async resolveGithubAppId(appRef: string | number): Promise<number> {
    const app = await this.resolveGithubAppRecord(appRef);
    return app.id;
  }

  private async resolveGithubAppRecord(
    appRef: string | number,
  ): Promise<ResolvedGithubApp> {
    const apps = await this.client.get<CoolifyGithubApp[]>(
      '/api/v1/github-apps',
    );
    const raw = String(appRef).trim();

    const match = apps.find((app) => {
      if (app.uuid === raw) return true;
      return Number.isFinite(Number(raw)) && app.id === Number(raw);
    });

    if (!match?.uuid || typeof match.id !== 'number') {
      throw new Error(`Cannot resolve GitHub App reference ${raw}`);
    }

    return {
      id: match.id,
      uuid: match.uuid,
      name: String(match.name ?? `GitHub App ${match.id}`),
      is_public:
        typeof match.is_public === 'boolean' ? match.is_public : undefined,
    };
  }

  private resolveDestination(
    serverUuid: string,
  ): CoolifyDestinationLike | null {
    if (!this.destinationOverrideUuid) return null;
    return {
      uuid: this.destinationOverrideUuid,
      name: 'override',
      server_uuid: serverUuid,
    };
  }

  private stripUndefined<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  private getDatabaseImage(engine: ManagedDatabaseEngine): string {
    if (engine === 'postgresql') return 'postgres:17-alpine';
    if (engine === 'mysql') return 'mysql:8';
    return 'mariadb:11';
  }

  private async waitForPublicDatabase(
    uuid: string,
  ): Promise<CoolifyDatabaseResource> {
    const attempts = 8;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const resource = await this.getDatabase(uuid);
      if (
        typeof resource.external_db_url === 'string' &&
        resource.external_db_url.trim().length > 0
      ) {
        return resource;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }

    throw new Error(
      `Coolify database ${uuid} did not expose a public connection URL.`,
    );
  }

  private extractManagedDatabase(
    resource: CoolifyDatabaseResource,
    engine: ManagedDatabaseEngine,
  ): Omit<CoolifyManagedDatabase, 'projectId' | 'databaseId'> {
    const externalUrl = this.toStringValue(resource.external_db_url)?.trim();
    if (!externalUrl) {
      throw new Error('Coolify did not return an external database URL.');
    }

    const parsedUrl = new URL(externalUrl);
    const dbName =
      decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')) ||
      this.getDatabaseNameFromResource(resource, engine);
    const username =
      decodeURIComponent(parsedUrl.username) ||
      this.getDatabaseUsernameFromResource(resource, engine);
    const password =
      decodeURIComponent(parsedUrl.password) ||
      this.getDatabasePasswordFromResource(resource, engine);
    const port = parsedUrl.port
      ? Number(parsedUrl.port)
      : this.getDefaultDatabasePort(engine);

    return {
      engine,
      host: parsedUrl.hostname,
      port,
      dbName,
      username,
      password,
      externalUrl,
      publicPort:
        this.toNumberValue(resource.public_port) ?? (port > 0 ? port : undefined),
      sslMode: this.toStringValue(resource.ssl_mode) ?? undefined,
    };
  }

  private getDatabaseNameFromResource(
    resource: CoolifyDatabaseResource,
    engine: ManagedDatabaseEngine,
  ): string {
    if (engine === 'postgresql') {
      return this.toStringValue(resource.postgres_db) ?? 'postgres';
    }
    if (engine === 'mysql') {
      return this.toStringValue(resource.mysql_database) ?? 'mysql';
    }
    return this.toStringValue(resource.mariadb_database) ?? 'mariadb';
  }

  private getDatabaseUsernameFromResource(
    resource: CoolifyDatabaseResource,
    engine: ManagedDatabaseEngine,
  ): string {
    if (engine === 'postgresql') {
      return this.toStringValue(resource.postgres_user) ?? 'postgres';
    }
    if (engine === 'mysql') {
      return this.toStringValue(resource.mysql_user) ?? 'mysql';
    }
    return this.toStringValue(resource.mariadb_user) ?? 'mariadb';
  }

  private getDatabasePasswordFromResource(
    resource: CoolifyDatabaseResource,
    engine: ManagedDatabaseEngine,
  ): string {
    if (engine === 'postgresql') {
      return this.toStringValue(resource.postgres_password) ?? '';
    }
    if (engine === 'mysql') {
      return this.toStringValue(resource.mysql_password) ?? '';
    }
    return this.toStringValue(resource.mariadb_password) ?? '';
  }

  private getDefaultDatabasePort(engine: ManagedDatabaseEngine): number {
    if (engine === 'postgresql') return 5432;
    return 3306;
  }

  private getDockerImageForType(type: string): string {
    switch (type) {
      case 'wordpress':
        return 'wordpress:latest';
      case 'php':
        return 'php:8.2-apache';
      case 'node':
        return 'node:20-alpine';
      case 'python':
        return 'python:3.12-slim';
      default:
        return 'nginx:alpine';
    }
  }

  private hasGithubAppSelection(
    githubAppId: string | number | undefined,
  ): boolean {
    if (githubAppId === undefined || githubAppId === null) return false;
    const normalized = String(githubAppId).trim();
    return normalized !== '' && normalized !== '0';
  }

  private hasPrivateDeployKeySelection(
    privateKeyUuid: string | undefined,
  ): boolean {
    return typeof privateKeyUuid === 'string' && privateKeyUuid.trim() !== '';
  }

  private getExposedPortForType(type: string): string {
    if (type === 'node') return '3000';
    if (type === 'python') return '8000';
    return '80';
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (this.isRecord(error) && typeof error.message === 'string') {
      return error.message;
    }
    return String(error);
  }

  private getHttpStatus(error: unknown): number | undefined {
    if (!this.isRecord(error)) return undefined;
    const response = error.response;
    if (!this.isRecord(response)) return undefined;
    return typeof response.status === 'number' ? response.status : undefined;
  }

  private getArrayProperty(value: unknown, key: string): unknown[] {
    if (!this.isRecord(value)) return [];
    const candidate = value[key];
    return Array.isArray(candidate) ? candidate : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private buildQueryString(params: Record<string, boolean>): string {
    const entries = Object.entries(params).map(
      ([key, value]) => `${encodeURIComponent(key)}=${value ? 'true' : 'false'}`,
    );
    return entries.length ? `?${entries.join('&')}` : '';
  }

  private toStringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private toBooleanValue(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  private toNumberValue(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
  }

  private toEnvVar(value: unknown): CoolifyEnvVar | null {
    if (!this.isRecord(value)) return null;
    const key = this.toStringValue(value.key);
    if (!key) return null;

    return {
      uuid: this.toStringValue(value.uuid),
      key,
      value: this.toStringValue(value.value) ?? '',
      is_preview: this.toBooleanValue(value.is_preview),
      is_buildtime:
        this.toBooleanValue(value.is_buildtime) ??
        this.toBooleanValue(value.is_build_time),
      is_build_time: this.toBooleanValue(value.is_build_time),
      is_literal: this.toBooleanValue(value.is_literal),
      is_multiline: this.toBooleanValue(value.is_multiline),
      is_shown_once: this.toBooleanValue(value.is_shown_once),
    };
  }

  private toDeployment(value: unknown): CoolifyDeployment | null {
    if (!this.isRecord(value)) return null;

    const uuid = this.toStringValue(value.uuid);
    const deploymentUuid = this.toStringValue(value.deployment_uuid) ?? uuid;
    const status = this.toStringValue(value.status);
    const updatedAt = this.toStringValue(value.updated_at);
    const createdAt = this.toStringValue(value.created_at);

    if (!deploymentUuid || !status || !updatedAt || !createdAt) return null;

    return {
      deployment_uuid: deploymentUuid,
      uuid,
      status,
      commit: this.toStringValue(value.commit),
      commit_sha: this.toStringValue(value.commit_sha),
      commit_message: this.toStringValue(value.commit_message),
      is_webhook: this.toBooleanValue(value.is_webhook),
      updated_at: updatedAt,
      created_at: createdAt,
    };
  }

  private toGithubRepo(value: unknown): GithubRepoListItem | null {
    if (!this.isRecord(value)) return null;

    const id = this.toNumberValue(value.id);
    const name = this.toStringValue(value.name);
    const fullName = this.toStringValue(value.full_name);
    const htmlUrl = this.toStringValue(value.html_url);

    if (id === undefined || !name || !fullName || !htmlUrl) {
      return null;
    }

    return {
      id,
      name,
      full_name: fullName,
      html_url: htmlUrl,
      default_branch: this.toStringValue(value.default_branch) ?? 'main',
    };
  }
}
