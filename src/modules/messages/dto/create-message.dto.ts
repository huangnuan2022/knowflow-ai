import { MessageRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  nodeId: string;

  @IsEnum(MessageRole)
  role: MessageRole;

  @IsString()
  content: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequence?: number;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tokenCount?: number;
}
