import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageRole, Prisma, RunStatus } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { AiProviderMessage } from '../ai/providers/ai-provider.interface';
import { AiProviderRegistry } from '../ai/providers/ai-provider.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateRunDto } from './dto/update-run.dto';

@Injectable()
export class RunsService {
  constructor(
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

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

  async execute(id: string) {
    const run = await this.prisma.run.findUnique({
      include: {
        contextSnapshot: true,
        node: {
          include: {
            messages: {
              orderBy: { sequence: 'asc' },
            },
          },
        },
      },
      where: { id },
    });

    const existingRun = requireRecord(run, 'Run', id);
    if (existingRun.status !== RunStatus.PENDING) {
      throw new BadRequestException(`Run ${id} must be PENDING before execution`);
    }

    const provider = this.aiProviderRegistry.get(existingRun.provider);
    if (!provider) {
      await this.prisma.run.update({
        data: {
          completedAt: new Date(),
          errorCode: 'PROVIDER_NOT_FOUND',
          errorMessage: `AI provider ${existingRun.provider} is not registered`,
          status: RunStatus.FAILED,
        },
        where: { id },
      });
      throw new BadRequestException(`AI provider ${existingRun.provider} is not registered`);
    }

    const startedAt = new Date();
    await this.prisma.run.update({
      data: {
        startedAt,
        status: RunStatus.RUNNING,
      },
      where: { id },
    });

    try {
      const completion = await provider.complete({
        messages: toProviderMessages(existingRun.node.messages),
        model: existingRun.model,
        runId: existingRun.id,
        selectedTextSnapshot: existingRun.contextSnapshot?.selectedTextSnapshot,
      });

      return this.prisma.$transaction(async (tx) => {
        const sequence =
          ((await tx.message.aggregate({
            _max: { sequence: true },
            where: { nodeId: existingRun.nodeId },
          }))._max.sequence ?? -1) + 1;

        const message = await tx.message.create({
          data: {
            content: completion.content,
            nodeId: existingRun.nodeId,
            role: MessageRole.ASSISTANT,
            runId: existingRun.id,
            sequence,
            tokenCount: completion.outputTokens,
          },
        });

        const updatedRun = await tx.run.update({
          data: {
            completedAt: new Date(),
            inputTokens: completion.inputTokens,
            latencyMs: Date.now() - startedAt.getTime(),
            outputTokens: completion.outputTokens,
            status: RunStatus.SUCCEEDED,
          },
          include: { contextSnapshot: true },
          where: { id },
        });

        return {
          message,
          run: updatedRun,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI provider failure';
      const failedRun = await this.prisma.run.update({
        data: {
          completedAt: new Date(),
          errorCode: 'PROVIDER_EXECUTION_FAILED',
          errorMessage: message,
          latencyMs: Date.now() - startedAt.getTime(),
          status: RunStatus.FAILED,
        },
        include: { contextSnapshot: true },
        where: { id },
      });

      return {
        message: null,
        run: failedRun,
      };
    }
  }
}

function toProviderMessages(messages: Array<{ role: MessageRole; content: string }>): AiProviderMessage[] {
  return messages.map((message) => ({
    content: message.content,
    role: message.role.toLowerCase() as AiProviderMessage['role'],
  }));
}
