import type { XYPosition } from '@xyflow/react';
import type { WorkflowNode } from '@/types/workflow';
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

/** Create a node with pre-filled config (e.g., from cURL import). */
export function createNodeWithConfig(
  stepType: string,
  label: string,
  config: Record<string, unknown>,
  position: XYPosition,
  color?: string,
  icon?: string,
): WorkflowNode {
  return {
    id: generateId(),
    type: 'stepNode',
    position,
    data: {
      stepType,
      label,
      config,
      color: color ?? '#4A90D9',
      icon: icon ?? 'globe',
    },
  };
}
