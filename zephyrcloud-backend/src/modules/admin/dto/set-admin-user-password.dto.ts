import { IsString, MinLength } from 'class-validator';

export class SetAdminUserPasswordDto {
  @IsString()
  @MinLength(8)
  public password!: string;
}
