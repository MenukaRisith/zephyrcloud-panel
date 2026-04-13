import { IsOptional, IsString } from 'class-validator';

export class UpdateSiteBuildSettingsDto {
  @IsOptional()
  @IsString()
  install_command?: string;

  @IsOptional()
  @IsString()
  build_command?: string;

  @IsOptional()
  @IsString()
  start_command?: string;
}
