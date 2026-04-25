import { Transform } from 'class-transformer';
import { Role, SubscriptionPlan } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAdminUserDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  public name!: string;

  @Transform(({ value }) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  public email!: string;

  @Transform(({ value }) => String(value ?? ''))
  @IsString()
  @MinLength(8)
  public password!: string;

  @IsOptional()
  @IsEnum(Role)
  public role?: Role;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  public plan?: SubscriptionPlan;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsString()
  public package_id?: string;

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
  @MinLength(2)
  public tenant_name?: string;
}
