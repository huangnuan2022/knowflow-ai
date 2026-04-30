export type Project = {
  id: string;
  title: string;
  description?: string | null;
};

export type Graph = {
  id: string;
  projectId: string;
  title: string;
  rootNodeId?: string | null;
};

export type NodeType = 'CONVERSATION' | 'GRAPH_LINK';

export type DomainNode = {
  id: string;
  graphId: string;
  type: NodeType;
  title: string;
  summary?: string | null;
  layout?: NodeLayout | null;
};

export type NodeLayout = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type EdgeType = 'MANUAL' | 'BRANCH' | 'GRAPH_LINK';

export type DomainEdge = {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  label?: string | null;
  sourceHighlightId?: string | null;
};

export type Highlight = {
  id: string;
  messageId: string;
  startOffset: number;
  endOffset: number;
  selectedTextSnapshot: string;
  anchorVersion: number;
};

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export type Message = {
  id: string;
  nodeId: string;
  role: MessageRole;
  content: string;
  sequence: number;
  runId?: string | null;
  tokenCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type Run = {
  id: string;
  nodeId: string;
  status: RunStatus;
  provider: string;
  model: string;
  promptTemplateVersion: string;
  contextPolicyVersion: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RunExecutionResult = {
  message: Message | null;
  run: Run;
};

export type ContextSnapshot = {
  id: string;
  runId: string;
  includedMessageIds: string[];
  includedHighlightIds: string[];
  selectedTextSnapshot?: string | null;
  tokenEstimate?: number | null;
  promptTemplateVersion: string;
  contextPolicyVersion: string;
};

export type BranchFromSelectionResult = {
  childNode: DomainNode;
  contextSnapshot: ContextSnapshot;
  edge: DomainEdge;
  highlight: Highlight;
  run: Run;
};

export type GraphBundle = {
  projects: Project[];
  activeProject: Project;
  graphs: Graph[];
  activeGraph: Graph;
  nodes: DomainNode[];
  edges: DomainEdge[];
};
