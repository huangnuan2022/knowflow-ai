import {
  BranchFromSelectionResult,
  AiRunDefaults,
  DomainEdge,
  DomainNode,
  Graph,
  GraphBundle,
  Highlight,
  Message,
  NodeLayout,
  Project,
  Run,
  RunExecutionResult,
} from './domain';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD
    ? '/api'
    : `${window.location.protocol}//${window.location.hostname}:3000/api`);
const PROMPT_TEMPLATE_VERSION = 'knowflow-tutor-v0';
const CONTEXT_POLICY_VERSION = 'current-node-selected-ancestor-v0';

type RequestBody = Record<string, unknown>;

class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly path?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type WorkspaceSelection = {
  graphId?: string | null;
  projectId?: string | null;
};

export async function loadGraphBundle(selection: WorkspaceSelection = {}): Promise<GraphBundle> {
  let projects = await get<Project[]>('/projects');
  if (projects.length === 0) {
    const seededDemo = await seedSystemDesignDemo();
    projects = await get<Project[]>('/projects');
    if (projects.length === 0) {
      projects = [seededDemo.project];
    }
  }

  const activeProject =
    projects.find((project) => project.id === selection.projectId) ??
    projects[0];
  const graphs = await get<Graph[]>(`/graphs?projectId=${activeProject.id}`);
  const activeGraph =
    graphs.find((graph) => graph.id === selection.graphId) ??
    graphs[0] ??
    (await createGraph({
      projectId: activeProject.id,
      title: 'Untitled Graph',
    }));
  const activeProjectGraphs = graphs.some((graph) => graph.id === activeGraph.id) ? graphs : [...graphs, activeGraph];
  const [nodes, edges] = await Promise.all([
    get<DomainNode[]>(`/nodes?graphId=${activeGraph.id}`),
    get<DomainEdge[]>(`/edges?graphId=${activeGraph.id}`),
  ]);
  const messagesByNodeId = await loadMessagesByNodeId(nodes);
  const highlightsByMessageId = await loadHighlightsByMessageId(messagesByNodeId);

  return {
    activeGraph,
    activeProject,
    edges,
    graphs: activeProjectGraphs,
    highlightsByMessageId,
    messagesByNodeId,
    nodes,
    projects: projects.length > 0 ? projects : [activeProject],
  };
}

export async function seedSystemDesignDemo() {
  return post<{
    created: boolean;
    graph: Graph;
    project: Project;
  }>('/demo-seed/system-design', {});
}

export async function createProject(input: { description?: string | null; title: string }) {
  return post<Project>('/projects', {
    description: input.description ?? null,
    title: input.title,
  });
}

export async function updateProject(
  projectId: string,
  input: {
    description?: string | null;
    title?: string;
  },
) {
  return patch<Project>(`/projects/${projectId}`, input);
}

export async function createGraph(input: { projectId: string; title: string }) {
  return post<Graph>('/graphs', {
    projectId: input.projectId,
    title: input.title,
  });
}

export async function updateGraph(graphId: string, input: { title?: string }) {
  return patch<Graph>(`/graphs/${graphId}`, input);
}

export async function createNode(input: {
  graphId: string;
  layout: Required<Pick<NodeLayout, 'x' | 'y'>> & Pick<NodeLayout, 'width' | 'height'>;
  title: string;
}) {
  return post<DomainNode>('/nodes', {
    graphId: input.graphId,
    layout: input.layout,
    title: input.title,
    type: 'CONVERSATION',
  });
}

export async function deleteNode(nodeId: string) {
  return del<DomainNode>(`/nodes/${nodeId}`);
}

export async function updateNodeLayout(nodeId: string, layout: NodeLayout) {
  return patch<DomainNode>(`/nodes/${nodeId}`, { layout });
}

export async function updateNodeDetails(nodeId: string, input: { title?: string; summary?: string | null }) {
  return patch<DomainNode>(`/nodes/${nodeId}`, input);
}

export async function createManualEdge(input: { graphId: string; sourceNodeId: string; targetNodeId: string }) {
  return post<DomainEdge>('/edges', {
    graphId: input.graphId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    type: 'MANUAL',
  });
}

export async function updateEdgeLabel(edgeId: string, label: string) {
  return patch<DomainEdge>(`/edges/${edgeId}`, { label });
}

export async function deleteEdge(edgeId: string) {
  return del<DomainEdge>(`/edges/${edgeId}`);
}

export async function getMessages(nodeId: string) {
  return get<Message[]>(`/messages?nodeId=${nodeId}`);
}

export async function getHighlights(messageId: string) {
  return get<Highlight[]>(`/highlights?messageId=${messageId}`);
}

export async function createUserMessage(input: { nodeId: string; content: string }) {
  return post<Message>('/messages', {
    content: input.content,
    nodeId: input.nodeId,
    role: 'USER',
  });
}

export async function createRun(input: {
  nodeId: string;
  provider?: string;
  model?: string;
  promptTemplateVersion?: string;
  contextPolicyVersion?: string;
}) {
  return post<Run>('/runs', {
    contextPolicyVersion: input.contextPolicyVersion ?? CONTEXT_POLICY_VERSION,
    model: input.model,
    nodeId: input.nodeId,
    promptTemplateVersion: input.promptTemplateVersion ?? PROMPT_TEMPLATE_VERSION,
    provider: input.provider,
  });
}

export async function getAiRunDefaults() {
  return get<AiRunDefaults>('/runs/defaults');
}

export async function executeRun(runId: string) {
  return post<RunExecutionResult>(`/runs/${runId}/execute`, {});
}

export async function createBranchFromSelection(input: {
  sourceHighlightId?: string;
  messageId: string;
  startOffset: number;
  endOffset: number;
  selectedTextSnapshot: string;
  childNode: {
    title: string;
    summary?: string;
    layout?: NodeLayout;
  };
  context?: {
    promptTemplateVersion?: string;
    contextPolicyVersion?: string;
    tokenEstimate?: number;
  };
}) {
  return post<BranchFromSelectionResult>('/branches/from-selection', {
    childNode: input.childNode,
    context: {
      contextPolicyVersion: input.context?.contextPolicyVersion ?? CONTEXT_POLICY_VERSION,
      promptTemplateVersion: input.context?.promptTemplateVersion ?? PROMPT_TEMPLATE_VERSION,
      tokenEstimate: input.context?.tokenEstimate,
    },
    endOffset: input.endOffset,
    messageId: input.messageId,
    selectedTextSnapshot: input.selectedTextSnapshot,
    sourceHighlightId: input.sourceHighlightId,
    startOffset: input.startOffset,
  });
}

async function loadMessagesByNodeId(nodes: DomainNode[]) {
  const entries = await Promise.all(nodes.map(async (node) => [node.id, await getMessages(node.id)] as const));
  return Object.fromEntries(entries);
}

async function loadHighlightsByMessageId(messagesByNodeId: Record<string, Message[]>) {
  const assistantMessages = Object.values(messagesByNodeId)
    .flat()
    .filter((message) => message.role === 'ASSISTANT');
  const entries = await Promise.all(
    assistantMessages.map(async (message) => [message.id, await getHighlights(message.id)] as const),
  );

  return Object.fromEntries(entries);
}

async function get<T>(path: string) {
  return request<T>(path);
}

async function post<T>(path: string, body: RequestBody) {
  return request<T>(path, { body, method: 'POST' });
}

async function patch<T>(path: string, body: RequestBody) {
  return request<T>(path, { body, method: 'PATCH' });
}

async function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

async function request<T>(path: string, options: { body?: RequestBody; method?: string } = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
      method: options.method ?? 'GET',
    });
  } catch {
    throw new ApiClientError('Backend unavailable. Check the API deployment or try refreshing.', undefined, path);
  }

  const text = await response.text();
  const body = parseResponseBody(text);

  if (!response.ok) {
    const message = responseErrorMessage(body) ?? `${response.status} ${response.statusText}`;
    throw new ApiClientError(Array.isArray(message) ? message.join(', ') : message, response.status, path);
  }

  return body as T;
}

function parseResponseBody(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function responseErrorMessage(body: unknown) {
  if (!body || typeof body !== 'object' || !('message' in body)) {
    return null;
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message;
  }

  return null;
}
