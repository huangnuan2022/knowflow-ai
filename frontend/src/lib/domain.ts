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

export type GraphBundle = {
  projects: Project[];
  activeProject: Project;
  graphs: Graph[];
  activeGraph: Graph;
  nodes: DomainNode[];
  edges: DomainEdge[];
};
