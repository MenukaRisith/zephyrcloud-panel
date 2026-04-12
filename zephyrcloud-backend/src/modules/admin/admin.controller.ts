import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/auth.types';
import { AdminService } from './admin.service';
import { UpsertPanelEnvDto } from './dto/upsert-panel-env.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateAdminTenantDto } from './dto/update-admin-tenant.dto';
import { CreateAdminSiteDto } from './dto/create-admin-site.dto';
import { AssignAdminSiteDto } from './dto/assign-admin-site.dto';
import { SetAdminUserPasswordDto } from './dto/set-admin-user-password.dto';
import { ImportCoolifySiteDto } from './dto/import-coolify-site.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  public constructor(private readonly admin: AdminService) {}

  @Get('health')
  public async health(@CurrentUser() user: JwtPayload) {
    return this.admin.health(user);
  }

  @Get('coolify/health')
  public async coolifyHealth(@CurrentUser() user: JwtPayload) {
    return this.admin.health(user);
  }

  @Get('panel-apps')
  public panelApps(@CurrentUser() user: JwtPayload) {
    return this.admin.listPanelApps(user);
  }

  @Post('panel-apps/:target/restart')
  public restartPanelApp(
    @CurrentUser() user: JwtPayload,
    @Param('target') target: 'backend' | 'frontend',
  ) {
    return this.admin.restartPanelApp(user, target);
  }

  @Post('panel-apps/:target/redeploy')
  public redeployPanelApp(
    @CurrentUser() user: JwtPayload,
    @Param('target') target: 'backend' | 'frontend',
  ) {
    return this.admin.redeployPanelApp(user, target);
  }

  @Post('panel-apps/:target/envs')
  public upsertPanelEnv(
    @CurrentUser() user: JwtPayload,
    @Param('target') target: 'backend' | 'frontend',
    @Body() dto: UpsertPanelEnvDto,
  ) {
    return this.admin.upsertPanelEnv(user, target, dto);
  }

  @Delete('panel-apps/:target/envs/:key')
  public deletePanelEnv(
    @CurrentUser() user: JwtPayload,
    @Param('target') target: 'backend' | 'frontend',
    @Param('key') key: string,
  ) {
    return this.admin.deletePanelEnv(user, target, key);
  }

  @Get('users')
  public users(@CurrentUser() user: JwtPayload) {
    return this.admin.listUsers(user);
  }

  @Post('users')
  public createUser(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.admin.createUser(user, dto);
  }

  @Patch('users/:id')
  public updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(user, id, dto);
  }

  @Post('users/:id/password')
  public setUserPassword(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetAdminUserPasswordDto,
  ) {
    return this.admin.setUserPassword(user, id, dto);
  }

  @Get('tenants')
  public tenants(@CurrentUser() user: JwtPayload) {
    return this.admin.listTenants(user);
  }

  @Patch('tenants/:id')
  public updateTenant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAdminTenantDto,
  ) {
    return this.admin.updateTenant(user, id, dto);
  }

  @Get('sites')
  public sites(@CurrentUser() user: JwtPayload) {
    return this.admin.listSites(user);
  }

  @Get('coolify-sites')
  public coolifySites(@CurrentUser() user: JwtPayload) {
    return this.admin.listCoolifySiteCandidates(user);
  }

  @Post('sites')
  public createSite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdminSiteDto,
  ) {
    return this.admin.createSite(user, dto);
  }

  @Post('coolify-sites/import')
  public importCoolifySite(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportCoolifySiteDto,
  ) {
    return this.admin.importCoolifySite(user, dto);
  }

  @Post('sites/:id/assign')
  public assignSite(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AssignAdminSiteDto,
  ) {
    return this.admin.assignSite(user, id, dto);
  }
}
