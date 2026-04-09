import { create } from 'zustand';

type LeftPanelTab = 'steps' | 'presets';
type RightPanelTab = 'dashboard' | 'results' | 'errors' | 'timeline';

interface UIState {
  selectedNodeId: string | null;
  leftPanelTab: LeftPanelTab;
  rightPanelTab: RightPanelTab;
  configPanelOpen: boolean;
  leftPanelWidth: number;
  rightPanelWidth: number;

  selectNode: (nodeId: string | null) => void;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setConfigPanelOpen: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedNodeId: null,
  leftPanelTab: 'steps',
  rightPanelTab: 'dashboard',
  configPanelOpen: false,
  leftPanelWidth: 280,
  rightPanelWidth: 360,

  selectNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      configPanelOpen: nodeId !== null,
    });
  },

  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
  setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.max(240, Math.min(480, width)) }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(280, Math.min(520, width)) }),
}));
