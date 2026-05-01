import { expect, Locator, test } from '@playwright/test';
import { EdgeType, MessageRole, PrismaClient } from '@prisma/client';
import { SYSTEM_DESIGN_DEMO_NODES } from '../../src/modules/demo-seed/demo-seed.constants';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://knowflow:knowflow@localhost:15432/knowflow_test?schema=public';
const selectedText = 'path compression';
const prompt = 'Explain path compression';
const seedUserMessageCount = SYSTEM_DESIGN_DEMO_NODES.reduce(
  (count, node) => count + node.messages.filter((message) => message.role === MessageRole.USER).length,
  0,
);
const seedAssistantMessageCount = SYSTEM_DESIGN_DEMO_NODES.reduce(
  (count, node) => count + node.messages.filter((message) => message.role === MessageRole.ASSISTANT).length,
  0,
);
const newConversationTitle = `Conversation ${SYSTEM_DESIGN_DEMO_NODES.length + 1}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: testDatabaseUrl,
    },
  },
});

test.beforeAll(async () => {
  await prisma.$connect();
});

test.beforeEach(async () => {
  await cleanDatabase(prisma);
});

test.afterAll(async () => {
  await cleanDatabase(prisma);
  await prisma.$disconnect();
});

test('protects the canvas ask, branch, and refresh workflow', async ({ page }) => {
  await test.step('load an empty workspace and let the frontend seed the demo graph', async () => {
    await page.goto('/');
    await expect(page.getByLabel('Project title')).toHaveValue('System Design Prep');
    await expect(page.getByLabel('Graph title')).toHaveValue('Design a URL Shortener');
    await expect(page.getByTestId('conversation-node')).toHaveCount(SYSTEM_DESIGN_DEMO_NODES.length);
  });

  await test.step('create a root conversation node and ask the stub provider', async () => {
    await page.getByRole('button', { name: /^Node$/ }).click();

    const sourceNode = page.getByTestId('conversation-node').filter({ hasText: newConversationTitle }).first();
    await expect(sourceNode).toBeVisible();
    await sourceNode.click();
    await expect(sourceNode.getByLabel('Node title')).toHaveValue(newConversationTitle);
    const askInput = page.getByLabel('Ask about this node');
    await expect(askInput).toBeVisible();
    await askInput.fill(prompt);
    await sourceNode.getByRole('button', { name: /^Ask$/ }).click();

    const assistantMessage = sourceNode.getByTestId('canvas-message-content').filter({ hasText: 'Stub response' }).first();
    await expect(assistantMessage).toContainText(`Stub response for "${prompt}"`);
  });

  await test.step('select exact assistant text and branch from the inline action', async () => {
    const sourceNode = page.getByTestId('conversation-node').filter({ hasText: newConversationTitle }).first();
    const assistantMessage = sourceNode.getByTestId('canvas-message-content').filter({ hasText: 'Stub response' }).first();

    await selectTextInLocator(assistantMessage, selectedText);
    await expect(sourceNode.getByTestId('inline-branch-button')).toBeVisible();
    await sourceNode.getByTestId('inline-branch-button').click();

    await expect(page.getByTestId('conversation-node').filter({ hasText: `Branch: ${selectedText}` }).first()).toBeVisible();
    await expect(page.getByTestId('branch-highlight').filter({ hasText: selectedText }).first()).toBeVisible();
  });

  await test.step('verify branch records and context persisted in PostgreSQL', async () => {
    const highlight = await prisma.highlight.findFirstOrThrow({
      where: { selectedTextSnapshot: selectedText },
    });
    const branchEdge = await prisma.edge.findFirstOrThrow({
      include: { targetNode: true },
      where: {
        sourceHighlightId: highlight.id,
        type: EdgeType.BRANCH,
      },
    });
    const contextSnapshot = await prisma.contextSnapshot.findFirstOrThrow({
      include: { run: true },
      where: { selectedTextSnapshot: selectedText },
    });

    expect(await prisma.node.count()).toBe(SYSTEM_DESIGN_DEMO_NODES.length + 2);
    expect(await prisma.message.count({ where: { role: MessageRole.USER } })).toBe(seedUserMessageCount + 1);
    expect(await prisma.message.count({ where: { role: MessageRole.ASSISTANT } })).toBe(seedAssistantMessageCount + 1);
    expect(await prisma.highlight.count({ where: { selectedTextSnapshot: selectedText } })).toBe(1);
    expect(
      await prisma.edge.count({
        where: {
          sourceHighlightId: highlight.id,
          type: EdgeType.BRANCH,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.contextSnapshot.count({
        where: { selectedTextSnapshot: selectedText },
      }),
    ).toBe(1);

    expect(branchEdge.label).toBe(selectedText);
    expect(branchEdge.targetNode.title).toBe(`Branch: ${selectedText}`);
    expect(contextSnapshot.run.nodeId).toBe(branchEdge.targetNodeId);
  });

  await test.step('reload and verify the learning graph still renders with branch provenance', async () => {
    await page.reload();

    const childNode = page.getByTestId('conversation-node').filter({ hasText: `Branch: ${selectedText}` }).first();
    await expect(childNode).toBeVisible();
    await expect(childNode).toContainText(`Branch context: ${selectedText}`);

    const sourceNode = page.getByTestId('conversation-node').filter({ hasText: newConversationTitle }).first();
    await sourceNode.click();
    await expect(page.getByTestId('branch-highlight').filter({ hasText: selectedText }).first()).toBeVisible();
  });
});

async function selectTextInLocator(locator: Locator, text: string) {
  await locator.evaluate((element, selectedText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode: Node | null = null;
    let startOffset = -1;

    while (walker.nextNode()) {
      const currentNode = walker.currentNode;
      const currentText = currentNode.textContent ?? '';
      const index = currentText.indexOf(selectedText);
      if (index >= 0) {
        textNode = currentNode;
        startOffset = index;
        break;
      }
    }

    if (!textNode || startOffset < 0) {
      throw new Error(`Unable to find text "${selectedText}"`);
    }

    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, startOffset + selectedText.length);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    element.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  }, text);
}

async function cleanDatabase(client: PrismaClient) {
  await client.contextSnapshot.deleteMany();
  await client.edge.deleteMany();
  await client.highlight.deleteMany();
  await client.message.deleteMany();
  await client.run.deleteMany();
  await client.node.deleteMany();
  await client.graph.deleteMany();
  await client.project.deleteMany();
  await client.user.deleteMany();
}
