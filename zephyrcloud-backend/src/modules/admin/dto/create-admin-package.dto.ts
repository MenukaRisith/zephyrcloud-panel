import { Transform } from 'class-transformer';
import { HostingPackageKind, N8nDeploymentVariant } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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

function toNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CreateAdminPackageDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2)
  public name!: string;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsString()
  public description?: string;

  @IsEnum(HostingPackageKind)
  public kind!: HostingPackageKind;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_active?: boolean;

  @IsOptional()
  @IsEnum(N8nDeploymentVariant)
  public n8n_variant?: N8nDeploymentVariant;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(0)
  public max_sites?: number | null;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(0)
  public max_services?: number | null;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(0.1)
  public max_cpu_total?: number | null;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(128)
  public max_memory_mb_total?: number | null;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(1)
  public max_storage_gb_total?: number | null;

  @IsOptional()
  @Transform(({ value }) => toNullableNumber(value))
  @IsNumber()
  @Min(1)
  public max_team_members_per_site?: number | null;
}
