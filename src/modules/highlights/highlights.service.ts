import { BadRequestException, Injectable } from '@nestjs/common';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHighlightDto } from './dto/create-highlight.dto';

@Injectable()
export class HighlightsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createHighlightDto: CreateHighlightDto) {
    if (createHighlightDto.endOffset <= createHighlightDto.startOffset) {
      throw new BadRequestException('endOffset must be greater than startOffset');
    }

    return this.prisma.highlight.create({ data: createHighlightDto });
  }

  findAll(messageId?: string) {
    return this.prisma.highlight.findMany({
      orderBy: { createdAt: 'asc' },
      where: messageId ? { messageId } : undefined,
    });
  }

  async findOne(id: string) {
    const highlight = await this.prisma.highlight.findUnique({ where: { id } });
    return requireRecord(highlight, 'Highlight', id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.highlight.delete({ where: { id } });
  }
}
