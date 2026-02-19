/**
 * Builder Topbar — Device toggles, proposal type, undo/redo, save
 */

import { Monitor, Tablet, Smartphone, Undo2, Redo2, Download, Upload, RotateCcw, Save, Eye, Edit3, Zap, Battery, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DevicePreview, EditorMode, ProposalType, BuilderState } from "./types";
import { cn } from "@/lib/utils";

interface BuilderTopbarProps {
  state: BuilderState;
  onDeviceChange: (device: DevicePreview) => void;
  onModeChange: (mode: EditorMode) => void;
  onProposalTypeChange: (type: ProposalType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onRestoreDefault: () => void;
  onSave: () => void;
}

const PROPOSAL_TYPES: { value: ProposalType; label: string; icon: React.ElementType }[] = [
  { value: "grid", label: "On-Grid", icon: Zap },
  { value: "hybrid", label: "Híbrido", icon: Battery },
  { value: "dual", label: "Dual", icon: Repeat },
];

const DEVICES: { value: DevicePreview; icon: React.ElementType; label: string }[] = [
  { value: "desktop", icon: Monitor, label: "Desktop" },
  { value: "tablet", icon: Tablet, label: "Tablet" },
  { value: "mobile", icon: Smartphone, label: "Mobile" },
];

export function BuilderTopbar({
  state,
  onDeviceChange,
  onModeChange,
  onProposalTypeChange,
  onUndo,
  onRedo,
  onExportJson,
  onImportJson,
  onRestoreDefault,
  onSave,
}: BuilderTopbarProps) {
  return (
    <div className="h-12 border-b border-border bg-card flex items-center justify-between px-3 gap-2 shrink-0">
      {/* Left: Proposal Type */}
      <div className="flex items-center gap-1">
        {PROPOSAL_TYPES.map(pt => (
          <button
            key={pt.value}
            onClick={() => onProposalTypeChange(pt.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              state.proposalType === pt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <pt.icon className="h-3.5 w-3.5" />
            {pt.label}
          </button>
        ))}
      </div>

      {/* Center: Mode toggle + Device */}
      <div className="flex items-center gap-2">
        {/* Mode indicator */}
        {state.mode === "preview" && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1">
            <Eye className="h-3 w-3" />
            Modo Demonstração (Leitura)
          </Badge>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* Device toggles */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/30">
          {DEVICES.map(d => (
            <Tooltip key={d.value}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDeviceChange(d.value)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    state.device === d.value
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <d.icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{d.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={state.undoStack.length === 0}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Desfazer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={state.redoStack.length === 0}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Refazer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExportJson}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Exportar JSON</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onImportJson}>
              <Upload className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Importar JSON</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRestoreDefault}>
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={onSave}
              disabled={!state.isDirty}
            >
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Salvar</TooltipContent>
        </Tooltip>

        {/* Edit/Preview toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={state.mode === "edit" ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => onModeChange(state.mode === "edit" ? "preview" : "edit")}
            >
              {state.mode === "edit" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {state.mode === "edit" ? "Modo Preview" : "Modo Edição"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
