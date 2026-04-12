import { IsOptional, IsString } from 'class-validator';

export class AssignAdminSiteDto {
  @IsString()
  public user_id!: string;

  @IsOptional()
  @IsString()
  public role?: string;
}
