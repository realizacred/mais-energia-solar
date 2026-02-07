import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Upload,
  RotateCw,
  Plus,
  Trash2,
  Save,
  Move,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  X,
  Pencil,
  Square,
  Minus as LineIcon,
  Palette,
  Undo2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ModuleData {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

interface DrawingShape {
  id: string;
  type: "line" | "rectangle" | "freehand";
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

interface LayoutData {
  backgroundImage: string | null;
  modules: ModuleData[];
  totalModules: number;
  shapes?: DrawingShape[];
}

interface ModuleLayoutCanvasProps {
  layout: LayoutData | null;
  onLayoutChange: (layout: LayoutData) => void;
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_MODULE_WIDTH = 60;
const DEFAULT_MODULE_HEIGHT = 100;

const DRAWING_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#000000", // black
  "#ffffff", // white
];

type ToolType = "select" | "add" | "line" | "rectangle" | "freehand";

export function ModuleLayoutCanvas({
  layout,
  onLayoutChange,
  isOpen,
  onClose,
}: ModuleLayoutCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [modules, setModules] = useState<ModuleData[]>(layout?.modules || []);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState<ToolType>("add");
  
  // Drawing state
  const [shapes, setShapes] = useState<DrawingShape[]>(layout?.shapes || []);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#ef4444");
  const drawingLineWidth = 3;

  const isDrawingTool = tool === "line" || tool === "rectangle" || tool === "freehand";

  // Load existing layout
  useEffect(() => {
    if (layout?.backgroundImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => setBackgroundImage(img);
      img.src = layout.backgroundImage;
    }
    if (layout?.modules) {
      setModules(layout.modules);
    }
    if (layout?.shapes) {
      setShapes(layout.shapes);
    }
  }, [layout]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw background
    if (backgroundImage) {
      const aspectRatio = backgroundImage.width / backgroundImage.height;
      const canvasAspect = canvas.width / canvas.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (aspectRatio > canvasAspect) {
        drawWidth = canvas.width / scale;
        drawHeight = drawWidth / aspectRatio;
        drawX = 0;
        drawY = (canvas.height / scale - drawHeight) / 2;
      } else {
        drawHeight = canvas.height / scale;
        drawWidth = drawHeight * aspectRatio;
        drawX = (canvas.width / scale - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Draw grid pattern when no image
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
      
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width / scale; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / scale);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height / scale; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / scale, y);
        ctx.stroke();
      }
    }

    // Draw saved shapes
    const drawShape = (shape: DrawingShape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.type === "line" && shape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();
      } else if (shape.type === "rectangle" && shape.points.length >= 2) {
        const [start, end] = shape.points;
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (shape.type === "freehand" && shape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      }
    };

    shapes.forEach(drawShape);
    if (currentShape && currentShape.points.length >= 1) {
      drawShape(currentShape);
    }

    // Draw modules
    modules.forEach((module, index) => {
      ctx.save();
      ctx.translate(module.x + module.width / 2, module.y + module.height / 2);
      ctx.rotate((module.rotation * Math.PI) / 180);
      
      // Module body
      ctx.fillStyle = selectedModuleId === module.id 
        ? "rgba(59, 130, 246, 0.8)" 
        : "rgba(30, 58, 138, 0.85)";
      ctx.fillRect(-module.width / 2, -module.height / 2, module.width, module.height);
      
      // Module border
      ctx.strokeStyle = selectedModuleId === module.id ? "#3b82f6" : "#1e3a8a";
      ctx.lineWidth = selectedModuleId === module.id ? 3 : 1;
      ctx.strokeRect(-module.width / 2, -module.height / 2, module.width, module.height);
      
      // Grid lines on module
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 3; i++) {
        const y = -module.height / 2 + (module.height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(-module.width / 2, y);
        ctx.lineTo(module.width / 2, y);
        ctx.stroke();
      }
      for (let i = 1; i < 2; i++) {
        const x = -module.width / 2 + (module.width / 2) * i;
        ctx.beginPath();
        ctx.moveTo(x, -module.height / 2);
        ctx.lineTo(x, module.height / 2);
        ctx.stroke();
      }
      
      // Module number
      ctx.fillStyle = "white";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), 0, 0);
      
      ctx.restore();
    });

    ctx.restore();
  }, [backgroundImage, modules, selectedModuleId, scale, shapes, currentShape]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setBackgroundImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const addModule = (x?: number, y?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newModule: ModuleData = {
      id: `module_${Date.now()}`,
      x: x ?? (canvas.width / scale / 2 - DEFAULT_MODULE_WIDTH / 2),
      y: y ?? (canvas.height / scale / 2 - DEFAULT_MODULE_HEIGHT / 2),
      rotation: 0,
      width: DEFAULT_MODULE_WIDTH,
      height: DEFAULT_MODULE_HEIGHT,
    };

    setModules((prev) => [...prev, newModule]);
    setSelectedModuleId(newModule.id);
  };

  const rotateSelected = () => {
    if (!selectedModuleId) return;
    
    setModules((prev) =>
      prev.map((m) =>
        m.id === selectedModuleId
          ? { ...m, rotation: (m.rotation + 90) % 360 }
          : m
      )
    );
  };

  const deleteSelected = () => {
    if (!selectedModuleId) return;
    
    setModules((prev) => prev.filter((m) => m.id !== selectedModuleId));
    setSelectedModuleId(null);
  };

  const undoLastShape = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Drawing tools don't use click
    if (isDrawingTool) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoords(e);

    // Check if clicked on a module
    const clickedModule = [...modules].reverse().find((m) => {
      const centerX = m.x + m.width / 2;
      const centerY = m.y + m.height / 2;
      const dx = coords.x - centerX;
      const dy = coords.y - centerY;
      const rad = (-m.rotation * Math.PI) / 180;
      const rotX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rotY = dx * Math.sin(rad) + dy * Math.cos(rad);
      
      return (
        Math.abs(rotX) <= m.width / 2 && Math.abs(rotY) <= m.height / 2
      );
    });

    if (clickedModule) {
      setSelectedModuleId(clickedModule.id);
      setTool("select");
    } else if (tool === "add") {
      addModule(coords.x - DEFAULT_MODULE_WIDTH / 2, coords.y - DEFAULT_MODULE_HEIGHT / 2);
    } else {
      setSelectedModuleId(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoords(e);

    // Handle drawing tools
    if (isDrawingTool) {
      setIsDrawing(true);
      const newShape: DrawingShape = {
        id: `shape_${Date.now()}`,
        type: tool as "line" | "rectangle" | "freehand",
        points: [coords],
        color: drawingColor,
        lineWidth: drawingLineWidth,
      };
      setCurrentShape(newShape);
      return;
    }

    // Handle module dragging
    if (!selectedModuleId) return;
    const module = modules.find((m) => m.id === selectedModuleId);
    if (module) {
      setDragStart({ x: coords.x - module.x, y: coords.y - module.y });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoords(e);

    // Handle drawing
    if (isDrawing && currentShape) {
      if (currentShape.type === "freehand") {
        setCurrentShape((prev) =>
          prev ? { ...prev, points: [...prev.points, coords] } : null
        );
      } else {
        // For line and rectangle, update the second point
        setCurrentShape((prev) =>
          prev ? { ...prev, points: [prev.points[0], coords] } : null
        );
      }
      return;
    }

    // Handle module dragging
    if (!isDragging || !selectedModuleId) return;
    setModules((prev) =>
      prev.map((m) =>
        m.id === selectedModuleId
          ? { ...m, x: coords.x - dragStart.x, y: coords.y - dragStart.y }
          : m
      )
    );
  };

  const handleMouseUp = () => {
    // Finish drawing
    if (isDrawing && currentShape && currentShape.points.length >= 2) {
      setShapes((prev) => [...prev, currentShape]);
    }
    setCurrentShape(null);
    setIsDrawing(false);
    setIsDragging(false);
  };

  const handleSave = () => {
    const layoutData: LayoutData = {
      backgroundImage: backgroundImage?.src || null,
      modules: modules,
      totalModules: modules.length,
      shapes: shapes,
    };
    
    onLayoutChange(layoutData);
    toast({
      title: "Layout salvo",
      description: `${modules.length} módulo(s) posicionado(s).`,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-secondary" />
            Layout de Módulos Fotovoltaicos
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Imagem
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            {/* Module tools */}
            <Button
              variant={tool === "add" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("add")}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Módulo
            </Button>
            
            <Button
              variant={tool === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("select")}
              className="gap-1.5"
            >
              <Move className="h-4 w-4" />
              Mover
            </Button>
            
            <div className="h-6 w-px bg-border" />

            {/* Drawing tools */}
            <Button
              variant={tool === "line" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("line")}
              className="gap-1.5"
            >
              <LineIcon className="h-4 w-4 rotate-[-45deg]" />
              Linha
            </Button>

            <Button
              variant={tool === "rectangle" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("rectangle")}
              className="gap-1.5"
            >
              <Square className="h-4 w-4" />
              Retângulo
            </Button>

            <Button
              variant={tool === "freehand" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("freehand")}
              className="gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              Livre
            </Button>

            {/* Color picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Palette className="h-4 w-4" />
                  <div
                    className="w-4 h-4 rounded border"
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
                      onClick={() => setDrawingColor(color)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Undo */}
            <Button
              variant="outline"
              size="sm"
              onClick={undoLastShape}
              disabled={shapes.length === 0}
              className="gap-1.5"
            >
              <Undo2 className="h-4 w-4" />
            </Button>

            <div className="h-6 w-px bg-border" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={rotateSelected}
              disabled={!selectedModuleId || isDrawingTool}
              className="gap-1.5"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={deleteSelected}
              disabled={!selectedModuleId || isDrawingTool}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <span className="text-sm text-muted-foreground w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale((s) => Math.min(2, s + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-lg">
              <Grid3X3 className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium text-secondary">
                {modules.length} módulos
              </span>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-muted/30 rounded-lg border">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className={cn(
                "block mx-auto",
                tool === "add" && "cursor-crosshair",
                tool === "select" && "cursor-move",
                isDrawingTool && "cursor-crosshair"
              )}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground text-center">
            {tool === "add" && "Clique no canvas para adicionar módulos"}
            {tool === "select" && "Clique e arraste para mover módulos"}
            {tool === "line" && "Clique e arraste para desenhar uma linha reta"}
            {tool === "rectangle" && "Clique e arraste para desenhar um retângulo"}
            {tool === "freehand" && "Clique e arraste para desenhar livremente"}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Layout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}