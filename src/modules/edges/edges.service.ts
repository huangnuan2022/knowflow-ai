import { Injectable } from '@nestjs/common';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { UpdateEdgeDto } from './dto/update-edge.dto';

@Injectable()
export class EdgesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createEdgeDto: CreateEdgeDto) {
    return this.prisma.edge.create({ data: createEdgeDto });
  }

  findAll(graphId?: string) {
    return this.prisma.edge.findMany({
      orderBy: { createdAt: 'asc' },
      where: graphId ? { graphId } : undefined,
    });
  }

  async findOne(id: string) {
    const edge = await this.prisma.edge.findUnique({ where: { id } });
    return requireRecord(edge, 'Edge', id);
  }

  async update(id: string, updateEdgeDto: UpdateEdgeDto) {
    await this.findOne(id);
    return this.prisma.edge.update({ data: updateEdgeDto, where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.edge.delete({ where: { id } });
  }
}
