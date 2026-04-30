import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class BranchChildNodeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}

class BranchContextDto {
  @IsString()
  promptTemplateVersion: string;

  @IsString()
  contextPolicyVersion: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tokenEstimate?: number;
}

export class CreateBranchFromSelectionDto {
  @IsOptional()
  @IsString()
  sourceHighlightId?: string;

  @IsString()
  messageId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startOffset: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  endOffset: number;

  @IsString()
  selectedTextSnapshot: string;

  @ValidateNested()
  @Type(() => BranchChildNodeDto)
  childNode: BranchChildNodeDto;

  @ValidateNested()
  @Type(() => BranchContextDto)
  context: BranchContextDto;
}
