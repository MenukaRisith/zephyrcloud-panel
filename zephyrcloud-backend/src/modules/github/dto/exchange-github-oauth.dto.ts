import { IsString } from 'class-validator';

export class ExchangeGithubOauthDto {
  @IsString()
  code!: string;

  @IsString()
  redirect_uri!: string;
}
