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
import { BuilderTopbar } from "./BuilderTopbar";
import { BuilderCanvas } from "./BuilderCanvas";
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

  // Load initial data or fetch default template
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      dispatch({ type: "SET_BLOCKS", blocks: initialData });
      // Auto-detect proposal type
      const types = new Set(initialData.map(b => b._proposalType));
      if (types.size === 1) {
        dispatch({ type: "SET_PROPOSAL_TYPE", proposalType: [...types][0] });
      }
    } else {
      // Auto-load default template when editor opens empty
      const loadDefault = async () => {
        try {
          const res = await fetch(`/default-templates/template-${state.proposalType}.json`);
          if (res.ok) {
            const blocks = await res.json();
            if (Array.isArray(blocks) && blocks.length > 0) {
              dispatch({ type: "SET_BLOCKS", blocks });
              toast({ title: "Template padrão carregado!", description: `${blocks.length} blocos` });
            }
          }
        } catch {
          // silently ignore — user can build from scratch
        }
      };
      loadDefault();
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
            />
          )}
          <BuilderCanvas
            state={state}
            onSelect={handleSelect}
            onHover={handleHover}
            onDropBlock={handleDropBlock}
          />
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
