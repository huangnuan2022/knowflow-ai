import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateHighlightDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  anchorVersion = 1;
}
