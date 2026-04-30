import { IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
