import type { XYPosition } from '@xyflow/react';
import type { WorkflowNode, StepNodeData } from '@/types/workflow';
import type { StepDefinition } from '@/types/step';

let idCounter = 0;

export function generateId(): string {
  return `step_${Date.now()}_${++idCounter}`;
}

export function createNode(stepDef: StepDefinition, position: XYPosition): WorkflowNode {
  const defaultConfig: Record<string, unknown> = {};
  for (const param of stepDef.parameters) {
    if (param.default !== undefined) {
      defaultConfig[param.name] = param.default;
    }
  }

  return {
    id: generateId(),
    type: 'stepNode',
    position,
    data: {
      stepType: stepDef.type,
      label: stepDef.label,
      config: defaultConfig,
      color: stepDef.color,
      icon: stepDef.icon,
    },
  };
}
