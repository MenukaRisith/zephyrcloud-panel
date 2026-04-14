// src/modules/sites/sites.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/auth.types';

import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { CreateDeployKeyDto } from './dto/create-deploy-key.dto';
import { AddDomainDto } from './dto/add-domain.dto';
import { CreateSiteDatabaseDto } from './dto/create-site-database.dto';
import { AddSiteMemberDto } from './dto/add-site-member.dto';
import { CreateUserDatabaseDto } from './dto/create-user-database.dto';
import { UpdateSiteBuildSettingsDto } from './dto/update-site-build-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SitesController {
  private readonly logger = new Logger(SitesController.name);

  public constructor(private readonly sites: SitesService) {}

  private parseBooleanQuery(value?: string): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on'
    );
  }

  private toSiteResponse(
    site: Awaited<ReturnType<SitesService['listSites']>>[number],
  ): {
    id: string;
    tenant_id: string;
    status: string;
    primaryDomain: string | null;
  } & Omit<
    Awaited<ReturnType<SitesService['listSites']>>[number],
    'id' | 'tenant_id' | 'status'
  > {
    const withDomains = site as {
      domains?: Array<{ domain: string }>;
    };

    return {
      ...site,
      id: site.id.toString(),
      tenant_id: site.tenant_id.toString(),
      status: site.status.toUpperCase(),
      primaryDomain: withDomains.domains?.[0]?.domain ?? null,
    };
  }

  @Get()
  public async list(@CurrentUser() user: JwtPayload) {
    this.logger.debug(
      `List sites called for user: ${user.sub} (tenant: ${user.tenant_id})`,
    );
    const sites = await this.sites.listSites(user);
    this.logger.debug(`Found ${sites.length} sites`);

    return sites.map((site) => this.toSiteResponse(site));
  }

  @Delete()
  public async deleteByName(
    @CurrentUser() user: JwtPayload,
    @Query('name') name?: string,
  ) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      throw new BadRequestException('name is required');
    }
    return this.sites.deleteSitesByName(user, trimmed);
  }

  @Post('admin/coolify/cleanup')
  public async cleanupCoolify(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name_prefixes?: string[];
      name_contains?: string[];
      dry_run?: boolean;
      delete_projects?: boolean;
    },
  ) {
    return this.sites.cleanupCoolifyResources(user, body ?? {});
  }

  @Post()
  public async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSiteDto,
  ) {
    this.logger.debug(`Create site called: ${dto.name} (${dto.type})`);
    try {
      const site = await this.sites.createSite(user, dto);
      return this.toSiteResponse(site);
    } catch (error) {
      this.logger.error(
        `Error creating site: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  // --- GitHub Proxy ---
  @Get('github/apps')
  public async listGithubApps(@CurrentUser() user: JwtPayload) {
    return this.sites.getGithubApps(user);
  }

  @Get('github/repos/:appId')
  public async listGithubRepos(
    @CurrentUser() user: JwtPayload,
    @Param('appId') appId: string,
  ) {
    return this.sites.getGithubRepos(user, appId);
  }

  @Get('github/branches/:appId/:owner/:repo')
  public async listGithubBranches(
    @CurrentUser() user: JwtPayload,
    @Param('appId') appId: string,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    return this.sites.getGithubBranches(user, appId, owner, repo);
  }

  @Post('deploy-keys')
  public createDeployKey(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDeployKeyDto,
  ) {
    return this.sites.createSiteDeployKey(user, dto);
  }

  @Get('workspace/database')
  public workspaceDatabase(@CurrentUser() user: JwtPayload) {
    return this.sites.getWorkspaceDatabase(user);
  }

  @Post('workspace/database')
  public createWorkspaceDatabase(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateUserDatabaseDto,
  ) {
    return this.sites.createWorkspaceDatabase(user, dto);
  }

  // --- Single Site Ops ---
  @Get(':id')
  public async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const site = await this.sites.getSite(user, id);
    return this.toSiteResponse(site);
  }

  @Get(':id/status')
  public async status(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.sites.getLiveStatus(user, id);
  }

  @Post(':id/deploy')
  public deploy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.sites.deploySite(user, id, {
      force: this.parseBooleanQuery(force),
    });
  }

  @Post(':id/restart')
  public restart(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.restartSite(user, id);
  }

  @Post(':id/start')
  public start(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.startSite(user, id);
  }

  @Post(':id/stop')
  public stop(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.stopSite(user, id);
  }

  @Post(':id/build-settings')
  public updateBuildSettings(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSiteBuildSettingsDto,
  ) {
    return this.sites.updateBuildSettings(user, id, dto);
  }

  @Delete(':id')
  public deleteSite(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.deleteSite(user, id);
  }

  @Get(':id/logs')
  public logs(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('lines') lines?: string,
  ) {
    const parsed =
      typeof lines === 'string' && lines.trim().length > 0
        ? Number.parseInt(lines, 10)
        : undefined;
    const safeLines =
      typeof parsed === 'number' && Number.isFinite(parsed)
        ? parsed
        : undefined;
    return this.sites.getLogs(user, id, safeLines);
  }

  @Get(':id/deployments')
  public deployments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.getDeployments(user, id);
  }

  // --- Domains ---
  @Get(':id/domains')
  public domains(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.getDomains(user, id);
  }

  @Post(':id/domains')
  public addDomain(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddDomainDto,
  ) {
    return this.sites.addDomain(user, id, dto);
  }

  @Post(':id/domains/:domainId/verify')
  public verifyDomain(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    return this.sites.verifyDomain(user, id, domainId);
  }

  @Post(':id/domains/:domainId/retry')
  public retryDomain(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('domainId') domainId: string,
  ) {
    return this.sites.retryDomain(user, id, domainId);
  }

  // --- Team ---
  @Get(':id/team')
  public team(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.getTeam(user, id);
  }

  @Post(':id/team/members')
  public addTeamMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddSiteMemberDto,
  ) {
    return this.sites.addTeamMember(user, id, dto);
  }

  @Delete(':id/team/members/:memberId')
  public removeTeamMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.sites.removeTeamMember(user, id, memberId);
  }

  @Delete(':id/team/invites/:inviteId')
  public revokeTeamInvite(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.sites.revokeTeamInvite(user, id, inviteId);
  }

  // --- Database ---
  @Get(':id/database')
  public database(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sites.getDatabase(user, id);
  }

  @Post(':id/database')
  public createDb(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateSiteDatabaseDto,
  ) {
    return this.sites.createOrReplaceDatabase(user, id, dto);
  }

  @Post(':id/database/public')
  public makeDatabasePublic(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.sites.makeDatabasePublic(user, id);
  }

  @Get(':id/database/tables')
  public databaseTables(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.sites.listDatabaseTables(user, id);
  }

  @Get(':id/database/tables/:table')
  public databaseTableRows(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('table') table: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sites.getDatabaseTableRows(user, id, table, { limit, offset });
  }

  // --- Environment Variables (New) ---
  @Get(':id/envs')
  public async getEnvs(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    // This requires sites.service to have a getEnvs method
    return this.sites.getEnvs(user, id);
  }

  @Post(':id/envs')
  public async createEnv(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      key: string;
      value: string;
      is_preview?: boolean;
      is_multiline?: boolean;
      is_shown_once?: boolean;
      is_build_time?: boolean;
      is_buildtime?: boolean;
      is_literal?: boolean;
    },
  ) {
    // This requires sites.service to have a createEnv method
    return this.sites.createEnv(user, id, body);
  }

  @Delete(':id/envs/:key')
  public async deleteEnv(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('key') key: string,
  ) {
    // This requires sites.service to have a deleteEnv method
    return this.sites.deleteEnv(user, id, key);
  }
}
