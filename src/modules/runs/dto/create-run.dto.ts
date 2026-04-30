import { RunStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateRunDto {
  @IsString()
  nodeId: string;

  @IsOptional()
  @IsEnum(RunStatus)
  status?: RunStatus;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsString()
  promptTemplateVersion: string;

  @IsString()
  contextPolicyVersion: string;
}
