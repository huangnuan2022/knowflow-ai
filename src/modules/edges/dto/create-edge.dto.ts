import { EdgeType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateEdgeDto {
  @IsString()
  graphId: string;

  @IsString()
  sourceNodeId: string;

  @IsString()
  targetNodeId: string;

  @IsOptional()
  @IsEnum(EdgeType)
  type?: EdgeType;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  sourceHighlightId?: string;
}
