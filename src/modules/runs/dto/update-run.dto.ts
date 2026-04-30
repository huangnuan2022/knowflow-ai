import { RunStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRunDto {
  @IsOptional()
  @IsEnum(RunStatus)
  status?: RunStatus;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  latencyMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inputTokens?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  outputTokens?: number;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
