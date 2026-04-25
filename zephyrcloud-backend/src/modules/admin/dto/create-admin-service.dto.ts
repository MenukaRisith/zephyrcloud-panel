import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class CreateAdminServiceDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  public tenant_id!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2)
  public name!: string;
}
