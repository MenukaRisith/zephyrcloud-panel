import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/types/auth.types';
import { ExchangeGithubOauthDto } from './dto/exchange-github-oauth.dto';
import { GithubService } from './github.service';

@UseGuards(JwtAuthGuard)
@Controller('github')
export class GithubController {
  public constructor(private readonly github: GithubService) {}

  @Get('oauth/config')
  public oauthConfig() {
    return this.github.getOauthConfig();
  }

  @Get('connection')
  public connection(@CurrentUser() user: JwtPayload) {
    return this.github.getConnectionSummary(user);
  }

  @Post('oauth/exchange')
  public exchange(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ExchangeGithubOauthDto,
  ) {
    return this.github.exchangeOauthCode(user, dto);
  }

  @Delete('connection')
  public disconnect(@CurrentUser() user: JwtPayload) {
    return this.github.disconnect(user);
  }

  @Get('repos')
  public repos(@CurrentUser() user: JwtPayload) {
    return this.github.listRepositories(user);
  }

  @Get('branches/:owner/:repo')
  public branches(
    @CurrentUser() user: JwtPayload,
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    return this.github.listBranches(user, owner, repo);
  }
}
