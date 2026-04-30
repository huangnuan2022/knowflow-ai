import { Injectable } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createRunDto: CreateRunDto) {
    return this.prisma.run.create({ data: createRunDto });
  }

  findAll(nodeId?: string, status?: RunStatus) {
    return this.prisma.run.findMany({
      orderBy: { createdAt: 'desc' },
      where: {
        nodeId,
        status,
      },
    });
  }

  async findOne(id: string) {
    const run = await this.prisma.run.findUnique({
      include: { contextSnapshot: true },
      where: { id },
    });
    return requireRecord(run, 'Run', id);
  }

  async update(id: string, updateRunDto: UpdateRunDto) {
    await this.findOne(id);
    return this.prisma.run.update({
      data: {
        ...updateRunDto,
        completedAt: updateRunDto.completedAt ? new Date(updateRunDto.completedAt) : undefined,
        startedAt: updateRunDto.startedAt ? new Date(updateRunDto.startedAt) : undefined,
      },
      where: { id },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.run.delete({ where: { id } });
  }
}
