/**
 * Builder Canvas — Main rendering area with device scaling
 */

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BlockRenderer } from "./BlockRenderer";
import { BlockActionBar } from "./BlockActionBar";
import { buildTree } from "./treeUtils";
import type { BuilderState, TemplateBlock } from "./types";
import { cn } from "@/lib/utils";

interface BuilderCanvasProps {
  state: BuilderState;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onDropBlock: (block: TemplateBlock, parentId: string) => void;
  onDeleteBlock?: (id: string) => void;
  onDuplicateBlock?: (id: string) => void;
  onSwapOrder?: (id: string, direction: -1 | 1) => void;
  onUpdateBlock?: (id: string, updates: Partial<TemplateBlock>) => void;
}

const DEVICE_WIDTHS = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function BuilderCanvas({ state, onSelect, onHover, onDropBlock, onDeleteBlock, onDuplicateBlock, onSwapOrder, onUpdateBlock }: BuilderCanvasProps) {
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

  // Compute sibling info for selected block
  const selectedBlock = state.selectedBlockId ? state.blocks.find(b => b.id === state.selectedBlockId) : null;
  const selectedSiblings = selectedBlock
    ? state.blocks.filter(b => b.parentId === selectedBlock.parentId).sort((a, b) => a.order - b.order)
    : [];
  const selectedIdx = selectedBlock ? selectedSiblings.findIndex(b => b.id === selectedBlock.id) : -1;

  return (
    <div className="flex-1 bg-muted/20 overflow-hidden flex flex-col">
      <ScrollArea className="flex-1">
        <div className="flex justify-center p-6 min-h-full">
          <div
            className={cn(
              "bg-card shadow-md transition-all duration-300 min-h-[600px] relative",
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
                <p className="text-xs">Arraste uma <strong>Seção</strong> da barra lateral ou use uma <strong>Seção Pré-pronta</strong></p>
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
                  renderActionBar={state.mode === "edit" && state.selectedBlockId === node.block.id && onDeleteBlock ? (
                    <BlockActionBar
                      blockType={node.block.type}
                      isVisible={node.block.isVisible}
                      canMoveUp={selectedIdx > 0}
                      canMoveDown={selectedIdx < selectedSiblings.length - 1}
                      onDelete={() => onDeleteBlock(node.block.id)}
                      onDuplicate={() => onDuplicateBlock?.(node.block.id)}
                      onMoveUp={() => onSwapOrder?.(node.block.id, -1)}
                      onMoveDown={() => onSwapOrder?.(node.block.id, 1)}
                      onToggleVisibility={() => onUpdateBlock?.(node.block.id, { isVisible: !node.block.isVisible })}
                    />
                  ) : undefined}
                />
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
