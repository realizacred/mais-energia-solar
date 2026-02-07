import { useRef, useEffect, useCallback, useState } from "react";
import {
  LayoutData,
  EditorState,
  SolarModule,
  RoofObject,
  DrawingShape,
  Point,
  DEFAULT_MODULE_WIDTH,
  DEFAULT_MODULE_HEIGHT,
  ROOF_TEMPLATES,
} from "../types";
import { cn } from "@/lib/utils";

interface EditorCanvasProps {
  layout: LayoutData;
  state: EditorState;
  onModuleAdd: (module: SolarModule) => void;
  onModuleUpdate: (id: string, updates: Partial<SolarModule>) => void;
  onRoofUpdate: (id: string, updates: Partial<RoofObject>) => void;
  onShapeAdd: (shape: DrawingShape) => void;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onClearSelection: () => void;
  onPan: (panX: number, panY: number) => void;
  snapToGrid: (value: number) => number;
}

export function EditorCanvas({
  layout,
  state,
  onModuleAdd,
  onModuleUpdate,
  onRoofUpdate,
  onShapeAdd,
  onSelect,
  onClearSelection,
  onPan,
  snapToGrid,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // Load background image
  useEffect(() => {
    if (layout.backgroundImage) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        backgroundImageRef.current = img;
        drawCanvas();
      };
      img.src = layout.backgroundImage;
    } else {
      backgroundImageRef.current = null;
    }
  }, [layout.backgroundImage]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - state.panX) / state.zoom,
      y: (e.clientY - rect.top - state.panY) / state.zoom,
    };
  }, [state.zoom, state.panX, state.panY]);

  // Draw the canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);

    // Draw background
    if (backgroundImageRef.current) {
      const img = backgroundImageRef.current;
      const aspectRatio = img.width / img.height;
      const canvasAspect = layout.canvas.width / layout.canvas.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (aspectRatio > canvasAspect) {
        drawWidth = layout.canvas.width;
        drawHeight = drawWidth / aspectRatio;
        drawX = 0;
        drawY = (layout.canvas.height - drawHeight) / 2;
      } else {
        drawHeight = layout.canvas.height;
        drawWidth = drawHeight * aspectRatio;
        drawX = (layout.canvas.width - drawWidth) / 2;
        drawY = 0;
      }
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, layout.canvas.width, layout.canvas.height);
    }

    // Draw grid
    if (state.showGrid) {
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 0.5;
      
      for (let x = 0; x <= layout.canvas.width; x += state.gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, layout.canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= layout.canvas.height; y += state.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(layout.canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw roofs (bottom layer)
    layout.roofs.forEach((roof) => {
      drawRoof(ctx, roof, state.selectedIds.includes(roof.id));
    });

    // Draw shapes
    layout.shapes.forEach((shape) => {
      drawShape(ctx, shape);
    });
    
    // Draw current drawing shape
    if (currentShape) {
      drawShape(ctx, currentShape);
    }

    // Draw modules (top layer)
    layout.modules.forEach((module) => {
      drawModule(ctx, module, state.selectedIds.includes(module.id));
    });

    ctx.restore();
  }, [layout, state, currentShape]);

  // Draw a single module
  const drawModule = (ctx: CanvasRenderingContext2D, module: SolarModule, isSelected: boolean) => {
    ctx.save();
    ctx.translate(module.x + module.width / 2, module.y + module.height / 2);
    ctx.rotate((module.rotation * Math.PI) / 180);

    // Module body
    const gradient = ctx.createLinearGradient(-module.width / 2, -module.height / 2, module.width / 2, module.height / 2);
    gradient.addColorStop(0, isSelected ? "#3b82f6" : "#1e3a8a");
    gradient.addColorStop(1, isSelected ? "#60a5fa" : "#1e40af");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-module.width / 2, -module.height / 2, module.width, module.height);

    // Module border
    ctx.strokeStyle = isSelected ? "#2563eb" : "#1e3a8a";
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(-module.width / 2, -module.height / 2, module.width, module.height);

    // Cell grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 0.5;
    
    // Vertical lines (2 cells wide)
    ctx.beginPath();
    ctx.moveTo(0, -module.height / 2);
    ctx.lineTo(0, module.height / 2);
    ctx.stroke();
    
    // Horizontal lines (6 cells tall)
    for (let i = 1; i < 6; i++) {
      const y = -module.height / 2 + (module.height / 6) * i;
      ctx.beginPath();
      ctx.moveTo(-module.width / 2, y);
      ctx.lineTo(module.width / 2, y);
      ctx.stroke();
    }

    // Lock indicator
    if (module.locked) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒", 0, 0);
    }

    ctx.restore();
  };

  // Draw a roof
  const drawRoof = (ctx: CanvasRenderingContext2D, roof: RoofObject, isSelected: boolean) => {
    ctx.save();
    ctx.translate(roof.x + roof.width / 2, roof.y + roof.height / 2);
    ctx.rotate((roof.rotation * Math.PI) / 180);

    // Roof body
    ctx.fillStyle = roof.color;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-roof.width / 2, -roof.height / 2, roof.width, roof.height);
    ctx.globalAlpha = 1;

    // Roof border
    ctx.strokeStyle = isSelected ? "#3b82f6" : "#666666";
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.setLineDash(isSelected ? [5, 5] : []);
    ctx.strokeRect(-roof.width / 2, -roof.height / 2, roof.width, roof.height);
    ctx.setLineDash([]);

    // Roof type label
    const template = ROOF_TEMPLATES.find(t => t.type === roof.type);
    if (template) {
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(template.name, 0, 0);
    }

    // Lock indicator
    if (roof.locked) {
      ctx.fillStyle = "#333";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("🔒", roof.width / 2 - 4, -roof.height / 2 + 4);
    }

    ctx.restore();
  };

  // Draw a shape
  const drawShape = (ctx: CanvasRenderingContext2D, shape: DrawingShape) => {
    if (shape.points.length < 1) return;

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (shape.type === "line" && shape.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      ctx.lineTo(shape.points[1].x, shape.points[1].y);
      ctx.stroke();
    } else if (shape.type === "arrow" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[1];
      
      // Line
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      // Arrowhead
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 15;
      
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle - Math.PI / 6),
        end.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * Math.cos(angle + Math.PI / 6),
        end.y - headLen * Math.sin(angle + Math.PI / 6)
      );
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

  // Redraw on state/layout changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Find object at position
  const findObjectAt = (point: Point): { type: 'module' | 'roof'; id: string } | null => {
    // Check modules first (top layer)
    for (let i = layout.modules.length - 1; i >= 0; i--) {
      const m = layout.modules[i];
      if (isPointInRotatedRect(point, m)) {
        return { type: 'module', id: m.id };
      }
    }
    
    // Check roofs
    for (let i = layout.roofs.length - 1; i >= 0; i--) {
      const r = layout.roofs[i];
      if (isPointInRotatedRect(point, r)) {
        return { type: 'roof', id: r.id };
      }
    }
    
    return null;
  };

  const isPointInRotatedRect = (point: Point, rect: { x: number; y: number; width: number; height: number; rotation: number }): boolean => {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const rad = (-rect.rotation * Math.PI) / 180;
    const rotX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const rotY = dx * Math.sin(rad) + dy * Math.cos(rad);
    
    return Math.abs(rotX) <= rect.width / 2 && Math.abs(rotY) <= rect.height / 2;
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const isShift = e.shiftKey;

    // Pan mode
    if (state.tool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - state.panX, y: e.clientY - state.panY });
      return;
    }

    // Drawing tools
    if (['line', 'rectangle', 'freehand', 'arrow'].includes(state.tool)) {
      setCurrentShape({
        id: `shape_${Date.now()}`,
        type: state.tool as DrawingShape['type'],
        points: [coords],
        color: state.drawingColor,
        lineWidth: 3,
      });
      return;
    }

    // Add module
    if (state.tool === 'module') {
      const newModule: SolarModule = {
        id: `module_${Date.now()}`,
        x: snapToGrid(coords.x - DEFAULT_MODULE_WIDTH / 2),
        y: snapToGrid(coords.y - DEFAULT_MODULE_HEIGHT / 2),
        width: DEFAULT_MODULE_WIDTH,
        height: DEFAULT_MODULE_HEIGHT,
        rotation: 0,
        locked: false,
      };
      onModuleAdd(newModule);
      onSelect(newModule.id);
      return;
    }

    // Select mode
    if (state.tool === 'select') {
      const obj = findObjectAt(coords);
      
      if (obj) {
        // Check if locked
        const isLocked = obj.type === 'module' 
          ? layout.modules.find(m => m.id === obj.id)?.locked
          : layout.roofs.find(r => r.id === obj.id)?.locked;

        onSelect(obj.id, isShift);
        
        if (!isLocked) {
          setIsDragging(true);
          const item = obj.type === 'module'
            ? layout.modules.find(m => m.id === obj.id)
            : layout.roofs.find(r => r.id === obj.id);
          
          if (item) {
            setDragOffset({ x: coords.x - item.x, y: coords.y - item.y });
          }
        }
      } else {
        onClearSelection();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Panning
    if (isPanning) {
      onPan(e.clientX - panStart.x, e.clientY - panStart.y);
      return;
    }

    // Drawing
    if (currentShape) {
      if (currentShape.type === 'freehand') {
        setCurrentShape(prev => prev ? {
          ...prev,
          points: [...prev.points, coords],
        } : null);
      } else {
        setCurrentShape(prev => prev ? {
          ...prev,
          points: [prev.points[0], coords],
        } : null);
      }
      return;
    }

    // Dragging selected objects
    if (isDragging && state.selectedIds.length > 0) {
      const newX = snapToGrid(coords.x - dragOffset.x);
      const newY = snapToGrid(coords.y - dragOffset.y);
      
      state.selectedIds.forEach(id => {
        const module = layout.modules.find(m => m.id === id);
        if (module && !module.locked) {
          onModuleUpdate(id, { x: newX, y: newY });
        }
        
        const roof = layout.roofs.find(r => r.id === id);
        if (roof && !roof.locked) {
          onRoofUpdate(id, { x: newX, y: newY });
        }
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    
    if (currentShape && currentShape.points.length >= 2) {
      onShapeAdd(currentShape);
    }
    setCurrentShape(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Duplicate with Ctrl+D
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        // Handle duplicate in parent
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine cursor
  const getCursor = () => {
    if (state.tool === 'pan' || isPanning) return 'grab';
    if (state.tool === 'module') return 'crosshair';
    if (['line', 'rectangle', 'freehand', 'arrow'].includes(state.tool)) return 'crosshair';
    if (isDragging) return 'grabbing';
    return 'default';
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-hidden bg-muted/50"
    >
      <canvas
        ref={canvasRef}
        width={layout.canvas.width}
        height={layout.canvas.height}
        className={cn("block")}
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}