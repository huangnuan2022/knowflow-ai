import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MessageRole, PrismaClient, RunStatus } from '@prisma/client';
import { AddressInfo } from 'node:net';
import { configureApp } from '../src/app.configure';
import { AppModule } from '../src/app.module';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://knowflow:knowflow@localhost:15432/knowflow_test?schema=public';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? testDatabaseUrl;
process.env.OPENAI_API_KEY = '';

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

describe('Run execution through provider-neutral adapter', () => {
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

  it('executes a pending run with the stub provider and persists an assistant message', async () => {
    const { message, node } = await createNodeWithMessage(baseUrl);
    const selectedTextSnapshot = 'path compression';
    const run = await createRunWithContext(baseUrl, {
      messageId: message.id,
      nodeId: node.id,
      provider: 'stub',
      selectedTextSnapshot,
    });

    const result = await requestJson<{
      message: RecordWithId & { content: string; role: MessageRole; runId: string; sequence: number };
      run: RecordWithId & { status: RunStatus; inputTokens: number; outputTokens: number };
    }>(baseUrl, `/runs/${run.id}/execute`, { method: 'POST' });

    expect(result.run.status).toBe(RunStatus.SUCCEEDED);
    expect(result.message).toMatchObject({
      role: MessageRole.ASSISTANT,
      runId: run.id,
      sequence: 1,
    });
    expect(result.message.content).toContain(selectedTextSnapshot);
    expect(result.run.inputTokens).toBeGreaterThan(0);
    expect(result.run.outputTokens).toBeGreaterThan(0);

    await expect(prisma.run.findUniqueOrThrow({ where: { id: run.id } })).resolves.toMatchObject({
      status: RunStatus.SUCCEEDED,
    });
    await expect(prisma.message.findFirstOrThrow({ where: { runId: run.id } })).resolves.toMatchObject({
      role: MessageRole.ASSISTANT,
    });
  });

  it('builds run context from branch selection, ancestor reference, and current node messages', async () => {
    const { message: sourceMessage } = await createSourceAiMessage(baseUrl);
    const selectedTextSnapshot = 'Path compression';

    const branch = await requestJson<{
      childNode: RecordWithId;
      contextSnapshot: RecordWithId;
      highlight: RecordWithId;
      run: RecordWithId;
    }>(baseUrl, '/branches/from-selection', {
      body: JSON.stringify({
        childNode: {
          title: 'Path Compression Follow-up',
        },
        context: {
          contextPolicyVersion: 'context-builder-v0',
          promptTemplateVersion: 'context-builder-prompt-v1',
          tokenEstimate: 1,
        },
        endOffset: selectedTextSnapshot.length,
        messageId: sourceMessage.id,
        selectedTextSnapshot,
        startOffset: 0,
      }),
      method: 'POST',
    });

    const childMessage = await requestJson<RecordWithId>(baseUrl, '/messages', {
      body: JSON.stringify({
        content: 'Why does this make future find operations faster?',
        nodeId: branch.childNode.id,
        role: MessageRole.USER,
      }),
      method: 'POST',
    });

    const result = await requestJson<{
      message: RecordWithId & { content: string; role: MessageRole; runId: string; sequence: number };
      run: RecordWithId & {
        contextSnapshot: {
          includedHighlightIds: string[];
          includedMessageIds: string[];
          selectedTextSnapshot: string;
          tokenEstimate: number;
        };
        status: RunStatus;
      };
    }>(baseUrl, `/runs/${branch.run.id}/execute`, { method: 'POST' });

    expect(result.run.status).toBe(RunStatus.SUCCEEDED);
    expect(result.message.content).toContain(selectedTextSnapshot);
    expect(result.run.contextSnapshot).toMatchObject({
      selectedTextSnapshot,
    });
    expect(result.run.contextSnapshot.includedHighlightIds).toEqual(expect.arrayContaining([branch.highlight.id]));
    expect(result.run.contextSnapshot.includedMessageIds).toEqual(
      expect.arrayContaining([sourceMessage.id, childMessage.id]),
    );
    expect(result.run.contextSnapshot.tokenEstimate).toBeGreaterThan(1);
  });

  it('marks a run failed when the provider is not registered', async () => {
    const { message, node } = await createNodeWithMessage(baseUrl);
    const run = await createRunWithContext(baseUrl, {
      messageId: message.id,
      nodeId: node.id,
      provider: 'missing-provider',
      selectedTextSnapshot: 'path compression',
    });

    const response = await requestError(baseUrl, `/runs/${run.id}/execute`, { method: 'POST' });

    expect(response.status).toBe(400);
    await expect(prisma.run.findUniqueOrThrow({ where: { id: run.id } })).resolves.toMatchObject({
      errorCode: 'PROVIDER_NOT_FOUND',
      status: RunStatus.FAILED,
    });
    await expect(prisma.message.count({ where: { runId: run.id } })).resolves.toBe(0);
  });

  it('marks an OpenAI run failed clearly when OPENAI_API_KEY is not configured', async () => {
    const { message, node } = await createNodeWithMessage(baseUrl);
    const run = await createRunWithContext(baseUrl, {
      messageId: message.id,
      model: 'gpt-5.4-mini',
      nodeId: node.id,
      provider: 'openai',
      selectedTextSnapshot: 'path compression',
    });

    const result = await requestJson<{
      message: null;
      run: RecordWithId & { errorCode: string; errorMessage: string; status: RunStatus };
    }>(baseUrl, `/runs/${run.id}/execute`, { method: 'POST' });

    expect(result.message).toBeNull();
    expect(result.run).toMatchObject({
      errorCode: 'PROVIDER_EXECUTION_FAILED',
      status: RunStatus.FAILED,
    });
    expect(result.run.errorMessage).toContain('OPENAI_API_KEY is required');
    await expect(prisma.message.count({ where: { runId: run.id } })).resolves.toBe(0);
  });
});

async function createNodeWithMessage(baseUrl: string) {
  const project = await requestJson<RecordWithId>(baseUrl, '/projects', {
    body: JSON.stringify({ title: 'Run Execution Project' }),
    method: 'POST',
  });

  const graph = await requestJson<RecordWithId>(baseUrl, '/graphs', {
    body: JSON.stringify({
      projectId: project.id,
      title: 'Run Execution Graph',
    }),
    method: 'POST',
  });

  const node = await requestJson<RecordWithId>(baseUrl, '/nodes', {
    body: JSON.stringify({
      graphId: graph.id,
      title: 'Path Compression',
    }),
    method: 'POST',
  });

  const message = await requestJson<RecordWithId>(baseUrl, '/messages', {
    body: JSON.stringify({
      content: 'Explain path compression in Union Find.',
      nodeId: node.id,
      role: MessageRole.USER,
    }),
    method: 'POST',
  });

  return {
    message,
    node,
  };
}

async function createSourceAiMessage(baseUrl: string) {
  const project = await requestJson<RecordWithId>(baseUrl, '/projects', {
    body: JSON.stringify({ title: 'Context Builder Project' }),
    method: 'POST',
  });

  const graph = await requestJson<RecordWithId>(baseUrl, '/graphs', {
    body: JSON.stringify({
      projectId: project.id,
      title: 'Context Builder Graph',
    }),
    method: 'POST',
  });

  const node = await requestJson<RecordWithId>(baseUrl, '/nodes', {
    body: JSON.stringify({
      graphId: graph.id,
      title: 'Union Find Basics',
    }),
    method: 'POST',
  });

  const message = await requestJson<RecordWithId>(baseUrl, '/messages', {
    body: JSON.stringify({
      content: 'Path compression makes every visited node point directly to the root after find.',
      nodeId: node.id,
      role: MessageRole.ASSISTANT,
    }),
    method: 'POST',
  });

  return {
    graph,
    message,
    node,
  };
}

async function createRunWithContext(
  baseUrl: string,
  input: {
    messageId: string;
    model?: string;
    nodeId: string;
    provider: string;
    selectedTextSnapshot: string;
  },
) {
  const run = await requestJson<RecordWithId>(baseUrl, '/runs', {
    body: JSON.stringify({
      contextPolicyVersion: 'run-execution-context-v1',
      model: input.model ?? 'stub-v1',
      nodeId: input.nodeId,
      promptTemplateVersion: 'run-execution-prompt-v1',
      provider: input.provider,
      status: RunStatus.PENDING,
    }),
    method: 'POST',
  });

  await requestJson<RecordWithId>(baseUrl, '/context-snapshots', {
    body: JSON.stringify({
      contextPolicyVersion: 'run-execution-context-v1',
      includedHighlightIds: [],
      includedMessageIds: [input.messageId],
      promptTemplateVersion: 'run-execution-prompt-v1',
      runId: run.id,
      selectedTextSnapshot: input.selectedTextSnapshot,
      tokenEstimate: 24,
    }),
    method: 'POST',
  });

  return run;
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
