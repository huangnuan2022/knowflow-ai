import { Injectable } from '@nestjs/common';
import { EdgeType, MessageRole, NodeType, RunStatus } from '@prisma/client';
import { AiRunConfigService } from '../ai/ai-run-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYSTEM_DESIGN_DEMO_BRANCHES,
  SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
  SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
  SYSTEM_DESIGN_DEMO_NODES,
  SYSTEM_DESIGN_DEMO_PROJECT_DESCRIPTION,
  SYSTEM_DESIGN_DEMO_PROJECT_TITLE,
  SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION,
  SYSTEM_DESIGN_DEMO_ROOT_KEY,
} from './demo-seed.constants';

@Injectable()
export class DemoSeedService {
  constructor(
    private readonly aiRunConfig: AiRunConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async seedSystemDesignDemo() {
    const runConfig = this.aiRunConfig.resolveRunConfig();

    return this.prisma.$transaction(async (tx) => {
      const existingProject = await tx.project.findFirst({
        orderBy: { createdAt: 'asc' },
        where: { title: SYSTEM_DESIGN_DEMO_PROJECT_TITLE },
      });

      if (existingProject) {
        const existingGraph = await tx.graph.findFirst({
          orderBy: { createdAt: 'asc' },
          where: {
            projectId: existingProject.id,
            title: SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
          },
        });

        if (existingGraph) {
          return {
            created: false,
            graph: existingGraph,
            project: existingProject,
          };
        }
      }

      const project =
        existingProject ??
        (await tx.project.create({
          data: {
            description: SYSTEM_DESIGN_DEMO_PROJECT_DESCRIPTION,
            title: SYSTEM_DESIGN_DEMO_PROJECT_TITLE,
          },
        }));

      const graph = await tx.graph.create({
        data: {
          projectId: project.id,
          settings: {
            demoSeed: 'system-design-url-shortener-v0',
          },
          title: SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
        },
      });

      const nodeRecords = new Map<string, { id: string }>();
      const messageRecords = new Map<string, { content: string; id: string }>();

      for (const nodeSeed of SYSTEM_DESIGN_DEMO_NODES) {
        const node = await tx.node.create({
          data: {
            graphId: graph.id,
            layout: nodeSeed.layout,
            summary: nodeSeed.summary,
            title: nodeSeed.title,
            type: NodeType.CONVERSATION,
          },
        });

        nodeRecords.set(nodeSeed.key, node);

        for (const [sequence, messageSeed] of nodeSeed.messages.entries()) {
          const message = await tx.message.create({
            data: {
              content: messageSeed.content,
              nodeId: node.id,
              role: messageSeed.role as MessageRole,
              sequence,
              tokenCount: messageSeed.tokenCount ?? estimateTokens(messageSeed.content),
            },
          });

          messageRecords.set(getMessageKey(nodeSeed.key, sequence), {
            content: messageSeed.content,
            id: message.id,
          });
        }
      }

      const rootNode = nodeRecords.get(SYSTEM_DESIGN_DEMO_ROOT_KEY);
      if (!rootNode) {
        throw new Error(`Seed root node "${SYSTEM_DESIGN_DEMO_ROOT_KEY}" was not found`);
      }

      await tx.graph.update({
        data: { rootNodeId: rootNode.id },
        where: { id: graph.id },
      });

      const highlightRecords = new Map<string, { id: string }>();

      for (const branch of SYSTEM_DESIGN_DEMO_BRANCHES) {
        const sourceNode = nodeRecords.get(branch.sourceKey);
        const targetNode = nodeRecords.get(branch.targetKey);
        const sourceMessage = messageRecords.get(getMessageKey(branch.sourceKey, branch.sourceMessageSequence));

        if (!sourceNode || !targetNode || !sourceMessage) {
          throw new Error(`Seed branch "${branch.label ?? branch.selectedText}" references a missing node or message`);
        }

        const highlightKey = getHighlightKey(branch.sourceKey, branch.sourceMessageSequence, branch.selectedText);
        let highlight = highlightRecords.get(highlightKey);

        if (!highlight) {
          const selectionRange = findSelectionRange(sourceMessage.content, branch.selectedText);
          highlight = await tx.highlight.create({
            data: {
              anchorVersion: 1,
              endOffset: selectionRange.endOffset,
              messageId: sourceMessage.id,
              selectedTextSnapshot: branch.selectedText,
              startOffset: selectionRange.startOffset,
            },
          });
          highlightRecords.set(highlightKey, highlight);
        }

        await tx.edge.create({
          data: {
            graphId: graph.id,
            label: branch.label ?? branch.selectedText,
            sourceHighlightId: highlight.id,
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            type: EdgeType.BRANCH,
          },
        });

        const run = await tx.run.create({
          data: {
            contextPolicyVersion: SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
            model: runConfig.model,
            nodeId: targetNode.id,
            promptTemplateVersion: SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION,
            provider: runConfig.provider,
            status: RunStatus.PENDING,
          },
        });

        await tx.contextSnapshot.create({
          data: {
            contextPolicyVersion: SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
            includedHighlightIds: [highlight.id],
            includedMessageIds: [sourceMessage.id],
            promptTemplateVersion: SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION,
            runId: run.id,
            selectedTextSnapshot: branch.selectedText,
            tokenEstimate: estimateTokens(branch.selectedText),
          },
        });
      }

      return {
        created: true,
        graph,
        project,
      };
    });
  }
}

function findSelectionRange(content: string, selectedText: string) {
  const startOffset = content.indexOf(selectedText);
  if (startOffset === -1) {
    throw new Error(`Seed selection "${selectedText}" was not found in the assistant message`);
  }

  return {
    endOffset: startOffset + selectedText.length,
    startOffset,
  };
}

function getMessageKey(nodeKey: string, sequence: number) {
  return `${nodeKey}:${sequence}`;
}

function getHighlightKey(nodeKey: string, sequence: number, selectedText: string) {
  return `${getMessageKey(nodeKey, sequence)}:${selectedText}`;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
