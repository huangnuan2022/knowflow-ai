import { NodeType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateNodeDto {
  @IsOptional()
  @IsEnum(NodeType)
  type?: NodeType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}
