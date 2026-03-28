import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on') {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'off'
    ) {
      return false;
    }
  }
  return undefined;
}

export class UpsertPanelEnvDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/)
  public key!: string;

  @IsString()
  public value!: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_buildtime?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_literal?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_multiline?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  public is_shown_once?: boolean;
}
