import { DomainEdge, DomainNode, Graph, GraphBundle, NodeLayout, Project } from './domain';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

type RequestBody = Record<string, unknown>;

export async function loadGraphBundle(): Promise<GraphBundle> {
  const projects = await get<Project[]>('/projects');
  const activeProject = projects[0] ?? (await createProject());
  const graphs = await get<Graph[]>(`/graphs?projectId=${activeProject.id}`);
  const activeGraph = graphs[0] ?? (await createGraph(activeProject.id));
  const [nodes, edges] = await Promise.all([
    get<DomainNode[]>(`/nodes?graphId=${activeGraph.id}`),
    get<DomainEdge[]>(`/edges?graphId=${activeGraph.id}`),
  ]);

  return {
    activeGraph,
    activeProject,
    edges,
    graphs,
    nodes,
    projects: projects.length > 0 ? projects : [activeProject],
  };
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

export async function updateNodeLayout(nodeId: string, layout: Required<Pick<NodeLayout, 'x' | 'y'>>) {
  return patch<DomainNode>(`/nodes/${nodeId}`, { layout });
}

export async function createManualEdge(input: { graphId: string; sourceNodeId: string; targetNodeId: string }) {
  return post<DomainEdge>('/edges', {
    graphId: input.graphId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    type: 'MANUAL',
  });
}

async function createProject() {
  return post<Project>('/projects', {
    description: 'Local KnowFlow workspace',
    title: 'KnowFlow Demo Project',
  });
}

async function createGraph(projectId: string) {
  return post<Graph>('/graphs', {
    projectId,
    title: 'Union Find / Path Compression',
  });
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
