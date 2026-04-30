import { Injectable } from '@nestjs/common';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createMessageDto: CreateMessageDto) {
    return this.prisma.$transaction(async (tx) => {
      const sequence =
        createMessageDto.sequence ??
        ((await tx.message.aggregate({
          _max: { sequence: true },
          where: { nodeId: createMessageDto.nodeId },
        }))._max.sequence ?? -1) + 1;

      return tx.message.create({
        data: {
          content: createMessageDto.content,
          nodeId: createMessageDto.nodeId,
          role: createMessageDto.role,
          runId: createMessageDto.runId,
          sequence,
          tokenCount: createMessageDto.tokenCount,
        },
      });
    });
  }

  findAll(nodeId?: string) {
    return this.prisma.message.findMany({
      orderBy: [{ nodeId: 'asc' }, { sequence: 'asc' }],
      where: nodeId ? { nodeId } : undefined,
    });
  }

  async findOne(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    return requireRecord(message, 'Message', id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.message.delete({ where: { id } });
  }
}
