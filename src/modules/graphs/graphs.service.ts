import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGraphDto } from './dto/create-graph.dto';
import { UpdateGraphDto } from './dto/update-graph.dto';

@Injectable()
export class GraphsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createGraphDto: CreateGraphDto) {
    const data: Prisma.GraphUncheckedCreateInput = {
      projectId: createGraphDto.projectId,
      rootNodeId: createGraphDto.rootNodeId,
      settings: createGraphDto.settings as Prisma.InputJsonValue | undefined,
      title: createGraphDto.title,
    };

    return this.prisma.graph.create({ data });
  }

  findAll(projectId?: string) {
    return this.prisma.graph.findMany({
      orderBy: { createdAt: 'desc' },
      where: projectId ? { projectId } : undefined,
    });
  }

  async findOne(id: string) {
    const graph = await this.prisma.graph.findUnique({ where: { id } });
    return requireRecord(graph, 'Graph', id);
  }

  async update(id: string, updateGraphDto: UpdateGraphDto) {
    await this.findOne(id);
    const data: Prisma.GraphUncheckedUpdateInput = {
      rootNodeId: updateGraphDto.rootNodeId,
      settings: updateGraphDto.settings as Prisma.InputJsonValue | undefined,
      title: updateGraphDto.title,
    };

    return this.prisma.graph.update({ data, where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.graph.delete({ where: { id } });
  }
}
