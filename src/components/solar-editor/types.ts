// Types for Solar Layout Editor

export interface Point {
  x: number;
  y: number;
}

export interface SolarModule {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
}

export interface RoofTemplate {
  id: string;
  name: string;
  type: RoofType;
  path: string; // SVG path or polygon points
  width: number;
  height: number;
  color: string;
}

export type RoofType = 
  | 'colonial'
  | 'duas_aguas'
  | 'quatro_aguas'
  | 'laje_plana'
  | 'metalico'
  | 'fibrocimento'
  | 'shed'
  | 'solo'
  | 'custom';

export interface RoofObject {
  id: string;
  type: RoofType;
  templateId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  color: string;
  imageUrl?: string; // For custom photo uploads
}

export interface DrawingShape {
  id: string;
  type: 'line' | 'rectangle' | 'freehand' | 'arrow';
  points: Point[];
  color: string;
  lineWidth: number;
}

export interface LayoutData {
  version: string;
  canvas: {
    width: number;
    height: number;
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
  };
  roofs: RoofObject[];
  modules: SolarModule[];
  shapes: DrawingShape[];
  backgroundImage?: string;
}

export interface EditorState {
  tool: EditorTool;
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  drawingColor: string;
  isDrawing: boolean;
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;
}

export type EditorTool = 
  | 'select'
  | 'pan'
  | 'module'
  | 'module_row'
  | 'roof'
  | 'line'
  | 'rectangle'
  | 'freehand'
  | 'arrow';

export interface ModuleRowConfig {
  count: number;
  orientation: 'horizontal' | 'vertical';
  spacing: number;
}

// Default values
export const DEFAULT_MODULE_WIDTH = 100;
export const DEFAULT_MODULE_HEIGHT = 170;
export const DEFAULT_GRID_SIZE = 20;

export const ROOF_TEMPLATES: RoofTemplate[] = [
  { id: 'colonial', name: 'Telhado Colonial', type: 'colonial', path: '', width: 400, height: 300, color: '#8B4513' },
  { id: 'duas_aguas', name: 'Telhado 2 Águas', type: 'duas_aguas', path: '', width: 400, height: 250, color: '#A0522D' },
  { id: 'quatro_aguas', name: 'Telhado 4 Águas', type: 'quatro_aguas', path: '', width: 350, height: 350, color: '#CD853F' },
  { id: 'laje_plana', name: 'Laje Plana', type: 'laje_plana', path: '', width: 400, height: 300, color: '#808080' },
  { id: 'metalico', name: 'Metálico Trapezoidal', type: 'metalico', path: '', width: 450, height: 280, color: '#708090' },
  { id: 'fibrocimento', name: 'Fibrocimento/Eternit', type: 'fibrocimento', path: '', width: 400, height: 300, color: '#696969' },
  { id: 'shed', name: 'Shed Industrial', type: 'shed', path: '', width: 500, height: 200, color: '#4682B4' },
  { id: 'solo', name: 'Solo (Ground Mount)', type: 'solo', path: '', width: 600, height: 400, color: '#228B22' },
];

export const DRAWING_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#000000', // black
  '#ffffff', // white
];