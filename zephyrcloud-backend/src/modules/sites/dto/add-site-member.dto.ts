import { IsEmail, IsIn, IsOptional } from 'class-validator';

export const siteMemberRoles = ['viewer', 'editor'] as const;
export type SiteMemberRoleDto = (typeof siteMemberRoles)[number];

export class AddSiteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(siteMemberRoles)
  role?: SiteMemberRoleDto;
}
