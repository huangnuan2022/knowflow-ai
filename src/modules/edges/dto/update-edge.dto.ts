import { EdgeType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateEdgeDto {
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
