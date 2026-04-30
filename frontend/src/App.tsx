import {
  Background,
  Connection,
  Controls,
  MiniMap,
  NodeChange,
  NodePositionChange,
  OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConversationNode } from './components/ConversationNode';
import { ConversationPanel } from './components/ConversationPanel';
import { EditableEdge } from './components/EditableEdge';
import {
  createManualEdge,
  createNode,
  deleteNode,
  loadGraphBundle,
  updateEdgeLabel,
  updateNodeDetails,
  updateNodeLayout,
} from './lib/api';
import { DomainEdge, GraphBundle, NodeLayout } from './lib/domain';
import {
  ConversationFlowEdge,
  ConversationFlowNode,
  toReactFlowEdges,
  toReactFlowNodes,
} from './lib/reactFlowAdapter';

const nodeTypes = {
  conversation: ConversationNode,
};

const edgeTypes = {
  editable: EditableEdge,
};

export function App() {
  return (
    <ReactFlowProvider>
      <KnowFlowCanvas />
    </ReactFlowProvider>
  );
}

function KnowFlowCanvas() {
  const [bundle, setBundle] = useState<GraphBundle | null>(null);
  const [nodes, setNodes] = useNodesState<ConversationFlowNode>([]);
  const [edges, setEdges] = useEdgesState<ConversationFlowEdge>([]);
  const { fitView, screenToFlowPosition } = useReactFlow<ConversationFlowNode, ConversationFlowEdge>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingBranchView, setPendingBranchView] = useState<{
    childNodeId: string;
    sourceNodeId: string;
  } | null>(null);
  const isNodeDraggingRef = useRef(false);
  const canvasFrameRef = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextBundle = await loadGraphBundle();
      setBundle(nextBundle);
      return nextBundle;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load graph');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setEdges]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const graphTitle = bundle?.activeGraph.title ?? 'KnowFlow';
  const projectTitle = bundle?.activeProject.title ?? 'Workspace';
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const selectedNode = useMemo(
    () => bundle?.nodes.find((node) => node.id === selectedNodeId),
    [bundle?.nodes, selectedNodeId],
  );
  const selectedNodeBranchContext = useMemo(
    () => findInboundBranchContext(bundle?.edges, selectedNodeId),
    [bundle?.edges, selectedNodeId],
  );

  useEffect(() => {
    if (selectedNodeId && bundle && !bundle.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [bundle, selectedNodeId]);

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
        void deleteNodesByIds(removeChanges.map((change) => change.id));
      }

      const completedPositionChanges = persistentChanges.filter(isCompletedPositionChange);

      for (const change of completedPositionChanges) {
        void updateNodeLayout(change.id, {
          x: change.position!.x,
          y: change.position!.y,
        }).catch((saveError) => {
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

  const onBranchTargetSelected = useCallback((targetNodeId: string, sourceNodeId: string) => {
    setSelectedNodeId(targetNodeId);
    setPendingBranchView({ childNodeId: targetNodeId, sourceNodeId });
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
    async (nodeId: string) => {
      await deleteNodesByIds([nodeId]);
    },
    [deleteNodesByIds],
  );

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
          onBranchTargetSelected,
          onNodeDetailsChanged,
          onNodeDeleteRequested,
          onNodeMessagesChanged,
          onNodeResizeEnded,
        },
        selectedNodeId,
      ),
    );
  }, [
    bundle,
    onBranchCreated,
    onBranchTargetSelected,
    onNodeDetailsChanged,
    onNodeDeleteRequested,
    onNodeMessagesChanged,
    onNodeResizeEnded,
    selectedNodeId,
    setNodes,
  ]);

  useEffect(() => {
    setEdges(bundle ? toReactFlowEdges(bundle.edges, { onEdgeLabelChanged }) : []);
  }, [bundle, onEdgeLabelChanged, setEdges]);

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

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!bundle || !connection.source || !connection.target) {
        return;
      }
      if (connection.source === selectedNodeId || connection.target === selectedNodeId) {
        setError('Collapse expanded nodes before creating a manual relationship edge.');
        return;
      }
      if (connection.sourceHandle?.startsWith('branch-highlight-')) {
        setError('Branch points are reserved for branch navigation, not manual relationship edges.');
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
    [bundle, selectedNodeId],
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
        <div className="topbar__title">
          <span>{projectTitle}</span>
          <h1>{graphTitle}</h1>
        </div>
        <div className="topbar__actions">
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

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="workspace">
        <section className="canvas-frame" aria-label="KnowFlow graph canvas" ref={canvasFrameRef}>
          <ReactFlow
            edges={edges}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.2}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onConnect={onConnect}
            nodeClickDistance={5}
            onNodeClick={(_, node) => {
              if (!isNodeDraggingRef.current) {
                setSelectedNodeId(node.id);
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
        <ConversationPanel
          branchContext={selectedNodeBranchContext}
          node={selectedNode}
          onBranchCreated={onBranchCreated}
          onNodeMessagesChanged={onNodeMessagesChanged}
          readOnly
        />
      </div>
    </main>
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
