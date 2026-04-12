import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { SiteTypeDto } from '../../sites/dto/create-site.dto';

export class CreateAdminSiteDto {
  @IsString()
  public tenant_id!: string;

  @IsOptional()
  @IsString()
  public assign_user_id?: string;

  @IsString()
  public name!: string;

  @IsEnum(SiteTypeDto)
  public type!: SiteTypeDto;

  @IsOptional()
  @IsString()
  public repo_url?: string;

  @IsOptional()
  @IsString()
  public repo_branch?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  public cpu_limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(128)
  public memory_mb?: number;

  @IsOptional()
  @IsBoolean()
  public auto_deploy?: boolean;

  @IsOptional()
  @IsString()
  public github_app_id?: string;

  @IsOptional()
  @IsString()
  public private_key_uuid?: string;

  @IsOptional()
  @IsBoolean()
  public use_github_connection?: boolean;
}
