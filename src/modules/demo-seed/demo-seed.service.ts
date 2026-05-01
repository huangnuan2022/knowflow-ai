import { Injectable } from '@nestjs/common';
import { EdgeType, MessageRole, NodeType, RunStatus } from '@prisma/client';
import { AiRunConfigService } from '../ai/ai-run-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SYSTEM_DESIGN_DEMO_ASSISTANT_RESPONSE,
  SYSTEM_DESIGN_DEMO_BRANCHES,
  SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
  SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
  SYSTEM_DESIGN_DEMO_PROJECT_DESCRIPTION,
  SYSTEM_DESIGN_DEMO_PROJECT_TITLE,
  SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION,
  SYSTEM_DESIGN_DEMO_ROOT_TITLE,
  SYSTEM_DESIGN_DEMO_USER_PROMPT,
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

      const rootNode = await tx.node.create({
        data: {
          graphId: graph.id,
          layout: { height: 460, width: 700, x: 80, y: 180 },
          summary: 'Start from the full URL shortener design and branch into interview subtopics.',
          title: SYSTEM_DESIGN_DEMO_ROOT_TITLE,
          type: NodeType.CONVERSATION,
        },
      });

      await tx.graph.update({
        data: { rootNodeId: rootNode.id },
        where: { id: graph.id },
      });

      await tx.message.create({
        data: {
          content: SYSTEM_DESIGN_DEMO_USER_PROMPT,
          nodeId: rootNode.id,
          role: MessageRole.USER,
          sequence: 0,
        },
      });

      const assistantMessage = await tx.message.create({
        data: {
          content: SYSTEM_DESIGN_DEMO_ASSISTANT_RESPONSE,
          nodeId: rootNode.id,
          role: MessageRole.ASSISTANT,
          sequence: 1,
          tokenCount: estimateTokens(SYSTEM_DESIGN_DEMO_ASSISTANT_RESPONSE),
        },
      });

      for (const branch of SYSTEM_DESIGN_DEMO_BRANCHES) {
        const selectionRange = findSelectionRange(SYSTEM_DESIGN_DEMO_ASSISTANT_RESPONSE, branch.selectedText);
        const highlight = await tx.highlight.create({
          data: {
            anchorVersion: 1,
            endOffset: selectionRange.endOffset,
            messageId: assistantMessage.id,
            selectedTextSnapshot: branch.selectedText,
            startOffset: selectionRange.startOffset,
          },
        });

        const childNode = await tx.node.create({
          data: {
            graphId: graph.id,
            layout: branch.layout,
            summary: branch.summary,
            title: branch.title,
            type: NodeType.CONVERSATION,
          },
        });

        await tx.edge.create({
          data: {
            graphId: graph.id,
            label: branch.selectedText,
            sourceHighlightId: highlight.id,
            sourceNodeId: rootNode.id,
            targetNodeId: childNode.id,
            type: EdgeType.BRANCH,
          },
        });

        const run = await tx.run.create({
          data: {
            contextPolicyVersion: SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
            model: runConfig.model,
            nodeId: childNode.id,
            promptTemplateVersion: SYSTEM_DESIGN_DEMO_PROMPT_TEMPLATE_VERSION,
            provider: runConfig.provider,
            status: RunStatus.PENDING,
          },
        });

        await tx.contextSnapshot.create({
          data: {
            contextPolicyVersion: SYSTEM_DESIGN_DEMO_CONTEXT_POLICY_VERSION,
            includedHighlightIds: [highlight.id],
            includedMessageIds: [assistantMessage.id],
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

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
