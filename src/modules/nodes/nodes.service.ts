import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Injectable()
export class NodesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createNodeDto: CreateNodeDto) {
    const data: Prisma.NodeUncheckedCreateInput = {
      graphId: createNodeDto.graphId,
      layout: createNodeDto.layout as Prisma.InputJsonValue | undefined,
      summary: createNodeDto.summary,
      title: createNodeDto.title,
      type: createNodeDto.type,
    };

    return this.prisma.node.create({ data });
  }

  findAll(graphId?: string) {
    return this.prisma.node.findMany({
      orderBy: { createdAt: 'asc' },
      where: graphId ? { graphId } : undefined,
    });
  }

  async findOne(id: string) {
    const node = await this.prisma.node.findUnique({ where: { id } });
    return requireRecord(node, 'Node', id);
  }

  async update(id: string, updateNodeDto: UpdateNodeDto) {
    await this.findOne(id);
    const data: Prisma.NodeUncheckedUpdateInput = {
      layout: updateNodeDto.layout as Prisma.InputJsonValue | undefined,
      summary: updateNodeDto.summary,
      title: updateNodeDto.title,
      type: updateNodeDto.type,
    };

    return this.prisma.node.update({ data, where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.node.delete({ where: { id } });
  }
}
