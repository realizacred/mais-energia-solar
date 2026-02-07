import { useState, useCallback } from 'react';
import {
  EditorState,
  EditorTool,
  LayoutData,
  SolarModule,
  RoofObject,
  DrawingShape,
  DEFAULT_GRID_SIZE,
} from '../types';

const initialState: EditorState = {
  tool: 'select',
  selectedIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  showGrid: true,
  snapToGrid: true,
  gridSize: DEFAULT_GRID_SIZE,
  drawingColor: '#ef4444',
  isDrawing: false,
  isDragging: false,
  isResizing: false,
  isRotating: false,
};

const initialLayout: LayoutData = {
  version: '1.0',
  canvas: {
    width: 1200,
    height: 800,
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    snapToGrid: true,
    gridSize: DEFAULT_GRID_SIZE,
  },
  roofs: [],
  modules: [],
  shapes: [],
};

export function useEditorState(existingLayout?: LayoutData | null) {
  const [state, setState] = useState<EditorState>(initialState);
  const [layout, setLayout] = useState<LayoutData>(existingLayout || initialLayout);
  const [history, setHistory] = useState<LayoutData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tool management
  const setTool = useCallback((tool: EditorTool) => {
    setState(prev => ({ ...prev, tool, selectedIds: [] }));
  }, []);

  // Selection
  const selectItem = useCallback((id: string, addToSelection = false) => {
    setState(prev => ({
      ...prev,
      selectedIds: addToSelection 
        ? [...prev.selectedIds, id]
        : [id],
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: [] }));
  }, []);

  // History management
  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), layout]);
    setHistoryIndex(prev => prev + 1);
  }, [layout, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setLayout(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setLayout(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Module management
  const addModule = useCallback((module: SolarModule) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      modules: [...prev.modules, module],
    }));
  }, [saveToHistory]);

  const updateModule = useCallback((id: string, updates: Partial<SolarModule>) => {
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  }, []);

  const removeModule = useCallback((id: string) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.filter(m => m.id !== id),
    }));
    setState(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.filter(sid => sid !== id),
    }));
  }, [saveToHistory]);

  const duplicateModule = useCallback((id: string) => {
    const module = layout.modules.find(m => m.id === id);
    if (module) {
      saveToHistory();
      const newModule: SolarModule = {
        ...module,
        id: `module_${Date.now()}`,
        x: module.x + 20,
        y: module.y + 20,
      };
      setLayout(prev => ({
        ...prev,
        modules: [...prev.modules, newModule],
      }));
      selectItem(newModule.id);
    }
  }, [layout.modules, saveToHistory, selectItem]);

  const addModuleRow = useCallback((startX: number, startY: number, count: number, orientation: 'horizontal' | 'vertical', spacing: number, moduleWidth: number, moduleHeight: number) => {
    saveToHistory();
    const newModules: SolarModule[] = [];
    for (let i = 0; i < count; i++) {
      newModules.push({
        id: `module_${Date.now()}_${i}`,
        x: orientation === 'horizontal' ? startX + i * (moduleWidth + spacing) : startX,
        y: orientation === 'vertical' ? startY + i * (moduleHeight + spacing) : startY,
        width: moduleWidth,
        height: moduleHeight,
        rotation: 0,
        locked: false,
      });
    }
    setLayout(prev => ({
      ...prev,
      modules: [...prev.modules, ...newModules],
    }));
  }, [saveToHistory]);

  // Roof management
  const addRoof = useCallback((roof: RoofObject) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      roofs: [...prev.roofs, roof],
    }));
  }, [saveToHistory]);

  const updateRoof = useCallback((id: string, updates: Partial<RoofObject>) => {
    setLayout(prev => ({
      ...prev,
      roofs: prev.roofs.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  const removeRoof = useCallback((id: string) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      roofs: prev.roofs.filter(r => r.id !== id),
    }));
  }, [saveToHistory]);

  // Shape management
  const addShape = useCallback((shape: DrawingShape) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      shapes: [...prev.shapes, shape],
    }));
  }, [saveToHistory]);

  const removeLastShape = useCallback(() => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      shapes: prev.shapes.slice(0, -1),
    }));
  }, [saveToHistory]);

  // Zoom and pan
  const setZoom = useCallback((zoom: number) => {
    const clampedZoom = Math.max(0.25, Math.min(3, zoom));
    setState(prev => ({ ...prev, zoom: clampedZoom }));
    setLayout(prev => ({
      ...prev,
      canvas: { ...prev.canvas, zoom: clampedZoom },
    }));
  }, []);

  const setPan = useCallback((panX: number, panY: number) => {
    setState(prev => ({ ...prev, panX, panY }));
    setLayout(prev => ({
      ...prev,
      canvas: { ...prev.canvas, panX, panY },
    }));
  }, []);

  // Grid settings
  const toggleGrid = useCallback(() => {
    setState(prev => ({ ...prev, showGrid: !prev.showGrid }));
    setLayout(prev => ({
      ...prev,
      canvas: { ...prev.canvas, showGrid: !prev.canvas.showGrid },
    }));
  }, []);

  const toggleSnap = useCallback(() => {
    setState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid }));
    setLayout(prev => ({
      ...prev,
      canvas: { ...prev.canvas, snapToGrid: !prev.canvas.snapToGrid },
    }));
  }, []);

  // Snap helper
  const snapToGridValue = useCallback((value: number) => {
    if (!state.snapToGrid) return value;
    return Math.round(value / state.gridSize) * state.gridSize;
  }, [state.snapToGrid, state.gridSize]);

  // Rotate selected
  const rotateSelected = useCallback((degrees: number) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.map(m => 
        state.selectedIds.includes(m.id) && !m.locked
          ? { ...m, rotation: (m.rotation + degrees) % 360 }
          : m
      ),
      roofs: prev.roofs.map(r => 
        state.selectedIds.includes(r.id) && !r.locked
          ? { ...r, rotation: (r.rotation + degrees) % 360 }
          : r
      ),
    }));
  }, [state.selectedIds, saveToHistory]);

  // Delete selected
  const deleteSelected = useCallback(() => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.filter(m => !state.selectedIds.includes(m.id) || m.locked),
      roofs: prev.roofs.filter(r => !state.selectedIds.includes(r.id) || r.locked),
    }));
    clearSelection();
  }, [state.selectedIds, saveToHistory, clearSelection]);

  // Lock/unlock selected
  const toggleLockSelected = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      modules: prev.modules.map(m => 
        state.selectedIds.includes(m.id) ? { ...m, locked: !m.locked } : m
      ),
      roofs: prev.roofs.map(r => 
        state.selectedIds.includes(r.id) ? { ...r, locked: !r.locked } : r
      ),
    }));
  }, [state.selectedIds]);

  // Set drawing color
  const setDrawingColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, drawingColor: color }));
  }, []);

  // Set background image
  const setBackgroundImage = useCallback((imageUrl: string | undefined) => {
    saveToHistory();
    setLayout(prev => ({
      ...prev,
      backgroundImage: imageUrl,
    }));
  }, [saveToHistory]);

  return {
    state,
    setState,
    layout,
    setLayout,
    
    // Tools
    setTool,
    
    // Selection
    selectItem,
    clearSelection,
    
    // History
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    
    // Modules
    addModule,
    updateModule,
    removeModule,
    duplicateModule,
    addModuleRow,
    
    // Roofs
    addRoof,
    updateRoof,
    removeRoof,
    
    // Shapes
    addShape,
    removeLastShape,
    
    // View
    setZoom,
    setPan,
    toggleGrid,
    toggleSnap,
    snapToGridValue,
    
    // Actions
    rotateSelected,
    deleteSelected,
    toggleLockSelected,
    setDrawingColor,
    setBackgroundImage,
  };
}