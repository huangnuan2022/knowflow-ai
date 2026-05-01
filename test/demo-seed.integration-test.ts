import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EdgeType, MessageRole, PrismaClient, RunStatus } from '@prisma/client';
import { AddressInfo } from 'node:net';
import { configureApp } from '../src/app.configure';
import { AppModule } from '../src/app.module';
import {
  SYSTEM_DESIGN_DEMO_BRANCHES,
  SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
  SYSTEM_DESIGN_DEMO_NODES,
  SYSTEM_DESIGN_DEMO_PROJECT_TITLE,
  SYSTEM_DESIGN_DEMO_ROOT_KEY,
} from '../src/modules/demo-seed/demo-seed.constants';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://knowflow:knowflow@localhost:15432/knowflow_test?schema=public';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? testDatabaseUrl;
process.env.AI_PROVIDER = 'stub';
process.env.AI_MODEL = 'stub-tutor-v0';

type RecordWithId = {
  id: string;
};

const rootNodeSeed = SYSTEM_DESIGN_DEMO_NODES.find((node) => node.key === SYSTEM_DESIGN_DEMO_ROOT_KEY);
if (!rootNodeSeed) {
  throw new Error('Demo seed test fixture is missing its root node');
}

const uniqueHighlightCount = new Set(
  SYSTEM_DESIGN_DEMO_BRANCHES.map((branch) =>
    [branch.sourceKey, branch.sourceMessageSequence, branch.selectedText].join(':'),
  ),
).size;

async function requestJson<T>(baseUrl: string, path: string, options: RequestInit = {}): Promise<T> {
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

describe('system design demo seed', () => {
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

  it('creates a deterministic persisted URL shortener demo graph and is idempotent', async () => {
    const firstSeed = await requestJson<{ created: boolean; graph: RecordWithId; project: RecordWithId }>(
      baseUrl,
      '/demo-seed/system-design',
      {
        body: JSON.stringify({}),
        method: 'POST',
      },
    );
    const secondSeed = await requestJson<{ created: boolean; graph: RecordWithId; project: RecordWithId }>(
      baseUrl,
      '/demo-seed/system-design',
      {
        body: JSON.stringify({}),
        method: 'POST',
      },
    );

    expect(firstSeed.created).toBe(true);
    expect(secondSeed.created).toBe(false);
    expect(secondSeed.project.id).toBe(firstSeed.project.id);
    expect(secondSeed.graph.id).toBe(firstSeed.graph.id);

    await expect(prisma.project.count()).resolves.toBe(1);
    await expect(prisma.graph.count()).resolves.toBe(1);
    await expect(prisma.node.count()).resolves.toBe(SYSTEM_DESIGN_DEMO_NODES.length);
    await expect(prisma.edge.count({ where: { type: EdgeType.BRANCH } })).resolves.toBe(
      SYSTEM_DESIGN_DEMO_BRANCHES.length,
    );
    await expect(prisma.highlight.count()).resolves.toBe(uniqueHighlightCount);
    await expect(prisma.run.count({ where: { status: RunStatus.PENDING } })).resolves.toBe(
      SYSTEM_DESIGN_DEMO_BRANCHES.length,
    );
    await expect(prisma.contextSnapshot.count()).resolves.toBe(SYSTEM_DESIGN_DEMO_BRANCHES.length);

    const project = await prisma.project.findFirstOrThrow();
    expect(project).toMatchObject({
      title: SYSTEM_DESIGN_DEMO_PROJECT_TITLE,
    });

    const graph = await prisma.graph.findFirstOrThrow();
    expect(graph).toMatchObject({
      projectId: project.id,
      title: SYSTEM_DESIGN_DEMO_GRAPH_TITLE,
    });
    expect(graph.rootNodeId).toBeTruthy();

    const rootNode = await prisma.node.findUniqueOrThrow({ where: { id: graph.rootNodeId ?? '' } });
    expect(rootNode).toMatchObject({
      graphId: graph.id,
      title: rootNodeSeed.title,
    });

    const messages = await prisma.message.findMany({
      orderBy: { sequence: 'asc' },
      where: { nodeId: rootNode.id },
    });
    expect(messages).toHaveLength(rootNodeSeed.messages.length);
    for (const [sequence, messageSeed] of rootNodeSeed.messages.entries()) {
      expect(messages[sequence]).toMatchObject({
        content: messageSeed.content,
        role: messageSeed.role,
        sequence,
      });
    }

    for (const branch of SYSTEM_DESIGN_DEMO_BRANCHES) {
      const sourceSeed = SYSTEM_DESIGN_DEMO_NODES.find((node) => node.key === branch.sourceKey);
      const targetSeed = SYSTEM_DESIGN_DEMO_NODES.find((node) => node.key === branch.targetKey);
      expect(sourceSeed).toBeDefined();
      expect(targetSeed).toBeDefined();

      const sourceNode = await prisma.node.findFirstOrThrow({
        where: { graphId: graph.id, title: sourceSeed?.title },
      });
      const sourceMessage = await prisma.message.findFirstOrThrow({
        where: {
          nodeId: sourceNode.id,
          sequence: branch.sourceMessageSequence,
        },
      });
      const highlight = await prisma.highlight.findFirstOrThrow({
        where: {
          messageId: sourceMessage.id,
          selectedTextSnapshot: branch.selectedText,
        },
      });
      expect(sourceMessage.content.slice(highlight.startOffset, highlight.endOffset)).toBe(branch.selectedText);

      const childNode = await prisma.node.findFirstOrThrow({
        where: { graphId: graph.id, title: targetSeed?.title },
      });
      const edge = await prisma.edge.findFirstOrThrow({
        where: {
          label: branch.label ?? branch.selectedText,
          sourceHighlightId: highlight.id,
          sourceNodeId: sourceNode.id,
          targetNodeId: childNode.id,
          type: EdgeType.BRANCH,
        },
      });
      expect(edge.targetNodeId).toBe(childNode.id);
      expect(childNode).toMatchObject({
        summary: targetSeed?.summary,
        title: targetSeed?.title,
      });

      const run = await prisma.run.findFirstOrThrow({
        where: { nodeId: childNode.id, status: RunStatus.PENDING },
      });
      const contextSnapshot = await prisma.contextSnapshot.findUniqueOrThrow({ where: { runId: run.id } });
      expect(contextSnapshot.selectedTextSnapshot).toBe(branch.selectedText);
      expect(contextSnapshot.includedHighlightIds).toEqual([highlight.id]);
      expect(contextSnapshot.includedMessageIds).toEqual([sourceMessage.id]);
    }
  });

  it('exposes the seeded records through the same API reads used by frontend bootstrap', async () => {
    await requestJson(baseUrl, '/demo-seed/system-design', {
      body: JSON.stringify({}),
      method: 'POST',
    });

    const projects = await requestJson<Array<RecordWithId & { title: string }>>(baseUrl, '/projects');
    expect(projects.map((project) => project.title)).toContain(SYSTEM_DESIGN_DEMO_PROJECT_TITLE);

    const seededProject = projects.find((project) => project.title === SYSTEM_DESIGN_DEMO_PROJECT_TITLE);
    expect(seededProject).toBeDefined();

    const graphs = await requestJson<Array<RecordWithId & { title: string }>>(
      baseUrl,
      `/graphs?projectId=${seededProject?.id}`,
    );
    expect(graphs.map((graph) => graph.title)).toContain(SYSTEM_DESIGN_DEMO_GRAPH_TITLE);

    const seededGraph = graphs.find((graph) => graph.title === SYSTEM_DESIGN_DEMO_GRAPH_TITLE);
    expect(seededGraph).toBeDefined();

    const nodes = await requestJson<Array<RecordWithId & { title: string }>>(
      baseUrl,
      `/nodes?graphId=${seededGraph?.id}`,
    );
    const edges = await requestJson<Array<RecordWithId & { type: EdgeType }>>(
      baseUrl,
      `/edges?graphId=${seededGraph?.id}`,
    );
    const rootNode = nodes.find((node) => node.title === rootNodeSeed.title);
    expect(rootNode).toBeDefined();
    expect(nodes).toHaveLength(SYSTEM_DESIGN_DEMO_NODES.length);
    expect(edges.filter((edge) => edge.type === EdgeType.BRANCH)).toHaveLength(SYSTEM_DESIGN_DEMO_BRANCHES.length);

    const messages = await requestJson<Array<RecordWithId & { role: MessageRole }>>(
      baseUrl,
      `/messages?nodeId=${rootNode?.id}`,
    );
    const assistantMessage = messages.find((message) => message.role === MessageRole.ASSISTANT);
    expect(assistantMessage).toBeDefined();

    const highlights = await requestJson<Array<RecordWithId & { selectedTextSnapshot: string }>>(
      baseUrl,
      `/highlights?messageId=${assistantMessage?.id}`,
    );
    const expectedRootHighlights = [
      ...new Set(
        SYSTEM_DESIGN_DEMO_BRANCHES.filter((branch) => branch.sourceKey === SYSTEM_DESIGN_DEMO_ROOT_KEY).map(
          (branch) => branch.selectedText,
        ),
      ),
    ];
    expect(highlights.map((highlight) => highlight.selectedTextSnapshot).sort()).toEqual(
      expectedRootHighlights.sort(),
    );
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
