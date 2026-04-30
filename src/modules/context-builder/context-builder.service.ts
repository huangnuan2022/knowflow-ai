import { Injectable } from '@nestjs/common';
import { ContextSnapshot, EdgeType, MessageRole, Run } from '@prisma/client';
import { requireRecord } from '../../common/prisma-errors';
import { AiProviderMessage } from '../ai/providers/ai-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';

type CurrentMessage = {
  id: string;
  role: MessageRole;
  content: string;
};

type AncestorReference = {
  highlightId: string;
  messageId: string;
  selectedTextSnapshot: string;
};

export type BuiltRunContext = {
  contextSnapshot: ContextSnapshot;
  providerMessages: AiProviderMessage[];
  run: Run;
  selectedTextSnapshot?: string | null;
};

@Injectable()
export class ContextBuilderService {
  private readonly maxAncestorDepth = 3;

  constructor(private readonly prisma: PrismaService) {}

  async buildForRun(runId: string): Promise<BuiltRunContext> {
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
      where: { id: runId },
    });

    const existingRun = requireRecord(run, 'Run', runId);
    const ancestorReferences = await this.findAncestorReferences(existingRun.nodeId);
    const selectedTextSnapshot =
      existingRun.contextSnapshot?.selectedTextSnapshot ??
      ancestorReferences[0]?.selectedTextSnapshot ??
      null;

    const currentMessages = existingRun.node.messages;
    const providerMessages = buildProviderMessages({
      ancestorReferences,
      contextPolicyVersion: existingRun.contextPolicyVersion,
      currentMessages,
      selectedTextSnapshot,
    });

    const includedMessageIds = uniqueStrings([
      ...jsonStringArray(existingRun.contextSnapshot?.includedMessageIds),
      ...ancestorReferences.map((reference) => reference.messageId),
      ...currentMessages.map((message) => message.id),
    ]);

    const includedHighlightIds = uniqueStrings([
      ...jsonStringArray(existingRun.contextSnapshot?.includedHighlightIds),
      ...ancestorReferences.map((reference) => reference.highlightId),
    ]);

    const tokenEstimate = estimateTokenCount(providerMessages.map((message) => message.content).join('\n\n'));

    const contextSnapshot = await this.prisma.contextSnapshot.upsert({
      create: {
        contextPolicyVersion: existingRun.contextPolicyVersion,
        includedHighlightIds,
        includedMessageIds,
        promptTemplateVersion: existingRun.promptTemplateVersion,
        runId: existingRun.id,
        selectedTextSnapshot,
        tokenEstimate,
      },
      update: {
        contextPolicyVersion: existingRun.contextPolicyVersion,
        includedHighlightIds,
        includedMessageIds,
        promptTemplateVersion: existingRun.promptTemplateVersion,
        selectedTextSnapshot,
        tokenEstimate,
      },
      where: { runId: existingRun.id },
    });

    return {
      contextSnapshot,
      providerMessages,
      run: existingRun,
      selectedTextSnapshot,
    };
  }

  private async findAncestorReferences(nodeId: string): Promise<AncestorReference[]> {
    const references: AncestorReference[] = [];
    const visitedNodeIds = new Set<string>([nodeId]);
    let currentNodeId = nodeId;

    for (let depth = 0; depth < this.maxAncestorDepth; depth += 1) {
      const inboundBranch = await this.prisma.edge.findFirst({
        include: {
          sourceHighlight: {
            include: {
              message: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        where: {
          targetNodeId: currentNodeId,
          type: EdgeType.BRANCH,
        },
      });

      if (!inboundBranch?.sourceHighlight) {
        break;
      }

      references.push({
        highlightId: inboundBranch.sourceHighlight.id,
        messageId: inboundBranch.sourceHighlight.messageId,
        selectedTextSnapshot: inboundBranch.sourceHighlight.selectedTextSnapshot,
      });

      currentNodeId = inboundBranch.sourceNodeId;
      if (visitedNodeIds.has(currentNodeId)) {
        break;
      }

      visitedNodeIds.add(currentNodeId);
    }

    return references;
  }
}

function buildProviderMessages(input: {
  ancestorReferences: AncestorReference[];
  contextPolicyVersion: string;
  currentMessages: CurrentMessage[];
  selectedTextSnapshot?: string | null;
}): AiProviderMessage[] {
  const messages: AiProviderMessage[] = [
    {
      content: `You are KnowFlow's AI tutor. Use the current node thread as primary context. Context policy: ${input.contextPolicyVersion}.`,
      role: 'system',
    },
  ];

  if (input.selectedTextSnapshot) {
    messages.push({
      content: `Selected text that created or focuses this branch:\n${input.selectedTextSnapshot}`,
      role: 'user',
    });
  }

  if (input.ancestorReferences.length > 0) {
    const path = [...input.ancestorReferences]
      .reverse()
      .map((reference, index) => `${index + 1}. ${reference.selectedTextSnapshot}`)
      .join('\n');

    messages.push({
      content: `Ancestor branch path references:\n${path}`,
      role: 'user',
    });
  }

  messages.push(
    ...input.currentMessages.map((message) => ({
      content: message.content,
      role: message.role.toLowerCase() as AiProviderMessage['role'],
    })),
  );

  return messages;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
