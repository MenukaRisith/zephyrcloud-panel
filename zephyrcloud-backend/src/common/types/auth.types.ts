export type Role = 'admin' | 'user';

export interface JwtPayload {
  sub: string; // user id as string
  email: string;
  role: Role;
  tenant_id: string | null;
}
