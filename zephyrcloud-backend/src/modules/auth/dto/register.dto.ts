import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  public name!: string;

  @IsEmail()
  public email!: string;

  @MinLength(8)
  public password!: string;

  @IsOptional()
  @IsString()
  public tenantName?: string;
}
