import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateGraphDto {
  @IsString()
  projectId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  rootNodeId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
