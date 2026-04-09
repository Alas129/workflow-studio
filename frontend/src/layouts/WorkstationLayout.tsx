import { useCallback, useRef, type PointerEvent, type ReactNode } from 'react';
import { useUIStore } from '@/stores/uiStore';

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  header: ReactNode;
}

export function WorkstationLayout({ left, center, right, header }: Props) {
  const leftWidth = useUIStore((s) => s.leftPanelWidth);
  const rightWidth = useUIStore((s) => s.rightPanelWidth);
  const setLeftWidth = useUIStore((s) => s.setLeftPanelWidth);
  const setRightWidth = useUIStore((s) => s.setRightPanelWidth);

  return (
    <div className="h-screen flex flex-col">
      {header}
      <div
        className="flex-1 grid overflow-hidden"
        style={{
          gridTemplateColumns: `${leftWidth}px 4px 1fr 4px ${rightWidth}px`,
        }}
      >
        <aside className="overflow-y-auto border-r border-gray-200">
          {left}
        </aside>
        <ResizeHandle onResize={(dx) => setLeftWidth(leftWidth + dx)} />
        <main className="relative overflow-hidden">
          {center}
        </main>
        <ResizeHandle onResize={(dx) => setRightWidth(rightWidth - dx)} />
        <aside className="overflow-y-auto border-l border-gray-200">
          {right}
        </aside>
      </div>
    </div>
  );
}

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  const startX = useRef(0);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      startX.current = e.clientX;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      const handleMove = (ev: globalThis.PointerEvent) => {
        const dx = ev.clientX - startX.current;
        if (Math.abs(dx) > 2) {
          onResize(dx);
          startX.current = ev.clientX;
        }
      };

      const handleUp = () => {
        target.removeEventListener('pointermove', handleMove);
        target.removeEventListener('pointerup', handleUp);
      };

      target.addEventListener('pointermove', handleMove);
      target.addEventListener('pointerup', handleUp);
    },
    [onResize],
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      className="cursor-col-resize bg-transparent hover:bg-blue-300 active:bg-blue-400 transition-colors"
    />
  );
}
