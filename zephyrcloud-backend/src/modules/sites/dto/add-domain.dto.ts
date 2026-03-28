import { IsString } from 'class-validator';

export class AddDomainDto {
  @IsString()
  domain!: string;
}
