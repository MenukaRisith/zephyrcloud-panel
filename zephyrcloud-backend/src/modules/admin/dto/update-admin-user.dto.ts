import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'off') {
      return false;
    }
  }
  return undefined;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  public name?: string;

  @IsOptional()
  @Transform(({ value }) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  public email?: string;

  @IsOptional()
  @IsEnum(Role)
  public role?: Role;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_active?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsString()
  public tenant_id?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsString()
  public package_id?: string;
}
