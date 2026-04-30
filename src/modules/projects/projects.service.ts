import { Injectable } from '@nestjs/common';
import { requireRecord } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createProjectDto: CreateProjectDto) {
    return this.prisma.project.create({ data: createProjectDto });
  }

  findAll(ownerId?: string) {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      where: ownerId ? { ownerId } : undefined,
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    return requireRecord(project, 'Project', id);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({ data: updateProjectDto, where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
