import { useCallback, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/stores/workflowStore';
import { useUIStore } from '@/stores/uiStore';
import { createNode } from '@/lib/nodeFactory';
import type { StepDefinition } from '@/types/step';
import { StepNode } from './nodes/StepNode';

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

export function WorkflowCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const selectNode = useUIStore((s) => s.selectNode);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const stepDefJson = event.dataTransfer.getData('application/workflow-step');
      if (!stepDefJson) return;

      try {
        const stepDef: StepDefinition = JSON.parse(stepDefJson);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode = createNode(stepDef, position);
        addNode(newNode);
        selectNode(newNode.id);
      } catch (err) {
        console.error('Drop error:', err);
      }
    },
    [addNode, selectNode, screenToFlowPosition],
  );

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          className="!bg-white !border-gray-200"
          nodeColor="#94a3b8"
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
    </div>
  );
}
