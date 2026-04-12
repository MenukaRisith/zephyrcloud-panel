import crypto from 'crypto';

import axios from 'axios';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserGithubConnection } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/auth.types';

type GithubTokenExchangeResponse = {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GithubUserResponse = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

type GithubRepoResponse = {
  id: number;
  full_name: string;
  default_branch?: string | null;
  html_url?: string | null;
  private?: boolean;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  } | null;
};

type GithubBranchResponse = {
  name: string;
};

type GithubDeployKeyResponse = {
  id: number;
  key: string;
  title: string;
  read_only: boolean;
};

type GithubConnectionPayload = {
  configured: boolean;
  connected: boolean;
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  scopes: string[];
};

function toBigIntStrict(id: string, fieldName = 'id'): bigint {
  try {
    return BigInt(id);
  } catch {
    throw new ForbiddenException(`${fieldName} must be a valid integer string`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractGithubRepoParts(
  value: string,
): { owner: string; repo: string } | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  const simple = normalized.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (simple) {
    return { owner: simple[1], repo: simple[2] };
  }

  const https = normalized.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/i,
  );
  if (https) {
    const repo = https[2].replace(/\.git$/i, '');
    if (repo) return { owner: https[1], repo };
  }

  const ssh = normalized.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) {
    const repo = ssh[2].replace(/\.git$/i, '');
    if (repo) return { owner: ssh[1], repo };
  }

  return null;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private static readonly githubApiBaseUrl = 'https://api.github.com';
  private static readonly oauthAccessTokenUrl =
    'https://github.com/login/oauth/access_token';

  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  public getOauthConfig(): { configured: boolean; client_id?: string } {
    const clientId = this.getOauthClientId();
    const clientSecret = this.getOauthClientSecret();
    if (!clientId || !clientSecret) {
      return { configured: false };
    }

    return {
      configured: true,
      client_id: clientId,
    };
  }

  public async getConnectionSummary(
    user: JwtPayload,
  ): Promise<GithubConnectionPayload> {
    const config = this.getOauthConfig();
    const connection = await this.getUserConnection(user);

    return {
      configured: config.configured,
      connected: Boolean(connection),
      login: connection?.github_login,
      name: connection?.github_name,
      avatar_url: connection?.github_avatar_url,
      scopes: this.parseScopes(connection?.token_scope),
    };
  }

  public async exchangeOauthCode(
    user: JwtPayload,
    input: { code: string; redirect_uri: string },
  ): Promise<GithubConnectionPayload> {
    const tenantId = this.requireTenantId(user);
    const userId = this.requireUserId(user);
    const clientId = this.requireOauthClientId();
    const clientSecret = this.requireOauthClientSecret();

    const tokenRes = await axios.post<GithubTokenExchangeResponse>(
      GithubService.oauthAccessTokenUrl,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: input.redirect_uri,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'GetAeon-Panel',
        },
        timeout: 20_000,
      },
    );

    const accessToken = String(tokenRes.data.access_token ?? '').trim();
    if (!accessToken) {
      throw new BadRequestException(
        tokenRes.data.error_description ||
          tokenRes.data.error ||
          'GitHub did not return an access token.',
      );
    }

    const viewer = await this.githubGet<GithubUserResponse>('/user', accessToken);
    const tokenScope = this.normalizeScopes(tokenRes.data.scope);

    await this.prisma.userGithubConnection.upsert({
      where: { user_id: userId },
      update: {
        tenant_id: tenantId,
        github_user_id: String(viewer.id),
        github_login: viewer.login,
        github_name: viewer.name ?? null,
        github_avatar_url: viewer.avatar_url ?? null,
        access_token_encrypted: this.encryptToken(accessToken),
        token_scope: tokenScope,
      },
      create: {
        tenant_id: tenantId,
        user_id: userId,
        github_user_id: String(viewer.id),
        github_login: viewer.login,
        github_name: viewer.name ?? null,
        github_avatar_url: viewer.avatar_url ?? null,
        access_token_encrypted: this.encryptToken(accessToken),
        token_scope: tokenScope,
      },
    });

    return this.getConnectionSummary(user);
  }

  public async disconnect(user: JwtPayload): Promise<{ ok: true }> {
    const userId = this.requireUserId(user);

    await this.prisma.userGithubConnection.deleteMany({
      where: { user_id: userId },
    });

    return { ok: true };
  }

  public async listRepositories(user: JwtPayload) {
    const { connection, accessToken } = await this.requireConnectionWithToken(user);
    const repos = await this.githubGet<GithubRepoResponse[]>(
      '/user/repos',
      accessToken,
      {
        affiliation: 'owner,collaborator,organization_member',
        sort: 'updated',
        per_page: '100',
      },
    );

    return repos
      .map((repo) => {
        const permissions = isRecord(repo.permissions) ? repo.permissions : {};
        const canManageKeys = Boolean(permissions.admin);

        return {
          id: repo.id,
          full_name: repo.full_name,
          default_branch: repo.default_branch || 'main',
          html_url: repo.html_url || `https://github.com/${repo.full_name}`,
          private: Boolean(repo.private),
          can_manage_keys: canManageKeys,
        };
      })
      .sort((a, b) => {
        if (a.can_manage_keys !== b.can_manage_keys) {
          return a.can_manage_keys ? -1 : 1;
        }
        if (a.private !== b.private) {
          return a.private ? -1 : 1;
        }
        return a.full_name.localeCompare(b.full_name);
      });
  }

  public async listBranches(user: JwtPayload, owner: string, repo: string) {
    const { accessToken } = await this.requireConnectionWithToken(user);
    const branches = await this.githubGet<GithubBranchResponse[]>(
      `/repos/${owner}/${repo}/branches`,
      accessToken,
      { per_page: '100' },
    );

    return branches.map((branch) => ({ name: branch.name }));
  }

  public async createRepositoryDeployKey(
    user: JwtPayload,
    repoFullName: string,
    input: { title: string; key: string; read_only?: boolean },
  ): Promise<{ id: number }> {
    const repo = extractGithubRepoParts(repoFullName);
    if (!repo) {
      throw new BadRequestException(
        'Repository must be a valid GitHub owner/repo pair.',
      );
    }

    const { accessToken } = await this.requireConnectionWithToken(user);

    try {
      const created = await this.githubPost<GithubDeployKeyResponse>(
        `/repos/${repo.owner}/${repo.repo}/keys`,
        accessToken,
        {
          title: input.title,
          key: input.key,
          read_only: input.read_only ?? true,
        },
      );

      return { id: created.id };
    } catch (error) {
      const message = this.extractGithubErrorMessage(error);
      throw new BadRequestException(
        message ||
          'GitHub could not add a deploy key to that repository. Make sure this account has admin access to the repo.',
      );
    }
  }

  public async removeRepositoryDeployKey(
    user: JwtPayload,
    repoFullName: string,
    deployKeyId: number,
  ): Promise<void> {
    const repo = extractGithubRepoParts(repoFullName);
    if (!repo) return;

    const { accessToken } = await this.requireConnectionWithToken(user);

    try {
      await this.githubDelete(
        `/repos/${repo.owner}/${repo.repo}/keys/${deployKeyId}`,
        accessToken,
      );
    } catch (error) {
      this.logger.warn(
        `[removeRepositoryDeployKey] Failed to remove GitHub deploy key ${deployKeyId} from ${repoFullName}: ${this.extractGithubErrorMessage(error) || String(error)}`,
      );
    }
  }

  private async getUserConnection(
    user: JwtPayload,
  ): Promise<UserGithubConnection | null> {
    const userId = this.requireUserId(user);
    return this.prisma.userGithubConnection.findUnique({
      where: { user_id: userId },
    });
  }

  private async requireConnectionWithToken(user: JwtPayload): Promise<{
    connection: UserGithubConnection;
    accessToken: string;
  }> {
    const connection = await this.getUserConnection(user);
    if (!connection) {
      throw new ForbiddenException(
        'Connect your GitHub account before using private repository automation.',
      );
    }

    return {
      connection,
      accessToken: this.decryptToken(connection.access_token_encrypted),
    };
  }

  private requireTenantId(user: JwtPayload): bigint {
    if (!user.tenant_id) throw new ForbiddenException('No tenant assigned');
    return toBigIntStrict(user.tenant_id, 'tenant_id');
  }

  private requireUserId(user: JwtPayload): bigint {
    return toBigIntStrict(user.sub, 'user_id');
  }

  private parseScopes(scopeValue?: string | null): string[] {
    return String(scopeValue ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  private normalizeScopes(scopeValue?: string | null): string | null {
    const scopes = [...new Set(this.parseScopes(scopeValue))].sort();
    return scopes.length ? scopes.join(',') : null;
  }

  private encryptToken(value: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decryptToken(value: string): string {
    const [ivPart, tagPart, encryptedPart] = String(value ?? '').split('.');
    if (!ivPart || !tagPart || !encryptedPart) {
      throw new ServiceUnavailableException(
        'Stored GitHub credentials are invalid. Reconnect GitHub.',
      );
    }

    const key = this.getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const secret =
      (this.config.get<string>('GITHUB_TOKEN_ENCRYPTION_SECRET') ?? '').trim() ||
      (this.config.get<string>('SESSION_SECRET') ?? '').trim() ||
      (this.config.get<string>('JWT_SECRET') ?? '').trim() ||
      'dev-github-token-secret';

    return crypto.createHash('sha256').update(secret).digest();
  }

  private getOauthClientId(): string | null {
    const value = (this.config.get<string>('GITHUB_OAUTH_CLIENT_ID') ?? '').trim();
    return value || null;
  }

  private requireOauthClientId(): string {
    const value = this.getOauthClientId();
    if (!value) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured on this panel.',
      );
    }
    return value;
  }

  private getOauthClientSecret(): string | null {
    const value =
      (this.config.get<string>('GITHUB_OAUTH_CLIENT_SECRET') ?? '').trim();
    return value || null;
  }

  private requireOauthClientSecret(): string {
    const value = this.getOauthClientSecret();
    if (!value) {
      throw new ServiceUnavailableException(
        'GitHub OAuth is not configured on this panel.',
      );
    }
    return value;
  }

  private async githubGet<T>(
    path: string,
    accessToken: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const res = await axios.get<T>(`${GithubService.githubApiBaseUrl}${path}`, {
      headers: this.getGithubHeaders(accessToken),
      params,
      timeout: 20_000,
    });
    return res.data;
  }

  private async githubPost<T>(
    path: string,
    accessToken: string,
    body: unknown,
  ): Promise<T> {
    const res = await axios.post<T>(
      `${GithubService.githubApiBaseUrl}${path}`,
      body,
      {
        headers: this.getGithubHeaders(accessToken),
        timeout: 20_000,
      },
    );

    return res.data;
  }

  private async githubDelete(path: string, accessToken: string): Promise<void> {
    await axios.delete(`${GithubService.githubApiBaseUrl}${path}`, {
      headers: this.getGithubHeaders(accessToken),
      timeout: 20_000,
    });
  }

  private getGithubHeaders(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'GetAeon-Panel',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private extractGithubErrorMessage(error: unknown): string | null {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : null;
    }

    const data = error.response?.data;
    if (isRecord(data) && typeof data.message === 'string' && data.message) {
      return data.message;
    }

    return error.message || null;
  }
}
