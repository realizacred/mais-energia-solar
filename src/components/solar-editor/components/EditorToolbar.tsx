import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MousePointer2,
  Hand,
  Square,
  LayoutGrid,
  Minus,
  Pencil,
  ArrowRight,
  RotateCw,
  Trash2,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  Undo2,
  Redo2,
  Palette,
  Upload,
  Rows3,
  Download,
  Home,
} from "lucide-react";
import { EditorTool, DRAWING_COLORS, ROOF_TEMPLATES, RoofType } from "../types";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  tool: EditorTool;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  drawingColor: string;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
  totalModules: number;
  onToolChange: (tool: EditorTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onRotate: (degrees: number) => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onColorChange: (color: string) => void;
  onUploadImage: () => void;
  onAddRoof: (type: RoofType) => void;
  onExportPNG: () => void;
  onGenerateRow: () => void;
}

export function EditorToolbar({
  tool,
  zoom,
  showGrid,
  snapToGrid,
  drawingColor,
  selectedCount,
  canUndo,
  canRedo,
  totalModules,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onToggleGrid,
  onToggleSnap,
  onRotate,
  onDelete,
  onToggleLock,
  onUndo,
  onRedo,
  onColorChange,
  onUploadImage,
  onAddRoof,
  onExportPNG,
  onGenerateRow,
}: EditorToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-background border-b">
        {/* Selection Tools */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<MousePointer2 className="h-4 w-4" />}
            tooltip="Selecionar (V)"
            active={tool === 'select'}
            onClick={() => onToolChange('select')}
          />
          <ToolButton
            icon={<Hand className="h-4 w-4" />}
            tooltip="Mover Canvas (H)"
            active={tool === 'pan'}
            onClick={() => onToolChange('pan')}
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Object Tools */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<Square className="h-4 w-4 fill-blue-600 text-blue-800" />}
            tooltip="Adicionar Módulo (M)"
            active={tool === 'module'}
            onClick={() => onToolChange('module')}
          />
          <ToolButton
            icon={<Rows3 className="h-4 w-4" />}
            tooltip="Gerar Fileira de Módulos"
            active={tool === 'module_row'}
            onClick={onGenerateRow}
          />
          
          {/* Roof Templates */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={tool === 'roof' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                <Home className="h-4 w-4" />
                Telhado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="grid grid-cols-2 gap-1">
                {ROOF_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-xs h-8"
                    onClick={() => onAddRoof(template.type)}
                  >
                    <div
                      className="w-3 h-3 rounded mr-2"
                      style={{ backgroundColor: template.color }}
                    />
                    {template.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Drawing Tools */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<Minus className="h-4 w-4 rotate-[-45deg]" />}
            tooltip="Linha Reta (L)"
            active={tool === 'line'}
            onClick={() => onToolChange('line')}
          />
          <ToolButton
            icon={<Square className="h-4 w-4" />}
            tooltip="Retângulo (R)"
            active={tool === 'rectangle'}
            onClick={() => onToolChange('rectangle')}
          />
          <ToolButton
            icon={<Pencil className="h-4 w-4" />}
            tooltip="Desenho Livre (P)"
            active={tool === 'freehand'}
            onClick={() => onToolChange('freehand')}
          />
          <ToolButton
            icon={<ArrowRight className="h-4 w-4" />}
            tooltip="Seta"
            active={tool === 'arrow'}
            onClick={() => onToolChange('arrow')}
          />

          {/* Color Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Palette className="h-4 w-4" />
                <div
                  className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border"
                  style={{ backgroundColor: drawingColor }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded border-2 transition-transform hover:scale-110",
                      drawingColor === color
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => onColorChange(color)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<RotateCw className="h-4 w-4" />}
            tooltip="Girar 90° (Ctrl+R)"
            disabled={selectedCount === 0}
            onClick={() => onRotate(90)}
          />
          <ToolButton
            icon={<Trash2 className="h-4 w-4" />}
            tooltip="Excluir (Del)"
            disabled={selectedCount === 0}
            onClick={onDelete}
            variant="destructive"
          />
          <ToolButton
            icon={<Lock className="h-4 w-4" />}
            tooltip="Bloquear/Desbloquear"
            disabled={selectedCount === 0}
            onClick={onToggleLock}
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* History */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<Undo2 className="h-4 w-4" />}
            tooltip="Desfazer (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolButton
            icon={<Redo2 className="h-4 w-4" />}
            tooltip="Refazer (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* View Controls */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<ZoomOut className="h-4 w-4" />}
            tooltip="Diminuir Zoom"
            onClick={onZoomOut}
          />
          <span className="text-xs text-muted-foreground w-12 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <ToolButton
            icon={<ZoomIn className="h-4 w-4" />}
            tooltip="Aumentar Zoom"
            onClick={onZoomIn}
          />
          
          <ToolButton
            icon={<Grid3X3 className="h-4 w-4" />}
            tooltip="Mostrar/Ocultar Grid"
            active={showGrid}
            onClick={onToggleGrid}
          />
          <ToolButton
            icon={<Magnet className="h-4 w-4" />}
            tooltip="Snap no Grid"
            active={snapToGrid}
            onClick={onToggleSnap}
          />
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* File Operations */}
        <div className="flex items-center gap-1">
          <ToolButton
            icon={<Upload className="h-4 w-4" />}
            tooltip="Carregar Foto do Telhado"
            onClick={onUploadImage}
          />
          <ToolButton
            icon={<Download className="h-4 w-4" />}
            tooltip="Exportar PNG"
            onClick={onExportPNG}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Module Counter */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">
            {totalModules} módulos
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ToolButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
  onClick: () => void;
}

function ToolButton({ icon, tooltip, active, disabled, variant, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'default' : variant === 'destructive' ? 'ghost' : 'outline'}
          size="icon"
          className={cn(
            "h-8 w-8",
            variant === 'destructive' && !active && "text-destructive hover:text-destructive hover:bg-destructive/10"
          )}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}