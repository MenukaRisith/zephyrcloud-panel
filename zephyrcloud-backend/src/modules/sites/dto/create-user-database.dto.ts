import { IsEnum } from 'class-validator';

export enum UserDatabaseEngineDto {
  mariadb = 'mariadb',
  mysql = 'mysql',
  postgresql = 'postgresql',
}

export class CreateUserDatabaseDto {
  @IsEnum(UserDatabaseEngineDto)
  engine!: UserDatabaseEngineDto;
}
