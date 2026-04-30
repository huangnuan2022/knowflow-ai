import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EdgeType, MessageRole, PrismaClient, RunStatus } from '@prisma/client';
import { AddressInfo } from 'node:net';
import { configureApp } from '../src/app.configure';
import { AppModule } from '../src/app.module';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://knowflow:knowflow@localhost:15432/knowflow_test?schema=public';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? testDatabaseUrl;

type RecordWithId = {
  id: string;
};

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body as T;
}

async function requestError(baseUrl: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  return {
    body: (await response.json()) as Record<string, unknown>,
    status: response.status,
  };
}

describe('Branch from selection command', () => {
  let app: INestApplication;
  let baseUrl: string;
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });

  beforeAll(async () => {
    await prisma.$connect();
    await cleanDatabase(prisma);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('atomically creates a child branch from selected AI message text', async () => {
    const { graph, message, parentNode } = await createSourceConversation(baseUrl);
    const selectedTextSnapshot = 'Path compression';

    const branch = await requestJson<{
      childNode: RecordWithId & { graphId: string; title: string };
      contextSnapshot: RecordWithId & { selectedTextSnapshot: string };
      edge: RecordWithId & { sourceHighlightId: string; targetNodeId: string; type: EdgeType };
      highlight: RecordWithId & { selectedTextSnapshot: string };
      run: RecordWithId & { model: string; nodeId: string; provider: string; status: RunStatus };
    }>(baseUrl, '/branches/from-selection', {
      body: JSON.stringify({
        childNode: {
          layout: { height: 280, width: 420, x: 560, y: 80 },
          summary: 'Follow-up branch on path compression.',
          title: 'Path Compression',
        },
        context: {
          contextPolicyVersion: 'branch-context-v1',
          promptTemplateVersion: 'branch-prompt-v1',
          tokenEstimate: 42,
        },
        endOffset: selectedTextSnapshot.length,
        messageId: message.id,
        selectedTextSnapshot,
        startOffset: 0,
      }),
      method: 'POST',
    });

    expect(branch.childNode).toMatchObject({
      graphId: graph.id,
      title: 'Path Compression',
    });
    expect(branch.highlight).toMatchObject({ selectedTextSnapshot });
    expect(branch.edge).toMatchObject({
      sourceHighlightId: branch.highlight.id,
      targetNodeId: branch.childNode.id,
      type: EdgeType.BRANCH,
    });
    expect(branch.run).toMatchObject({
      model: 'stub-tutor-v0',
      nodeId: branch.childNode.id,
      provider: 'stub',
      status: RunStatus.PENDING,
    });
    expect(branch.contextSnapshot).toMatchObject({ selectedTextSnapshot });

    await expect(prisma.highlight.findUniqueOrThrow({ where: { id: branch.highlight.id } })).resolves.toMatchObject({
      messageId: message.id,
      selectedTextSnapshot,
    });
    await expect(prisma.edge.findUniqueOrThrow({ where: { id: branch.edge.id } })).resolves.toMatchObject({
      sourceNodeId: parentNode.id,
      targetNodeId: branch.childNode.id,
    });
    await expect(prisma.contextSnapshot.findUniqueOrThrow({ where: { id: branch.contextSnapshot.id } })).resolves.toMatchObject({
      runId: branch.run.id,
      selectedTextSnapshot,
    });
  });

  it('rejects a mismatched selectedTextSnapshot without creating branch records', async () => {
    const { message } = await createSourceConversation(baseUrl);

    const before = await branchRecordCounts(prisma);
    const response = await requestError(baseUrl, '/branches/from-selection', {
      body: JSON.stringify({
        childNode: {
          title: 'Incorrect Branch',
        },
        context: {
          contextPolicyVersion: 'branch-context-v1',
          promptTemplateVersion: 'branch-prompt-v1',
        },
        endOffset: 16,
        messageId: message.id,
        selectedTextSnapshot: 'wrong selection',
        startOffset: 0,
      }),
      method: 'POST',
    });

    expect(response.status).toBe(400);
    await expect(branchRecordCounts(prisma)).resolves.toEqual(before);
  });

  it('can create another child branch from an existing highlight without duplicating the highlight', async () => {
    const { message } = await createSourceConversation(baseUrl);
    const selectedTextSnapshot = 'Path compression';

    const firstBranch = await requestJson<{
      childNode: RecordWithId;
      edge: RecordWithId & { sourceHighlightId: string; type: EdgeType };
      highlight: RecordWithId & {
        endOffset: number;
        messageId: string;
        selectedTextSnapshot: string;
        startOffset: number;
      };
    }>(baseUrl, '/branches/from-selection', {
      body: JSON.stringify({
        childNode: {
          title: 'Path Compression',
        },
        context: {
          contextPolicyVersion: 'branch-context-v1',
          promptTemplateVersion: 'branch-prompt-v1',
        },
        endOffset: selectedTextSnapshot.length,
        messageId: message.id,
        selectedTextSnapshot,
        startOffset: 0,
      }),
      method: 'POST',
    });

    const beforeSecondBranch = await branchRecordCounts(prisma);

    const secondBranch = await requestJson<{
      childNode: RecordWithId;
      contextSnapshot: RecordWithId & { includedHighlightIds: string[] };
      edge: RecordWithId & { sourceHighlightId: string; type: EdgeType };
      highlight: RecordWithId;
    }>(baseUrl, '/branches/from-selection', {
      body: JSON.stringify({
        childNode: {
          title: 'Another Path Compression Branch',
        },
        context: {
          contextPolicyVersion: 'branch-context-v1',
          promptTemplateVersion: 'branch-prompt-v1',
        },
        endOffset: firstBranch.highlight.endOffset,
        messageId: firstBranch.highlight.messageId,
        selectedTextSnapshot: firstBranch.highlight.selectedTextSnapshot,
        sourceHighlightId: firstBranch.highlight.id,
        startOffset: firstBranch.highlight.startOffset,
      }),
      method: 'POST',
    });

    expect(secondBranch.highlight.id).toBe(firstBranch.highlight.id);
    expect(secondBranch.edge).toMatchObject({
      sourceHighlightId: firstBranch.highlight.id,
      type: EdgeType.BRANCH,
    });
    expect(secondBranch.contextSnapshot.includedHighlightIds).toContain(firstBranch.highlight.id);
    await expect(branchRecordCounts(prisma)).resolves.toEqual({
      ...beforeSecondBranch,
      contextSnapshots: beforeSecondBranch.contextSnapshots + 1,
      edges: beforeSecondBranch.edges + 1,
      highlights: beforeSecondBranch.highlights,
      nodes: beforeSecondBranch.nodes + 1,
      runs: beforeSecondBranch.runs + 1,
    });
  });
});

async function createSourceConversation(baseUrl: string) {
  const user = await requestJson<RecordWithId>(baseUrl, '/users', {
    body: JSON.stringify({
      displayName: 'Branch Tester',
      email: `branch-${Date.now()}@example.com`,
    }),
    method: 'POST',
  });

  const project = await requestJson<RecordWithId>(baseUrl, '/projects', {
    body: JSON.stringify({
      ownerId: user.id,
      title: 'Union Find Interview Prep',
    }),
    method: 'POST',
  });

  const graph = await requestJson<RecordWithId>(baseUrl, '/graphs', {
    body: JSON.stringify({
      projectId: project.id,
      title: 'Path Compression Learning Flow',
    }),
    method: 'POST',
  });

  const parentNode = await requestJson<RecordWithId>(baseUrl, '/nodes', {
    body: JSON.stringify({
      graphId: graph.id,
      title: 'Union Find Basics',
    }),
    method: 'POST',
  });

  const message = await requestJson<RecordWithId>(baseUrl, '/messages', {
    body: JSON.stringify({
      content: 'Path compression makes every visited node point directly to the root after find.',
      nodeId: parentNode.id,
      role: MessageRole.ASSISTANT,
    }),
    method: 'POST',
  });

  return {
    graph,
    message,
    parentNode,
  };
}

async function branchRecordCounts(prisma: PrismaClient) {
  return {
    contextSnapshots: await prisma.contextSnapshot.count(),
    edges: await prisma.edge.count(),
    highlights: await prisma.highlight.count(),
    nodes: await prisma.node.count(),
    runs: await prisma.run.count(),
  };
}

async function cleanDatabase(prisma: PrismaClient) {
  await prisma.contextSnapshot.deleteMany();
  await prisma.edge.deleteMany();
  await prisma.highlight.deleteMany();
  await prisma.message.deleteMany();
  await prisma.run.deleteMany();
  await prisma.node.deleteMany();
  await prisma.graph.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
