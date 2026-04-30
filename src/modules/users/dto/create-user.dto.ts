import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
