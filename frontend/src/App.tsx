import {
  Background,
  Connection,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  NodeChange,
  NodePositionChange,
  OnNodesChange,
  OnConnectEnd,
  OnConnectStart,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { AlertTriangle, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ConversationNode } from './components/ConversationNode';
import { ConversationPanel } from './components/ConversationPanel';
import { EditableEdge } from './components/EditableEdge';
import {
  createGraph,
  createManualEdge,
  createNode,
  createProject,
  deleteEdge,
  deleteNode,
  getAiRunDefaults,
  loadGraphBundle,
  updateEdgeLabel,
  updateGraph,
  updateNodeDetails,
  updateNodeLayout,
  updateProject,
  WorkspaceSelection,
} from './lib/api';
import { AiRunDefaults, DomainEdge, Graph, GraphBundle, NodeLayout, Project } from './lib/domain';
import {
  ConversationFlowEdge,
  ConversationFlowNode,
  isManualHandleId,
  toReactFlowEdges,
  toReactFlowNodes,
} from './lib/reactFlowAdapter';
import { ReaderSyncAnchor } from './lib/readerSync';

const nodeTypes = {
  conversation: ConversationNode,
};

const edgeTypes = {
  editable: EditableEdge,
};

const INSPECTOR_WIDTH_STORAGE_KEY = 'knowflow.inspectorWidth';
const INSPECTOR_MIN_WIDTH = 300;
const INSPECTOR_DEFAULT_WIDTH = 340;
const WORKSPACE_SELECTION_STORAGE_KEY = 'knowflow.activeWorkspace';
const INITIAL_FIT_VIEW_OPTIONS = {
  maxZoom: 0.88,
  padding: 0.34,
};
const GRAPH_ENTRY_FIT_VIEW_OPTIONS = {
  duration: 260,
  maxZoom: 0.88,
  padding: 0.34,
};

export function App() {
  return (
    <ReactFlowProvider>
      <KnowFlowCanvas />
    </ReactFlowProvider>
  );
}

function KnowFlowCanvas() {
  const [workspaceSelection, setWorkspaceSelection] = useState<WorkspaceSelection>(() => readInitialWorkspaceSelection());
  const [bundle, setBundle] = useState<GraphBundle | null>(null);
  const [nodes, setNodes] = useNodesState<ConversationFlowNode>([]);
  const [edges, setEdges] = useEdgesState<ConversationFlowEdge>([]);
  const { fitView, screenToFlowPosition, setCenter } = useReactFlow<ConversationFlowNode, ConversationFlowEdge>();
  const [aiRunDefaults, setAiRunDefaults] = useState<AiRunDefaults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(() => readInitialInspectorWidth());
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState('');
  const [graphTitleDraft, setGraphTitleDraft] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingDeleteNodeIds, setPendingDeleteNodeIds] = useState<string[]>([]);
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [visibleBranchHighlightIdsByNodeId, setVisibleBranchHighlightIdsByNodeId] = useState<
    Record<string, string[]>
  >({});
  const [pendingBranchView, setPendingBranchView] = useState<{
    childNodeId: string;
    sourceNodeId: string;
  } | null>(null);
  const [highlightRevealRequest, setHighlightRevealRequest] = useState<{
    highlightId: string;
    nodeId: string;
    requestId: number;
  } | null>(null);
  const [readerSyncAnchor, setReaderSyncAnchor] = useState<ReaderSyncAnchor | null>(null);
  const isNodeDraggingRef = useRef(false);
  const manualConnectionStartedRef = useRef(false);
  const manualConnectionCompletedRef = useRef(false);
  const lastAutoFitGraphIdRef = useRef<string | null>(null);
  const canvasFrameRef = useRef<HTMLElement>(null);

  const clearCanvasFocus = useCallback(() => {
    setSelectedNodeId(null);
    setPendingBranchView(null);
    setPendingFocusNodeId(null);
    setVisibleBranchHighlightIdsByNodeId({});
  }, []);

  const refresh = useCallback(async (selectionOverride?: WorkspaceSelection) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextBundle = await loadGraphBundle(selectionOverride ?? workspaceSelection);
      const nextSelection = {
        graphId: nextBundle.activeGraph.id,
        projectId: nextBundle.activeProject.id,
      };
      setBundle(nextBundle);
      setWorkspaceSelection((currentSelection) =>
        workspaceSelectionsEqual(currentSelection, nextSelection) ? currentSelection : nextSelection,
      );
      persistWorkspaceSelection(nextSelection);
      return nextBundle;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load graph');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSelection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let isActive = true;

    getAiRunDefaults()
      .then((defaults) => {
        if (isActive) {
          setAiRunDefaults(defaults);
        }
      })
      .catch(() => {
        if (isActive) {
          setAiRunDefaults(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const graphTitle = bundle?.activeGraph.title ?? 'KnowFlow';
  const projectTitle = bundle?.activeProject.title ?? 'Workspace';
  const nodeCount = nodes.length;
  const edgeCount = bundle?.edges.length ?? edges.length;
  const selectedNode = useMemo(
    () => bundle?.nodes.find((node) => node.id === selectedNodeId),
    [bundle?.nodes, selectedNodeId],
  );
  const selectedNodeBranchContext = useMemo(
    () => findInboundBranchContext(bundle?.edges, selectedNodeId),
    [bundle?.edges, selectedNodeId],
  );
  const pendingDeleteNodeTitle = useMemo(() => {
    if (pendingDeleteNodeIds.length !== 1) {
      return null;
    }

    return bundle?.nodes.find((node) => node.id === pendingDeleteNodeIds[0])?.title ?? null;
  }, [bundle?.nodes, pendingDeleteNodeIds]);

  useEffect(() => {
    if (selectedNodeId && bundle && !bundle.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [bundle, selectedNodeId]);

  useEffect(() => {
    setProjectTitleDraft(bundle?.activeProject.title ?? '');
    setProjectDescriptionDraft(bundle?.activeProject.description ?? '');
    setGraphTitleDraft(bundle?.activeGraph.title ?? '');
  }, [
    bundle?.activeGraph.id,
    bundle?.activeGraph.title,
    bundle?.activeProject.description,
    bundle?.activeProject.id,
    bundle?.activeProject.title,
  ]);

  const onWorkspaceProjectChanged = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSelection = { graphId: null, projectId: event.target.value };
      clearCanvasFocus();
      setWorkspaceSelection(nextSelection);
      persistWorkspaceSelection(nextSelection);
    },
    [clearCanvasFocus],
  );

  const onWorkspaceGraphChanged = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (!bundle) {
        return;
      }

      const nextSelection = {
        graphId: event.target.value,
        projectId: bundle.activeProject.id,
      };
      clearCanvasFocus();
      setWorkspaceSelection(nextSelection);
      persistWorkspaceSelection(nextSelection);
    },
    [bundle, clearCanvasFocus],
  );

  const onCreateProject = useCallback(async () => {
    const nextProjectNumber = (bundle?.projects.length ?? 0) + 1;

    setIsSaving(true);
    setError(null);
    try {
      const project = await createProject({
        description: '',
        title: `Untitled Project ${nextProjectNumber}`,
      });
      const graph = await createGraph({
        projectId: project.id,
        title: 'Untitled Graph',
      });
      clearCanvasFocus();
      await refresh({ graphId: graph.id, projectId: project.id });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create project');
    } finally {
      setIsSaving(false);
    }
  }, [bundle?.projects.length, clearCanvasFocus, refresh]);

  const onCreateGraph = useCallback(async () => {
    if (!bundle) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const graph = await createGraph({
        projectId: bundle.activeProject.id,
        title: `Untitled Graph ${bundle.graphs.length + 1}`,
      });
      clearCanvasFocus();
      await refresh({ graphId: graph.id, projectId: bundle.activeProject.id });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create graph');
    } finally {
      setIsSaving(false);
    }
  }, [bundle, clearCanvasFocus, refresh]);

  const saveProjectTitle = useCallback(async () => {
    if (!bundle) {
      return;
    }

    const nextTitle = projectTitleDraft.trim();
    if (!nextTitle) {
      setProjectTitleDraft(bundle.activeProject.title);
      return;
    }
    if (nextTitle === bundle.activeProject.title) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const project = await updateProject(bundle.activeProject.id, { title: nextTitle });
      setBundle((currentBundle) => (currentBundle ? mergeProjectIntoBundle(currentBundle, project) : currentBundle));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save project title');
      setProjectTitleDraft(bundle.activeProject.title);
    } finally {
      setIsSaving(false);
    }
  }, [bundle, projectTitleDraft]);

  const saveProjectDescription = useCallback(async () => {
    if (!bundle) {
      return;
    }

    const nextDescription = projectDescriptionDraft.trim();
    const currentDescription = (bundle.activeProject.description ?? '').trim();
    if (nextDescription === currentDescription) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const project = await updateProject(bundle.activeProject.id, {
        description: nextDescription.length > 0 ? nextDescription : null,
      });
      setBundle((currentBundle) => (currentBundle ? mergeProjectIntoBundle(currentBundle, project) : currentBundle));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save project description');
      setProjectDescriptionDraft(bundle.activeProject.description ?? '');
    } finally {
      setIsSaving(false);
    }
  }, [bundle, projectDescriptionDraft]);

  const saveGraphTitle = useCallback(async () => {
    if (!bundle) {
      return;
    }

    const nextTitle = graphTitleDraft.trim();
    if (!nextTitle) {
      setGraphTitleDraft(bundle.activeGraph.title);
      return;
    }
    if (nextTitle === bundle.activeGraph.title) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const graph = await updateGraph(bundle.activeGraph.id, { title: nextTitle });
      setBundle((currentBundle) => (currentBundle ? mergeGraphIntoBundle(currentBundle, graph) : currentBundle));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save graph title');
      setGraphTitleDraft(bundle.activeGraph.title);
    } finally {
      setIsSaving(false);
    }
  }, [bundle, graphTitleDraft]);

  const onWorkspaceInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }, []);

  const onInspectorResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.round(window.innerWidth * 0.55);
      const nextWidth = clampNumber(window.innerWidth - moveEvent.clientX, INSPECTOR_MIN_WIDTH, maxWidth);
      setInspectorWidth(nextWidth);
      window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(nextWidth));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, []);

  const deleteNodesByIds = useCallback(
    async (nodeIds: string[]) => {
      const uniqueNodeIds = [...new Set(nodeIds)];
      if (uniqueNodeIds.length === 0) {
        return;
      }

      setIsSaving(true);
      setError(null);
      try {
        await Promise.all(uniqueNodeIds.map((nodeId) => deleteNode(nodeId)));
        setSelectedNodeId((currentSelectedNodeId) =>
          currentSelectedNodeId && uniqueNodeIds.includes(currentSelectedNodeId) ? null : currentSelectedNodeId,
        );
        setPendingBranchView((currentPendingBranchView) =>
          currentPendingBranchView &&
          (uniqueNodeIds.includes(currentPendingBranchView.childNodeId) ||
            uniqueNodeIds.includes(currentPendingBranchView.sourceNodeId))
            ? null
            : currentPendingBranchView,
        );
        await refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete node');
      } finally {
        setIsSaving(false);
      }
    },
    [refresh],
  );

  const onNodesChange: OnNodesChange<ConversationFlowNode> = useCallback(
    (changes: NodeChange<ConversationFlowNode>[]) => {
      const removeChanges = changes.filter(isRemoveNodeChange);
      const persistentChanges = changes.filter(
        (change) => !isRemoveNodeChange(change) && !isSelectionNodeChange(change),
      );

      if (persistentChanges.length > 0) {
        setNodes((currentNodes: ConversationFlowNode[]) =>
          applyNodeChanges<ConversationFlowNode>(persistentChanges, currentNodes),
        );
      }

      if (removeChanges.length > 0) {
        setPendingDeleteNodeIds([...new Set(removeChanges.map((change) => change.id))]);
      }

      const completedPositionChanges = persistentChanges.filter(isCompletedPositionChange);

      if (completedPositionChanges.length > 0) {
        setBundle((currentBundle) =>
          currentBundle
            ? completedPositionChanges.reduce(
                (nextBundle, change) =>
                  mergeNodeLayoutIntoBundle(nextBundle, change.id, {
                    x: change.position.x,
                    y: change.position.y,
                  }),
                currentBundle,
              )
            : currentBundle,
        );
      }

      for (const change of completedPositionChanges) {
        void updateNodeLayout(change.id, {
          x: change.position!.x,
          y: change.position!.y,
        })
          .then((updatedNode) => {
            setBundle((currentBundle) =>
              currentBundle
                ? {
                    ...currentBundle,
                    nodes: currentBundle.nodes.map((node) => (node.id === change.id ? updatedNode : node)),
                  }
                : currentBundle,
            );
          })
          .catch((saveError) => {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save node position');
          });
      }
    },
    [deleteNodesByIds, setNodes],
  );

  const onCreateNode = useCallback(async () => {
    if (!bundle) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const nextNodeNumber = nodes.length + 1;
      const node = await createNode({
        graphId: bundle.activeGraph.id,
        layout: {
          height: 520,
          width: 560,
          ...newNodePositionFromViewport(canvasFrameRef.current, screenToFlowPosition),
        },
        title: `Conversation ${nextNodeNumber}`,
      });
      setBundle((currentBundle) =>
        currentBundle
          ? {
              ...currentBundle,
              highlightsByMessageId: {
                ...currentBundle.highlightsByMessageId,
              },
              messagesByNodeId: {
                ...currentBundle.messagesByNodeId,
                [node.id]: [],
              },
              nodes: [...currentBundle.nodes, node],
            }
          : currentBundle,
      );
      setSelectedNodeId(node.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create node');
    } finally {
      setIsSaving(false);
    }
  }, [bundle, nodes.length, screenToFlowPosition]);

  const onBranchCreated = useCallback(
    async (childNodeId: string, sourceNodeId: string) => {
      await refresh();
      setSelectedNodeId(sourceNodeId);
      setPendingBranchView({ childNodeId, sourceNodeId });
    },
    [refresh],
  );

  const onNodeMessagesChanged = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const onBranchTargetSelected = useCallback((targetNodeId: string, _sourceNodeId: string) => {
    setSelectedNodeId(targetNodeId);
    setPendingBranchView(null);
    setPendingFocusNodeId(targetNodeId);
  }, []);

  const onBranchSourceSelected = useCallback((sourceNodeId: string, highlightId: string) => {
    setSelectedNodeId(sourceNodeId);
    setPendingBranchView(null);
    setPendingFocusNodeId(sourceNodeId);
    setHighlightRevealRequest((currentRequest) => ({
      highlightId,
      nodeId: sourceNodeId,
      requestId: (currentRequest?.requestId ?? 0) + 1,
    }));
  }, []);

  const onEdgeLabelChanged = useCallback(async (edgeId: string, label: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const updatedEdge = await updateEdgeLabel(edgeId, label);
      setBundle((currentBundle) =>
        currentBundle
          ? {
              ...currentBundle,
              edges: currentBundle.edges.map((edge) => (edge.id === edgeId ? updatedEdge : edge)),
            }
          : currentBundle,
      );
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : 'Unable to save edge label');
      throw labelError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const onEdgeDeleteRequested = useCallback(async (edgeId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteEdge(edgeId);
      setBundle((currentBundle) =>
        currentBundle
          ? {
              ...currentBundle,
              edges: currentBundle.edges.filter((edge) => edge.id !== edgeId),
            }
          : currentBundle,
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete edge');
      throw deleteError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const onNodeDetailsChanged = useCallback(async (nodeId: string, input: { title?: string; summary?: string | null }) => {
    setIsSaving(true);
    setError(null);
    try {
      const updatedNode = await updateNodeDetails(nodeId, input);
      setBundle((currentBundle) =>
        currentBundle
          ? {
              ...currentBundle,
              nodes: currentBundle.nodes.map((node) => (node.id === nodeId ? updatedNode : node)),
            }
          : currentBundle,
      );
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : 'Unable to save node details');
      throw detailsError;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const onNodeResizeEnded = useCallback(
    async (nodeId: string, layout: Required<NodeLayout>) => {
      setIsSaving(true);
      setError(null);
      try {
        const updatedNode = await updateNodeLayout(nodeId, layout);
        setBundle((currentBundle) =>
          currentBundle
            ? {
                ...currentBundle,
                nodes: currentBundle.nodes.map((node) => (node.id === nodeId ? updatedNode : node)),
              }
            : currentBundle,
        );
      } catch (resizeError) {
        setError(resizeError instanceof Error ? resizeError.message : 'Unable to save node size');
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const onNodeDeleteRequested = useCallback(
    (nodeId: string) => {
      setPendingDeleteNodeIds([nodeId]);
    },
    [],
  );

  const onConfirmNodeDelete = useCallback(async () => {
    const nodeIds = pendingDeleteNodeIds;
    setPendingDeleteNodeIds([]);
    await deleteNodesByIds(nodeIds);
  }, [deleteNodesByIds, pendingDeleteNodeIds]);

  const onVisibleBranchHighlightsChanged = useCallback((nodeId: string, visibleHighlightIds: string[]) => {
    setVisibleBranchHighlightIdsByNodeId((currentVisibleIds) => {
      const uniqueSortedVisibleIds = [...new Set(visibleHighlightIds)].sort();
      const currentNodeVisibleIds = currentVisibleIds[nodeId] ?? [];
      if (arraysEqual(currentNodeVisibleIds, uniqueSortedVisibleIds)) {
        return currentVisibleIds;
      }

      return {
        ...currentVisibleIds,
        [nodeId]: uniqueSortedVisibleIds,
      };
    });
  }, []);

  const onReaderSyncAnchorChanged = useCallback((anchor: ReaderSyncAnchor) => {
    setReaderSyncAnchor((currentAnchor) => {
      if (
        currentAnchor?.nodeId === anchor.nodeId &&
        currentAnchor.messageId === anchor.messageId &&
        currentAnchor.source === anchor.source &&
        Math.abs(currentAnchor.ratio - anchor.ratio) < 0.04
      ) {
        return currentAnchor;
      }

      return anchor;
    });
  }, []);

  useEffect(() => {
    if (!bundle) {
      setNodes([]);
      return;
    }

    setNodes(
      toReactFlowNodes(
        bundle.nodes,
        bundle,
        {
          onBranchCreated,
          onBranchSourceSelected,
          onBranchTargetSelected,
          onNodeDetailsChanged,
          onNodeDeleteRequested,
          onNodeMessagesChanged,
          onNodeResizeEnded,
          onReaderSyncAnchorChanged,
          onVisibleBranchHighlightsChanged,
          readerSyncAnchor,
        },
        selectedNodeId,
        highlightRevealRequest,
      ),
    );
  }, [
    bundle,
    onBranchCreated,
    onBranchSourceSelected,
    onBranchTargetSelected,
    onNodeDetailsChanged,
    onNodeDeleteRequested,
    onNodeMessagesChanged,
    onNodeResizeEnded,
    onReaderSyncAnchorChanged,
    onVisibleBranchHighlightsChanged,
    highlightRevealRequest,
    readerSyncAnchor,
    selectedNodeId,
    setNodes,
  ]);

  useEffect(() => {
    setEdges(
      bundle
        ? toReactFlowEdges(
            bundle.edges,
            { onEdgeDeleteRequested, onEdgeLabelChanged },
            selectedNodeId,
            bundle.nodes,
            visibleBranchHighlightIdsByNodeId,
          )
        : [],
    );
  }, [
    bundle,
    onEdgeDeleteRequested,
    onEdgeLabelChanged,
    selectedNodeId,
    setEdges,
    visibleBranchHighlightIdsByNodeId,
  ]);

  useEffect(() => {
    if (!pendingBranchView) {
      return;
    }

    const hasSourceNode = nodes.some((node) => node.id === pendingBranchView.sourceNodeId);
    const hasChildNode = nodes.some((node) => node.id === pendingBranchView.childNodeId);
    if (!hasSourceNode || !hasChildNode) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fitView({
        duration: 320,
        nodes: [{ id: pendingBranchView.sourceNodeId }, { id: pendingBranchView.childNodeId }],
        padding: 0.3,
      });
      setPendingBranchView(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fitView, nodes, pendingBranchView]);

  useEffect(() => {
    const activeGraphId = bundle?.activeGraph.id;
    if (!activeGraphId || nodes.length === 0 || lastAutoFitGraphIdRef.current === activeGraphId) {
      return;
    }

    lastAutoFitGraphIdRef.current = activeGraphId;
    const timeoutId = window.setTimeout(() => {
      void fitView(GRAPH_ENTRY_FIT_VIEW_OPTIONS);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [bundle?.activeGraph.id, fitView, nodes.length]);

  useEffect(() => {
    if (!pendingFocusNodeId) {
      return;
    }

    const targetNode = nodes.find((node) => node.id === pendingFocusNodeId);
    if (!targetNode) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const width = numberOrDefault(targetNode.style?.width, numberOrDefault(targetNode.data.layout?.width, 560));
      const height = numberOrDefault(targetNode.style?.height, numberOrDefault(targetNode.data.layout?.height, 520));

      void setCenter(targetNode.position.x + width / 2, targetNode.position.y + height / 2, {
        duration: 320,
        zoom: 0.95,
      });
      setPendingFocusNodeId(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [nodes, pendingFocusNodeId, setCenter]);

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    manualConnectionStartedRef.current = isManualHandleId(params.handleId);
    manualConnectionCompletedRef.current = false;
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>(() => {
    window.setTimeout(() => {
      if (manualConnectionStartedRef.current && !manualConnectionCompletedRef.current) {
        setError('Drop on another node side handle to create a manual relationship edge.');
      }
      manualConnectionStartedRef.current = false;
      manualConnectionCompletedRef.current = false;
    }, 0);
  }, []);

  const onConnect = useCallback(
    async (connection: Connection) => {
      manualConnectionCompletedRef.current = true;
      if (!bundle || !connection.source || !connection.target) {
        return;
      }
      if (connection.source === connection.target) {
        setError('Manual relationship edges need two different nodes.');
        return;
      }
      if (!isManualHandleId(connection.sourceHandle) || !isManualHandleId(connection.targetHandle)) {
        setError('Create manual relationship edges from node side handles.');
        return;
      }

      setIsSaving(true);
      setError(null);
      try {
        const edge = await createManualEdge({
          graphId: bundle.activeGraph.id,
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        });
        setBundle((currentBundle) =>
          currentBundle
            ? {
                ...currentBundle,
                edges: [...currentBundle.edges, edge],
              }
            : currentBundle,
        );
      } catch (connectError) {
        setError(connectError instanceof Error ? connectError.message : 'Unable to create edge');
      } finally {
        setIsSaving(false);
      }
    },
    [bundle],
  );

  const statusText = useMemo(() => {
    if (isLoading) {
      return 'Loading graph';
    }
    if (isSaving) {
      return 'Saving';
    }
    return `${nodeCount} nodes, ${edgeCount} edges`;
  }, [edgeCount, isLoading, isSaving, nodeCount]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="workspace-manager" aria-label="Workspace">
          <div className="workspace-manager__row">
            <span className="workspace-manager__label">Project</span>
            <select
              aria-label="Switch project"
              className="workspace-manager__select"
              disabled={!bundle || isLoading}
              onChange={onWorkspaceProjectChanged}
              value={bundle?.activeProject.id ?? ''}
            >
              {bundle?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <input
              aria-label="Project title"
              className="workspace-manager__input workspace-manager__input--title"
              disabled={!bundle || isSaving}
              onBlur={() => void saveProjectTitle()}
              onChange={(event) => setProjectTitleDraft(event.target.value)}
              onKeyDown={onWorkspaceInputKeyDown}
              placeholder={projectTitle}
              value={projectTitleDraft}
            />
            <button
              className="secondary-button"
              disabled={isSaving || isLoading}
              onClick={() => void onCreateProject()}
              type="button"
            >
              <Plus size={15} />
              Project
            </button>
          </div>
          <div className="workspace-manager__row">
            <span className="workspace-manager__label">Graph</span>
            <select
              aria-label="Switch graph"
              className="workspace-manager__select"
              disabled={!bundle || isLoading}
              onChange={onWorkspaceGraphChanged}
              value={bundle?.activeGraph.id ?? ''}
            >
              {bundle?.graphs.map((graph) => (
                <option key={graph.id} value={graph.id}>
                  {graph.title}
                </option>
              ))}
            </select>
            <input
              aria-label="Graph title"
              className="workspace-manager__input workspace-manager__input--title"
              disabled={!bundle || isSaving}
              onBlur={() => void saveGraphTitle()}
              onChange={(event) => setGraphTitleDraft(event.target.value)}
              onKeyDown={onWorkspaceInputKeyDown}
              placeholder={graphTitle}
              value={graphTitleDraft}
            />
            <button
              className="secondary-button"
              disabled={!bundle || isSaving || isLoading}
              onClick={() => void onCreateGraph()}
              type="button"
            >
              <Plus size={15} />
              Graph
            </button>
          </div>
          <div className="workspace-manager__row workspace-manager__row--description">
            <span className="workspace-manager__label">Details</span>
            <input
              aria-label="Project description"
              className="workspace-manager__input workspace-manager__input--description"
              disabled={!bundle || isSaving}
              onBlur={() => void saveProjectDescription()}
              onChange={(event) => setProjectDescriptionDraft(event.target.value)}
              onKeyDown={onWorkspaceInputKeyDown}
              placeholder="Project description"
              value={projectDescriptionDraft}
            />
          </div>
        </div>
        <div className="topbar__actions">
          {aiRunDefaults ? (
            <span className="ai-status-pill" title={`Backend AI defaults: ${aiRunDefaults.provider} / ${aiRunDefaults.model}`}>
              AI: {aiRunDefaults.provider} / {aiRunDefaults.model}
            </span>
          ) : null}
          <span className="status-pill">{statusText}</span>
          <button aria-label="Refresh graph" className="icon-button" onClick={() => void refresh()} type="button">
            <RefreshCw size={18} />
          </button>
          <button className="primary-button" disabled={!bundle || isSaving} onClick={onCreateNode} type="button">
            <Plus size={18} />
            Node
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError(null)} type="button">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div
        className={`workspace ${selectedNode ? 'has-inspector' : ''}`}
        style={{ '--inspector-width': `${inspectorWidth}px` } as CSSProperties}
      >
        <section className="canvas-frame" aria-label="KnowFlow graph canvas" ref={canvasFrameRef}>
          <ReactFlow
            edges={edges}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={INITIAL_FIT_VIEW_OPTIONS}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Bezier}
            minZoom={0.2}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onConnectStart={onConnectStart}
            zIndexMode="manual"
            nodeClickDistance={5}
            onNodeClick={(_, node) => {
              if (!isNodeDraggingRef.current) {
                setSelectedNodeId(node.id);
                setPendingFocusNodeId(node.id);
              }
            }}
            onNodeDragStart={() => {
              isNodeDraggingRef.current = true;
            }}
            onNodeDragStop={() => {
              window.setTimeout(() => {
                isNodeDraggingRef.current = false;
              }, 0);
            }}
            onNodesChange={onNodesChange}
            onPaneClick={() => setSelectedNodeId(null)}
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </section>
        {selectedNode ? (
          <>
            <div
              aria-label="Resize inspector"
              className="inspector-resize-handle"
              onPointerDown={onInspectorResizeStart}
              role="separator"
              tabIndex={0}
            />
            <ConversationPanel
              branchContext={selectedNodeBranchContext}
              node={selectedNode}
              onBranchCreated={onBranchCreated}
              onBranchSourceSelected={onBranchSourceSelected}
              onNodeMessagesChanged={onNodeMessagesChanged}
              onReaderSyncAnchorChanged={onReaderSyncAnchorChanged}
              readerSyncAnchor={readerSyncAnchor}
              readOnly
            />
          </>
        ) : null}
      </div>
      {pendingDeleteNodeIds.length > 0 ? (
        <DeleteConfirmDialog
          isDeleting={isSaving}
          nodeCount={pendingDeleteNodeIds.length}
          nodeTitle={pendingDeleteNodeTitle}
          onCancel={() => setPendingDeleteNodeIds([])}
          onConfirm={() => void onConfirmNodeDelete()}
        />
      ) : null}
    </main>
  );
}

function DeleteConfirmDialog({
  isDeleting,
  nodeCount,
  nodeTitle,
  onCancel,
  onConfirm,
}: {
  isDeleting: boolean;
  nodeCount: number;
  nodeTitle: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = nodeCount === 1 ? 'Delete node?' : `Delete ${nodeCount} nodes?`;
  const description =
    nodeCount === 1
      ? `This will delete ${nodeTitle ? `"${nodeTitle}"` : 'this node'} and its connected edges.`
      : 'This will delete the selected nodes and their connected edges.';

  return (
    <div className="confirm-layer" role="presentation" onMouseDown={onCancel}>
      <section
        aria-describedby="delete-confirm-description"
        aria-modal="true"
        className="confirm-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <span className="confirm-dialog__icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </span>
        <div className="confirm-dialog__copy">
          <h2>{title}</h2>
          <p id="delete-confirm-description">{description}</p>
        </div>
        <div className="confirm-dialog__actions">
          <button className="confirm-dialog__button" disabled={isDeleting} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="confirm-dialog__button confirm-dialog__button--danger"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

function findInboundBranchContext(edges: DomainEdge[] | undefined, selectedNodeId: string | null) {
  if (!edges || !selectedNodeId) {
    return undefined;
  }

  const inboundBranch = edges.find((edge) => edge.targetNodeId === selectedNodeId && edge.type === 'BRANCH');
  if (!inboundBranch?.label) {
    return undefined;
  }

  return {
    highlightId: inboundBranch.sourceHighlightId ?? undefined,
    sourceNodeId: inboundBranch.sourceNodeId,
    text: inboundBranch.label,
  };
}

function isCompletedPositionChange(
  change: NodeChange<ConversationFlowNode>,
): change is NodePositionChange & { position: { x: number; y: number } } {
  return change.type === 'position' && change.dragging === false && Boolean(change.position);
}

function isRemoveNodeChange(
  change: NodeChange<ConversationFlowNode>,
): change is NodeChange<ConversationFlowNode> & { id: string; type: 'remove' } {
  return change.type === 'remove';
}

function isSelectionNodeChange(change: NodeChange<ConversationFlowNode>) {
  return change.type === 'select';
}

function newNodePositionFromViewport(
  canvasElement: HTMLElement | null,
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number },
) {
  const bounds = canvasElement?.getBoundingClientRect();
  const center = screenToFlowPosition({
    x: (bounds?.left ?? 0) + (bounds?.width ?? window.innerWidth) / 2,
    y: (bounds?.top ?? 0) + (bounds?.height ?? window.innerHeight) / 2,
  });

  return {
    x: center.x - 280,
    y: center.y - 260,
  };
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function readInitialInspectorWidth() {
  try {
    const storedWidth = Number(localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY));
    if (Number.isFinite(storedWidth)) {
      return clampNumber(storedWidth, INSPECTOR_MIN_WIDTH, Math.round(window.innerWidth * 0.55));
    }
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }

  return INSPECTOR_DEFAULT_WIDTH;
}

function mergeNodeLayoutIntoBundle(bundle: GraphBundle, nodeId: string, layout: NodeLayout): GraphBundle {
  return {
    ...bundle,
    nodes: bundle.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            layout: {
              ...(node.layout ?? {}),
              ...layout,
            },
          }
        : node,
    ),
  };
}

function mergeProjectIntoBundle(bundle: GraphBundle, project: Project): GraphBundle {
  return {
    ...bundle,
    activeProject: bundle.activeProject.id === project.id ? project : bundle.activeProject,
    projects: bundle.projects.map((existingProject) => (existingProject.id === project.id ? project : existingProject)),
  };
}

function mergeGraphIntoBundle(bundle: GraphBundle, graph: Graph): GraphBundle {
  return {
    ...bundle,
    activeGraph: bundle.activeGraph.id === graph.id ? graph : bundle.activeGraph,
    graphs: bundle.graphs.map((existingGraph) => (existingGraph.id === graph.id ? graph : existingGraph)),
  };
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readInitialWorkspaceSelection(): WorkspaceSelection {
  const queryParams = new URLSearchParams(window.location.search);
  const querySelection = {
    graphId: queryParams.get('graphId'),
    projectId: queryParams.get('projectId'),
  };

  if (querySelection.projectId || querySelection.graphId) {
    return querySelection;
  }

  try {
    const storedSelection = localStorage.getItem(WORKSPACE_SELECTION_STORAGE_KEY);
    return storedSelection ? (JSON.parse(storedSelection) as WorkspaceSelection) : {};
  } catch {
    return {};
  }
}

function persistWorkspaceSelection(selection: WorkspaceSelection) {
  try {
    localStorage.setItem(WORKSPACE_SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }

  const url = new URL(window.location.href);
  updateSearchParam(url, 'projectId', selection.projectId);
  updateSearchParam(url, 'graphId', selection.graphId);
  window.history.replaceState(null, '', url);
}

function updateSearchParam(url: URL, key: string, value?: string | null) {
  if (value) {
    url.searchParams.set(key, value);
    return;
  }

  url.searchParams.delete(key);
}

function workspaceSelectionsEqual(left: WorkspaceSelection, right: WorkspaceSelection) {
  return (left.projectId ?? null) === (right.projectId ?? null) && (left.graphId ?? null) === (right.graphId ?? null);
}
