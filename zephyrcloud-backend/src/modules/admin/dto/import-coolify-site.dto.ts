import { IsEnum, IsOptional, IsString } from 'class-validator';

import { SiteTypeDto } from '../../sites/dto/create-site.dto';

export class ImportCoolifySiteDto {
  @IsString()
  public coolify_resource_id!: string;

  @IsString()
  public tenant_id!: string;

  @IsOptional()
  @IsString()
  public assign_user_id?: string;

  @IsOptional()
  @IsString()
  public name?: string;

  @IsOptional()
  @IsEnum(SiteTypeDto)
  public type?: SiteTypeDto;

  @IsOptional()
  @IsString()
  public role?: string;
}
