import {
  BranchFromSelectionResult,
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const DEFAULT_AI_PROVIDER = import.meta.env.VITE_AI_PROVIDER ?? 'stub';
const DEFAULT_AI_MODEL = import.meta.env.VITE_AI_MODEL ?? 'stub-tutor-v0';
const PROMPT_TEMPLATE_VERSION = 'knowflow-tutor-v0';
const CONTEXT_POLICY_VERSION = 'current-node-selected-ancestor-v0';

type RequestBody = Record<string, unknown>;

export type WorkspaceSelection = {
  graphId?: string | null;
  projectId?: string | null;
};

export async function loadGraphBundle(selection: WorkspaceSelection = {}): Promise<GraphBundle> {
  const projects = await get<Project[]>('/projects');
  const activeProject =
    projects.find((project) => project.id === selection.projectId) ??
    projects[0] ??
    (await createProject({
      description: 'Local KnowFlow workspace',
      title: 'KnowFlow Demo Project',
    }));
  const graphs = await get<Graph[]>(`/graphs?projectId=${activeProject.id}`);
  const activeGraph =
    graphs.find((graph) => graph.id === selection.graphId) ??
    graphs[0] ??
    (await createGraph({
      projectId: activeProject.id,
      title: projects.length === 0 ? 'Union Find / Path Compression' : 'Untitled Graph',
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
    model: input.model ?? DEFAULT_AI_MODEL,
    nodeId: input.nodeId,
    promptTemplateVersion: input.promptTemplateVersion ?? PROMPT_TEMPLATE_VERSION,
    provider: input.provider ?? DEFAULT_AI_PROVIDER,
  });
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
    method: options.method ?? 'GET',
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return body as T;
}
