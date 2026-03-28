import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSiteDatabaseDto {
  @IsString()
  host!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  port?: number;

  @IsString()
  db_name!: string;

  @IsString()
  username!: string;

  @IsString()
  password!: string;
}
