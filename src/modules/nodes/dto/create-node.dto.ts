import { NodeType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateNodeDto {
  @IsString()
  graphId: string;

  @IsOptional()
  @IsEnum(NodeType)
  type?: NodeType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}
