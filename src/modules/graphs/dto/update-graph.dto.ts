import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateGraphDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  rootNodeId?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
