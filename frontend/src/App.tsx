import {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  NodeChange,
  NodePositionChange,
  OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConversationNode } from './components/ConversationNode';
import { createManualEdge, createNode, loadGraphBundle, updateNodeLayout } from './lib/api';
import { GraphBundle } from './lib/domain';
import { ConversationFlowNode, toReactFlowEdges, toReactFlowNodes } from './lib/reactFlowAdapter';

const nodeTypes = {
  conversation: ConversationNode,
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
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextBundle = await loadGraphBundle();
      setBundle(nextBundle);
      setNodes(toReactFlowNodes(nextBundle.nodes));
      setEdges(toReactFlowEdges(nextBundle.edges));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load graph');
    } finally {
      setIsLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const graphTitle = bundle?.activeGraph.title ?? 'KnowFlow';
  const projectTitle = bundle?.activeProject.title ?? 'Workspace';
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const onNodesChange: OnNodesChange<ConversationFlowNode> = useCallback(
    (changes: NodeChange<ConversationFlowNode>[]) => {
      setNodes((currentNodes: ConversationFlowNode[]) =>
        applyNodeChanges<ConversationFlowNode>(changes, currentNodes),
      );

      const completedPositionChanges = changes.filter(isCompletedPositionChange);

      for (const change of completedPositionChanges) {
        void updateNodeLayout(change.id, {
          x: change.position!.x,
          y: change.position!.y,
        }).catch((saveError) => {
          setError(saveError instanceof Error ? saveError.message : 'Unable to save node position');
        });
      }
    },
    [setNodes],
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
          height: 180,
          width: 280,
          x: 100 + nextNodeNumber * 36,
          y: 120 + nextNodeNumber * 28,
        },
        title: `Conversation ${nextNodeNumber}`,
      });
      setNodes((currentNodes: ConversationFlowNode[]) => [...currentNodes, ...toReactFlowNodes([node])]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create node');
    } finally {
      setIsSaving(false);
    }
  }, [bundle, nodes.length, setNodes]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!bundle || !connection.source || !connection.target) {
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
        setEdges((currentEdges: Edge[]) => [...currentEdges, ...toReactFlowEdges([edge])]);
      } catch (connectError) {
        setError(connectError instanceof Error ? connectError.message : 'Unable to create edge');
      } finally {
        setIsSaving(false);
      }
    },
    [bundle, setEdges],
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
          <button aria-label="Refresh graph" className="icon-button" onClick={refresh} type="button">
            <RefreshCw size={18} />
          </button>
          <button className="primary-button" disabled={!bundle || isSaving} onClick={onCreateNode} type="button">
            <Plus size={18} />
            Node
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="canvas-frame" aria-label="KnowFlow graph canvas">
        <ReactFlow
          edges={edges}
          fitView
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={onConnect}
          onNodesChange={onNodesChange}
        >
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </section>
    </main>
  );
}

function isCompletedPositionChange(
  change: NodeChange<ConversationFlowNode>,
): change is NodePositionChange & { position: { x: number; y: number } } {
  return change.type === 'position' && change.dragging === false && Boolean(change.position);
}
