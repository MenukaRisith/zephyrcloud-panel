import { IsOptional, IsString } from 'class-validator';

export class CreateDeployKeyDto {
  @IsOptional()
  @IsString()
  site_name?: string;

  @IsOptional()
  @IsString()
  repo_url?: string;
}
