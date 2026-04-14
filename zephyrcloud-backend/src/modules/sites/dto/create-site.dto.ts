import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum SiteTypeDto {
  wordpress = 'wordpress',
  node = 'node',
  php = 'php',
  static = 'static',
  python = 'python',
}

export class CreateSiteDto {
  @IsString()
  name!: string;

  @IsEnum(SiteTypeDto)
  type!: SiteTypeDto;

  @IsOptional()
  @IsString()
  repo_url?: string;

  @IsOptional()
  @IsString()
  repo_branch?: string;

  @IsOptional()
  @IsBoolean()
  auto_deploy?: boolean;

  @IsOptional()
  @IsString() // Using string to support UUIDs if needed
  github_app_id?: string;

  @IsOptional()
  @IsString()
  private_key_uuid?: string;

  @IsOptional()
  @IsBoolean()
  use_github_connection?: boolean;
}
