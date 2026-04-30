import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EdgeType, NodeType, Prisma, RunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchFromSelectionDto } from './dto/create-branch-from-selection.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromSelection(createBranchDto: CreateBranchFromSelectionDto) {
    if (createBranchDto.endOffset <= createBranchDto.startOffset) {
      throw new BadRequestException('endOffset must be greater than startOffset');
    }

    const sourceMessage = await this.prisma.message.findUnique({
      include: { node: true },
      where: { id: createBranchDto.messageId },
    });

    if (!sourceMessage) {
      throw new NotFoundException(`Message ${createBranchDto.messageId} was not found`);
    }

    const selectedText = sourceMessage.content.slice(createBranchDto.startOffset, createBranchDto.endOffset);
    if (selectedText !== createBranchDto.selectedTextSnapshot) {
      throw new BadRequestException('selectedTextSnapshot does not match the source message range');
    }

    return this.prisma.$transaction(async (tx) => {
      const highlight = createBranchDto.sourceHighlightId
        ? await tx.highlight.findUnique({ where: { id: createBranchDto.sourceHighlightId } })
        : await tx.highlight.create({
            data: {
              anchorVersion: sourceMessage.version,
              endOffset: createBranchDto.endOffset,
              messageId: sourceMessage.id,
              selectedTextSnapshot: createBranchDto.selectedTextSnapshot,
              startOffset: createBranchDto.startOffset,
            },
          });

      if (!highlight) {
        throw new NotFoundException(`Highlight ${createBranchDto.sourceHighlightId} was not found`);
      }

      if (
        highlight.messageId !== sourceMessage.id ||
        highlight.startOffset !== createBranchDto.startOffset ||
        highlight.endOffset !== createBranchDto.endOffset ||
        highlight.selectedTextSnapshot !== createBranchDto.selectedTextSnapshot
      ) {
        throw new BadRequestException('sourceHighlightId does not match the requested source selection');
      }

      const childNode = await tx.node.create({
        data: {
          graphId: sourceMessage.node.graphId,
          layout: createBranchDto.childNode.layout as Prisma.InputJsonValue | undefined,
          summary: createBranchDto.childNode.summary,
          title: createBranchDto.childNode.title,
          type: NodeType.CONVERSATION,
        },
      });

      const edge = await tx.edge.create({
        data: {
          graphId: sourceMessage.node.graphId,
          label: createBranchDto.selectedTextSnapshot,
          sourceHighlightId: highlight.id,
          sourceNodeId: sourceMessage.nodeId,
          targetNodeId: childNode.id,
          type: EdgeType.BRANCH,
        },
      });

      const run = await tx.run.create({
        data: {
          contextPolicyVersion: createBranchDto.context.contextPolicyVersion,
          model: 'stub-v1',
          nodeId: childNode.id,
          promptTemplateVersion: createBranchDto.context.promptTemplateVersion,
          provider: 'stub',
          status: RunStatus.PENDING,
        },
      });

      const contextSnapshot = await tx.contextSnapshot.create({
        data: {
          contextPolicyVersion: createBranchDto.context.contextPolicyVersion,
          includedHighlightIds: [highlight.id],
          includedMessageIds: [sourceMessage.id],
          promptTemplateVersion: createBranchDto.context.promptTemplateVersion,
          runId: run.id,
          selectedTextSnapshot: createBranchDto.selectedTextSnapshot,
          tokenEstimate: createBranchDto.context.tokenEstimate,
        },
      });

      return {
        childNode,
        contextSnapshot,
        edge,
        highlight,
        run,
      };
    });
  }
}
