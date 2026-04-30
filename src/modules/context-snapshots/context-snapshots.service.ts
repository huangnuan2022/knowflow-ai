import { Injectable } from '@nestjs/common';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContextSnapshotDto } from './dto/create-context-snapshot.dto';

@Injectable()
export class ContextSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createContextSnapshotDto: CreateContextSnapshotDto) {
    return this.prisma.contextSnapshot.create({ data: createContextSnapshotDto });
  }

  findAll(runId?: string) {
    return this.prisma.contextSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      where: runId ? { runId } : undefined,
    });
  }

  async findOne(id: string) {
    const contextSnapshot = await this.prisma.contextSnapshot.findUnique({ where: { id } });
    return requireRecord(contextSnapshot, 'ContextSnapshot', id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contextSnapshot.delete({ where: { id } });
  }
}
