import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, X, Sun } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutData,
  RoofObject,
  RoofType,
  ROOF_TEMPLATES,
  DEFAULT_MODULE_WIDTH,
  DEFAULT_MODULE_HEIGHT,
} from "./types";
import { useEditorState } from "./hooks/useEditorState";
import { EditorToolbar } from "./components/EditorToolbar";
import { EditorCanvas } from "./components/EditorCanvas";
import { ModuleRowDialog } from "./components/ModuleRowDialog";

interface SolarLayoutEditorProps {
  isOpen: boolean;
  onClose: () => void;
  layoutId?: string;
  existingLayout?: LayoutData | null;
  projetoId?: string;
  clienteId?: string;
  servicoId?: string;
  layoutName?: string;
  onSave?: (layoutId: string, layoutData: LayoutData) => void;
}

export function SolarLayoutEditor({
  isOpen,
  onClose,
  layoutId,
  existingLayout,
  projetoId,
  clienteId,
  servicoId,
  layoutName = "Novo Layout",
  onSave,
}: SolarLayoutEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRowDialog, setShowRowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    state,
    layout,
    setTool,
    selectItem,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    addModule,
    updateModule,
    duplicateModule,
    addModuleRow,
    addRoof,
    updateRoof,
    addShape,
    setZoom,
    setPan,
    toggleGrid,
    toggleSnap,
    snapToGridValue,
    rotateSelected,
    deleteSelected,
    toggleLockSelected,
    setDrawingColor,
    setBackgroundImage,
  } = useEditorState(existingLayout);

  const handleAddRoof = useCallback((type: RoofType) => {
    const template = ROOF_TEMPLATES.find(t => t.type === type);
    if (!template) return;

    const newRoof: RoofObject = {
      id: `roof_${Date.now()}`,
      type: type,
      templateId: template.id,
      x: 100,
      y: 100,
      width: template.width,
      height: template.height,
      rotation: 0,
      locked: false,
      color: template.color,
    };

    addRoof(newRoof);
    selectItem(newRoof.id);
    setTool('select');
  }, [addRoof, selectItem, setTool]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, [setBackgroundImage]);

  const handleGenerateRow = useCallback((count: number, orientation: 'horizontal' | 'vertical', spacing: number) => {
    addModuleRow(100, 100, count, orientation, spacing, DEFAULT_MODULE_WIDTH, DEFAULT_MODULE_HEIGHT);
  }, [addModuleRow]);

  const handleExportPNG = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `layout-solar-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast({ title: "Imagem exportada", description: "O layout foi salvo como PNG." });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    
    try {
      const layoutData: LayoutData = {
        ...layout,
        canvas: {
          ...layout.canvas,
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
          showGrid: state.showGrid,
          snapToGrid: state.snapToGrid,
        },
      };

      const payload: {
        nome: string;
        layout_data: unknown;
        total_modulos: number;
        tipo_telhado: string | null;
        projeto_id: string | null;
        cliente_id: string | null;
        servico_id: string | null;
        updated_at: string;
        created_at?: string;
      } = {
        nome: layoutName,
        layout_data: JSON.parse(JSON.stringify(layoutData)),
        total_modulos: layout.modules.length,
        tipo_telhado: layout.roofs.length > 0 ? layout.roofs[0].type : null,
        projeto_id: projetoId || null,
        cliente_id: clienteId || null,
        servico_id: servicoId || null,
        updated_at: new Date().toISOString(),
      };

      let savedId = layoutId;

      if (layoutId) {
        const { error } = await supabase
          .from('layouts_solares')
          .update(payload as Record<string, unknown>)
          .eq('id', layoutId);
        if (error) throw error;
      } else {
        payload.created_at = new Date().toISOString();
        const { data, error } = await supabase
          .from('layouts_solares')
          .insert(payload as Record<string, unknown>)
          .select('id')
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      toast({ title: "Layout salvo", description: `${layout.modules.length} módulo(s) no layout.` });

      if (onSave && savedId) {
        onSave(savedId, layoutData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving layout:', error);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar o layout.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [layout, state, layoutId, layoutName, projetoId, clienteId, servicoId, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'v' || e.key === 'V') setTool('select');
    if (e.key === 'h' || e.key === 'H') setTool('pan');
    if (e.key === 'm' || e.key === 'M') setTool('module');
    if (e.key === 'l' || e.key === 'L') setTool('line');
    if (e.key === 'r' && !e.ctrlKey) setTool('rectangle');
    if (e.key === 'p' || e.key === 'P') setTool('freehand');
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    if (e.ctrlKey && e.key === 'z') undo();
    if (e.ctrlKey && e.key === 'y') redo();
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); rotateSelected(90); }
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      if (state.selectedIds.length === 1) duplicateModule(state.selectedIds[0]);
    }
  }, [setTool, deleteSelected, undo, redo, rotateSelected, duplicateModule, state.selectedIds]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] max-h-[95vh] h-[900px] overflow-hidden flex flex-col p-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            Editor de Layout Solar
            {layout.modules.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {layout.modules.length} módulo(s)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <EditorToolbar
          tool={state.tool}
          zoom={state.zoom}
          showGrid={state.showGrid}
          snapToGrid={state.snapToGrid}
          drawingColor={state.drawingColor}
          selectedCount={state.selectedIds.length}
          canUndo={canUndo}
          canRedo={canRedo}
          totalModules={layout.modules.length}
          onToolChange={setTool}
          onZoomIn={() => setZoom(state.zoom + 0.1)}
          onZoomOut={() => setZoom(state.zoom - 0.1)}
          onToggleGrid={toggleGrid}
          onToggleSnap={toggleSnap}
          onRotate={rotateSelected}
          onDelete={deleteSelected}
          onToggleLock={toggleLockSelected}
          onUndo={undo}
          onRedo={redo}
          onColorChange={setDrawingColor}
          onUploadImage={() => fileInputRef.current?.click()}
          onAddRoof={handleAddRoof}
          onExportPNG={handleExportPNG}
          onGenerateRow={() => setShowRowDialog(true)}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="flex-1 overflow-auto">
          <EditorCanvas
            layout={layout}
            state={state}
            onModuleAdd={addModule}
            onModuleUpdate={updateModule}
            onRoofUpdate={updateRoof}
            onShapeAdd={addShape}
            onSelect={selectItem}
            onClearSelection={clearSelection}
            onPan={setPan}
            snapToGrid={snapToGridValue}
          />
        </div>

        <div className="flex justify-between items-center p-4 border-t shrink-0 bg-background">
          <div className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] mr-1">V</kbd> Selecionar
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] mx-1 ml-3">M</kbd> Módulo
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] mx-1 ml-3">Del</kbd> Excluir
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] mx-1 ml-3">Ctrl+D</kbd> Duplicar
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Salvando..." : "Salvar Layout"}
            </Button>
          </div>
        </div>

        <ModuleRowDialog
          isOpen={showRowDialog}
          onClose={() => setShowRowDialog(false)}
          onGenerate={handleGenerateRow}
        />
      </DialogContent>
    </Dialog>
  );
}