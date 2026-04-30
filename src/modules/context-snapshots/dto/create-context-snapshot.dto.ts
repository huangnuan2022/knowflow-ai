import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateContextSnapshotDto {
  @IsString()
  runId: string;

  @IsArray()
  @IsString({ each: true })
  includedMessageIds: string[];

  @IsArray()
  @IsString({ each: true })
  includedHighlightIds: string[];

  @IsOptional()
  @IsString()
  selectedTextSnapshot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tokenEstimate?: number;

  @IsString()
  promptTemplateVersion: string;

  @IsString()
  contextPolicyVersion: string;
}
