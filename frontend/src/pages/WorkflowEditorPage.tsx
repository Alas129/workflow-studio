import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkstationLayout } from '@/layouts/WorkstationLayout';
import { LeftPanel } from '@/components/left-panel/LeftPanel';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { StepConfigPanel } from '@/components/canvas/StepConfigPanel';
import { RightPanel } from '@/components/right-panel/RightPanel';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useSaveWorkflow, useWorkflows } from '@/api/queries/useWorkflows';
import { Save, FolderOpen, Plus, Workflow, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkflowDefinition } from '@/types/workflow';

export function WorkflowEditorPage() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}

function WorkflowEditorInner() {
  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const variables = useWorkflowStore((s) => s.variables);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const clearWorkflow = useWorkflowStore((s) => s.clearWorkflow);

  const saveWorkflowMutation = useSaveWorkflow();
  const { data: workflows } = useWorkflows();
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = async () => {
    if (nodes.length === 0) return;

    const id = workflowId || workflowName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled';
    const wf: WorkflowDefinition = {
      id,
      name: workflowName || 'Untitled Workflow',
      description: '',
      version: 1,
      tags: [],
      variables,
      steps: nodes.map((n) => ({
        id: n.id,
        type: n.data.stepType as string,
        label: n.data.label as string,
        params: (n.data.config as Record<string, unknown>) || {},
        position: n.position,
      })),
      connections: edges.map((e) => ({
        source_step_id: e.source,
        source_output: 'default',
        target_step_id: e.target,
        target_input: 'default',
      })),
    };

    try {
      await saveWorkflowMutation.mutateAsync(wf);
      loadWorkflow(id, wf.name, '', variables, nodes, edges);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus('Save failed');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleLoad = (wf: WorkflowDefinition) => {
    const newNodes = wf.steps.map((s) => ({
      id: s.id,
      type: 'stepNode' as const,
      position: s.position,
      data: {
        stepType: s.type,
        label: s.label,
        config: s.params,
        color: getStepColor(s.type),
        icon: getStepIcon(s.type),
      },
    }));

    const newEdges = wf.connections.map((c, i) => ({
      id: `edge-${c.source_step_id}-${c.target_step_id}-${i}`,
      source: c.source_step_id,
      target: c.target_step_id,
    }));

    loadWorkflow(wf.id, wf.name, wf.description, wf.variables, newNodes, newEdges);
    setShowWorkflowList(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showWorkflowList) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown="workflows"]')) {
        setShowWorkflowList(false);
      }
    };
    document.addEventListener('click', handler, { capture: true });
    return () => document.removeEventListener('click', handler, { capture: true });
  }, [showWorkflowList]);

  return (
    <WorkstationLayout
      header={
        <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
          <Workflow size={20} className="text-blue-600" />
          <input
            className="text-sm font-semibold bg-transparent border-none outline-none w-48"
            value={workflowName}
            onChange={(e) =>
              useWorkflowStore.setState({ workflowName: e.target.value })
            }
            placeholder="Workflow Name"
          />

          {workflowId && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {workflowId}
            </span>
          )}

          <div className="flex-1" />

          <Link
            to="/history"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            <History size={14} /> History
          </Link>

          <div className="relative" data-dropdown="workflows">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowWorkflowList(!showWorkflowList);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              <FolderOpen size={14} /> Open
            </button>
            {showWorkflowList && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                {workflows?.length ? (
                  workflows.map((wf) => (
                    <button
                      key={wf.id}
                      onClick={() => handleLoad(wf)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="font-medium text-gray-800">{wf.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {wf.steps.length} steps &middot; {wf.id}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    No saved workflows yet
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => { clearWorkflow(); setShowWorkflowList(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
          >
            <Plus size={14} /> New
          </button>

          <button
            onClick={handleSave}
            disabled={nodes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {saveStatus || 'Save'}
          </button>
        </header>
      }
      left={<LeftPanel />}
      center={
        <>
          <WorkflowCanvas />
          <StepConfigPanel />
        </>
      }
      right={<RightPanel />}
    />
  );
}

// Helper maps for step type -> color/icon
const stepColorMap: Record<string, string> = {
  http_request: '#4A90D9',
  llm_request: '#7C3AED',
  expand_matrix: '#059669',
  load_targets: '#059669',
  inject_variables: '#D97706',
  summarize_results: '#DC2626',
  gcp_config: '#4285F4',
};

const stepIconMap: Record<string, string> = {
  http_request: 'globe',
  llm_request: 'bot',
  expand_matrix: 'grid-3x3',
  load_targets: 'file-input',
  inject_variables: 'replace',
  summarize_results: 'bar-chart-3',
  gcp_config: 'cloud',
};

function getStepColor(type: string): string {
  return stepColorMap[type] || '#4A90D9';
}

function getStepIcon(type: string): string {
  return stepIconMap[type] || 'globe';
}
