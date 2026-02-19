/**
 * Builder Canvas — Main rendering area with device scaling
 */

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BlockRenderer } from "./BlockRenderer";
import { buildTree } from "./treeUtils";
import type { BuilderState, TemplateBlock } from "./types";
import { cn } from "@/lib/utils";

interface BuilderCanvasProps {
  state: BuilderState;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onDropBlock: (block: TemplateBlock, parentId: string) => void;
}

const DEVICE_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function BuilderCanvas({ state, onSelect, onHover, onDropBlock }: BuilderCanvasProps) {
  const tree = useMemo(
    () => buildTree(state.blocks.filter(b => b._proposalType === state.proposalType)),
    [state.blocks, state.proposalType]
  );

  const handleDrop = (e: React.DragEvent, parentId: string) => {
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      const block = JSON.parse(data) as TemplateBlock;
      onDropBlock(block, parentId);
    } catch {
      // ignore
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      const block = JSON.parse(data) as TemplateBlock;
      // Only sections can be dropped at root
      if (block.type === "section") {
        onDropBlock(block, null as any);
      }
    } catch {
      // ignore
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div className="flex-1 bg-muted/20 overflow-hidden flex flex-col">
      <ScrollArea className="flex-1">
        <div className="flex justify-center p-6 min-h-full">
          <div
            className={cn(
              "bg-white shadow-lg transition-all duration-300 min-h-[600px]",
              state.device !== "desktop" && "rounded-xl"
            )}
            style={{
              width: DEVICE_WIDTHS[state.device],
              maxWidth: "100%",
            }}
            onClick={() => onSelect(null)}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            {tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-3">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center text-2xl">📄</div>
                <p className="text-sm font-medium">Template vazio</p>
                <p className="text-xs">Arraste uma <strong>Seção</strong> da barra lateral para começar</p>
              </div>
            ) : (
              tree.map(node => (
                <BlockRenderer
                  key={node.block.id}
                  node={node}
                  device={state.device}
                  mode={state.mode}
                  selectedId={state.selectedBlockId}
                  hoveredId={state.hoveredBlockId}
                  onSelect={onSelect}
                  onHover={onHover}
                  onDrop={handleDrop}
                />
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
