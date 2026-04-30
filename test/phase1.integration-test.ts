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

type RecordWithId = {
  id: string;
};

describe('Phase 1 backend persistence boundaries', () => {
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

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('creates Phase 1 domain records through REST endpoints and persists them', async () => {
    const user = await requestJson<RecordWithId>(baseUrl, '/users', {
      body: JSON.stringify({
        displayName: 'Phase 1 Tester',
        email: 'phase1@example.com',
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
        layout: { height: 320, width: 480, x: 0, y: 0 },
        summary: 'Root conversation about Union Find.',
        title: 'Union Find Basics',
      }),
      method: 'POST',
    });

    const childNode = await requestJson<RecordWithId>(baseUrl, '/nodes', {
      body: JSON.stringify({
        graphId: graph.id,
        layout: { height: 280, width: 420, x: 560, y: 80 },
        title: 'Path Compression',
      }),
      method: 'POST',
    });

    await requestJson<RecordWithId>(baseUrl, `/graphs/${graph.id}`, {
      body: JSON.stringify({ rootNodeId: parentNode.id }),
      method: 'PATCH',
    });

    const messageContent =
      'Path compression makes every visited node point directly to the root after a find operation.';
    const selectedTextSnapshot = 'Path compression';

    const message = await requestJson<RecordWithId & { sequence: number; role: MessageRole }>(
      baseUrl,
      '/messages',
      {
        body: JSON.stringify({
          content: messageContent,
          nodeId: parentNode.id,
          role: MessageRole.ASSISTANT,
          tokenCount: 18,
        }),
        method: 'POST',
      },
    );

    const highlight = await requestJson<RecordWithId & { selectedTextSnapshot: string }>(
      baseUrl,
      '/highlights',
      {
        body: JSON.stringify({
          anchorVersion: 1,
          endOffset: selectedTextSnapshot.length,
          messageId: message.id,
          selectedTextSnapshot,
          startOffset: 0,
        }),
        method: 'POST',
      },
    );

    const edge = await requestJson<RecordWithId>(baseUrl, '/edges', {
      body: JSON.stringify({
        graphId: graph.id,
        label: selectedTextSnapshot,
        sourceHighlightId: highlight.id,
        sourceNodeId: parentNode.id,
        targetNodeId: childNode.id,
        type: EdgeType.BRANCH,
      }),
      method: 'POST',
    });

    const run = await requestJson<RecordWithId & { model: string; provider: string; status: RunStatus }>(baseUrl, '/runs', {
      body: JSON.stringify({
        contextPolicyVersion: 'phase1-test-context-v1',
        model: 'stub-tutor-v0',
        nodeId: childNode.id,
        promptTemplateVersion: 'phase1-test-prompt-v1',
        provider: 'stub',
        status: RunStatus.PENDING,
      }),
      method: 'POST',
    });
    expect(run).toMatchObject({
      model: 'stub-tutor-v0',
      provider: 'stub',
    });

    const contextSnapshot = await requestJson<RecordWithId & { selectedTextSnapshot: string }>(
      baseUrl,
      '/context-snapshots',
      {
        body: JSON.stringify({
          contextPolicyVersion: 'phase1-test-context-v1',
          includedHighlightIds: [highlight.id],
          includedMessageIds: [message.id],
          promptTemplateVersion: 'phase1-test-prompt-v1',
          runId: run.id,
          selectedTextSnapshot,
          tokenEstimate: 64,
        }),
        method: 'POST',
      },
    );

    const persistedGraph = await requestJson<RecordWithId & { rootNodeId: string }>(
      baseUrl,
      `/graphs/${graph.id}`,
    );
    const persistedMessage = await requestJson<RecordWithId & { sequence: number }>(
      baseUrl,
      `/messages/${message.id}`,
    );
    const persistedHighlight = await requestJson<RecordWithId & { selectedTextSnapshot: string }>(
      baseUrl,
      `/highlights/${highlight.id}`,
    );
    const persistedEdge = await requestJson<RecordWithId & { sourceHighlightId: string }>(
      baseUrl,
      `/edges/${edge.id}`,
    );
    const persistedRun = await requestJson<RecordWithId & { contextSnapshot: RecordWithId }>(
      baseUrl,
      `/runs/${run.id}`,
    );

    expect(persistedGraph.rootNodeId).toBe(parentNode.id);
    expect(persistedMessage.sequence).toBe(0);
    expect(persistedHighlight.selectedTextSnapshot).toBe(selectedTextSnapshot);
    expect(persistedEdge.sourceHighlightId).toBe(highlight.id);
    expect(persistedRun.contextSnapshot.id).toBe(contextSnapshot.id);

    await expect(prisma.contextSnapshot.findUniqueOrThrow({ where: { id: contextSnapshot.id } })).resolves.toMatchObject({
      runId: run.id,
      selectedTextSnapshot,
    });
  });
});

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
