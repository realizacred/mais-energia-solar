/**
 * ═══════════════════════════════════════════════════════════════
 * Visual Proposal Builder — Main Editor Component
 * ═══════════════════════════════════════════════════════════════
 * 
 * JSON-driven drag & drop proposal builder.
 * Loads/saves TemplateBlock[] from/to proposta_templates.template_html
 */

import { useReducer, useCallback, useRef, useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BuilderSidebar } from "./BuilderSidebar";
import { generateDefaultTemplate } from "./SectionTemplates";
import { BuilderTopbar } from "./BuilderTopbar";
import { BuilderCanvas } from "./BuilderCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { builderReducer, initialBuilderState } from "./builderReducer";
import type { TemplateBlock, ProposalType, DevicePreview, EditorMode } from "./types";

interface ProposalBuilderEditorProps {
  /** Existing JSON data (template_html parsed) */
  initialData?: TemplateBlock[];
  /** Template name for header */
  templateName?: string;
  /** Called on save with serialized JSON */
  onSave: (jsonData: string) => Promise<void>;
  /** Close the builder */
  onClose: () => void;
}

export function ProposalBuilderEditor({
  initialData,
  templateName,
  onSave,
  onClose,
}: ProposalBuilderEditorProps) {
  const [state, dispatch] = useReducer(builderReducer, initialBuilderState);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial data or generate default template
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      dispatch({ type: "SET_BLOCKS", blocks: initialData });
      // Auto-detect proposal type
      const types = new Set(initialData.map(b => b._proposalType));
      if (types.size === 1) {
        dispatch({ type: "SET_PROPOSAL_TYPE", proposalType: [...types][0] });
      }
    } else {
      // Generate default GDASH-quality template
      const defaultBlocks = generateDefaultTemplate(state.proposalType);
      dispatch({ type: "SET_BLOCKS", blocks: defaultBlocks });
      toast({ title: "Template padrão carregado!", description: `${defaultBlocks.length} blocos` });
    }
  }, [initialData]);

  const handleAddBlock = useCallback((block: TemplateBlock, parentId: string | null) => {
    dispatch({ type: "ADD_BLOCK", block, parentId });
  }, []);

  const handleDropBlock = useCallback((block: TemplateBlock, parentId: string | null) => {
    dispatch({ type: "ADD_BLOCK", block, parentId });
  }, []);

  const handleSelect = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_BLOCK", id });
  }, []);

  const handleHover = useCallback((id: string | null) => {
    dispatch({ type: "HOVER_BLOCK", id });
  }, []);

  const handleUpdateBlock = useCallback((id: string, updates: Partial<TemplateBlock>) => {
    dispatch({ type: "UPDATE_BLOCK", id, updates });
  }, []);

  const handleDeleteBlock = useCallback((id: string) => {
    dispatch({ type: "REMOVE_BLOCK", id });
  }, []);

  const handleDuplicateBlock = useCallback((id: string) => {
    dispatch({ type: "DUPLICATE_BLOCK", id });
  }, []);

  const handleSwapOrder = useCallback((id: string, direction: -1 | 1) => {
    dispatch({ type: "SWAP_ORDER", id, direction });
  }, []);

  const handleInsertBlocks = useCallback((blocks: TemplateBlock[]) => {
    dispatch({ type: "ADD_BLOCKS", blocks });
    toast({ title: "Seção inserida!", description: `${blocks.length} blocos adicionados` });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const json = JSON.stringify(state.blocks);
      await onSave(json);
      dispatch({ type: "MARK_CLEAN" });
      toast({ title: "Template salvo com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }, [state.blocks, onSave]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state.blocks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${state.proposalType}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "JSON exportado!" });
  }, [state.blocks, state.proposalType]);

  const handleImportJson = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const blocks = JSON.parse(ev.target?.result as string) as TemplateBlock[];
        if (!Array.isArray(blocks)) throw new Error("JSON inválido");
        dispatch({ type: "SET_BLOCKS", blocks });
        toast({ title: "Template importado!", description: `${blocks.length} blocos carregados` });
      } catch (err: any) {
        toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleRestoreDefault = useCallback(async () => {
    if (!confirm("Restaurar template padrão? Todas as alterações serão perdidas.")) return;
    
    try {
      const response = await fetch(`/default-templates/template-${state.proposalType}.json`);
      if (!response.ok) throw new Error("Template padrão não encontrado");
      const blocks = await response.json();
      dispatch({ type: "SET_BLOCKS", blocks });
      toast({ title: "Template padrão restaurado!" });
    } catch (err: any) {
      toast({ title: "Erro ao restaurar", description: err.message, variant: "destructive" });
    }
  }, [state.proposalType]);

  // Find selected block for properties panel
  const selectedBlock = state.selectedBlockId
    ? state.blocks.find(b => b.id === state.selectedBlockId) ?? null
    : null;

  // Compute sibling info for move up/down
  const selectedSiblings = selectedBlock
    ? state.blocks.filter(b => b.parentId === selectedBlock.parentId).sort((a, b) => a.order - b.order)
    : [];
  const selectedIdx = selectedBlock ? selectedSiblings.findIndex(b => b.id === selectedBlock.id) : -1;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="h-10 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Editor Visual</span>
            {templateName && (
              <span className="text-xs text-muted-foreground">— {templateName}</span>
            )}
            {state.isDirty && (
              <span className="text-[9px] text-warning font-medium">● Não salvo</span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Topbar */}
        <BuilderTopbar
          state={state}
          onDeviceChange={(d) => dispatch({ type: "SET_DEVICE", device: d })}
          onModeChange={(m) => dispatch({ type: "SET_MODE", mode: m })}
          onProposalTypeChange={(t) => dispatch({ type: "SET_PROPOSAL_TYPE", proposalType: t })}
          onUndo={() => dispatch({ type: "UNDO" })}
          onRedo={() => dispatch({ type: "REDO" })}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onRestoreDefault={handleRestoreDefault}
          onSave={handleSave}
        />

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {state.mode === "edit" && (
            <BuilderSidebar
              proposalType={state.proposalType}
              onAddBlock={handleAddBlock}
              onInsertBlocks={handleInsertBlocks}
            />
          )}
          <BuilderCanvas
            state={state}
            onSelect={handleSelect}
            onHover={handleHover}
            onDropBlock={handleDropBlock}
            onDeleteBlock={handleDeleteBlock}
            onDuplicateBlock={handleDuplicateBlock}
            onSwapOrder={handleSwapOrder}
            onUpdateBlock={handleUpdateBlock}
          />
          {state.mode === "edit" && selectedBlock && (
            <PropertiesPanel
              block={selectedBlock}
              onUpdate={(updates) => handleUpdateBlock(selectedBlock.id, updates)}
            />
          )}
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    </TooltipProvider>
  );
}
