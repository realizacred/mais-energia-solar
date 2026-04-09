/**
 * Builder State Reducer — Immutable state management with undo/redo
 */

import type { BuilderState, BuilderAction, TemplateBlock } from "./types";
import { getDescendantIds, reindexChildren } from "./treeUtils";

const MAX_UNDO = 50;

function pushUndo(state: BuilderState): BuilderState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-MAX_UNDO), state.blocks],
    redoStack: [],
  };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "SET_BLOCKS":
      return { ...state, blocks: action.blocks, undoStack: [], redoStack: [], isDirty: false };

    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.id };

    case "HOVER_BLOCK":
      return { ...state, hoveredBlockId: action.id };

    case "ADD_BLOCK": {
      const s = pushUndo(state);
      const siblings = s.blocks.filter(b => b.parentId === action.parentId);
      const insertAt = action.index ?? siblings.length;
      
      // Shift order for existing siblings
      const updated = s.blocks.map(b => {
        if (b.parentId === action.parentId && b.order >= insertAt) {
          return { ...b, order: b.order + 1 };
        }
        return b;
      });
      
      const newBlock: TemplateBlock = {
        ...action.block,
        parentId: action.parentId,
        order: insertAt,
      };
      
      return { ...s, blocks: [...updated, newBlock], isDirty: true, selectedBlockId: newBlock.id };
    }

    case "ADD_BLOCKS": {
      const s = pushUndo(state);
      // Insert multiple blocks (from section templates)
      const rootBlocks = action.blocks.filter(b => b.parentId === null);
      const existingRoots = s.blocks.filter(b => b.parentId === null);
      // Offset root orders
      const offset = existingRoots.length;
      const newBlocks = action.blocks.map(b => {
        if (b.parentId === null) {
          return { ...b, order: b.order + offset, _proposalType: state.proposalType };
        }
        return { ...b, _proposalType: state.proposalType };
      });
      return { ...s, blocks: [...s.blocks, ...newBlocks], isDirty: true, selectedBlockId: rootBlocks[0]?.id ?? s.selectedBlockId };
    }

    case "DUPLICATE_BLOCK": {
      const s = pushUndo(state);
      const original = s.blocks.find(b => b.id === action.id);
      if (!original) return state;
      
      // Deep clone block and all descendants
      const idMap = new Map<string, string>();
      const allIds = [action.id, ...getDescendantIds(s.blocks, action.id)];
      allIds.forEach(id => {
        const b = s.blocks.find(bl => bl.id === id)!;
        idMap.set(id, `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      });
      
      const clones = allIds.map(id => {
        const b = s.blocks.find(bl => bl.id === id)!;
        return {
          ...b,
          id: idMap.get(id)!,
          parentId: b.parentId ? (idMap.get(b.parentId) ?? b.parentId) : b.parentId,
          order: b.id === action.id ? b.order + 1 : b.order,
        };
      });
      
      // Shift siblings after the original
      const shifted = s.blocks.map(b => {
        if (b.parentId === original.parentId && b.order > original.order) {
          return { ...b, order: b.order + 1 };
        }
        return b;
      });
      
      return { ...s, blocks: [...shifted, ...clones], isDirty: true, selectedBlockId: idMap.get(action.id)! };
    }

    case "SWAP_ORDER": {
      const s = pushUndo(state);
      const block = s.blocks.find(b => b.id === action.id);
      if (!block) return state;
      const siblings = s.blocks
        .filter(b => b.parentId === block.parentId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex(b => b.id === action.id);
      const targetIdx = idx + action.direction;
      if (targetIdx < 0 || targetIdx >= siblings.length) return state;
      const target = siblings[targetIdx];
      const blocks = s.blocks.map(b => {
        if (b.id === action.id) return { ...b, order: target.order };
        if (b.id === target.id) return { ...b, order: block.order };
        return b;
      });
      return { ...s, blocks, isDirty: true };
    }

    case "REMOVE_BLOCK": {
      const s = pushUndo(state);
      const idsToRemove = new Set([action.id, ...getDescendantIds(s.blocks, action.id)]);
      const remaining = s.blocks.filter(b => !idsToRemove.has(b.id));
      const removedBlock = s.blocks.find(b => b.id === action.id);
      const reindexed = removedBlock ? reindexChildren(remaining, removedBlock.parentId) : remaining;
      return {
        ...s,
        blocks: reindexed,
        isDirty: true,
        selectedBlockId: s.selectedBlockId === action.id ? null : s.selectedBlockId,
      };
    }

    case "UPDATE_BLOCK": {
      const s = pushUndo(state);
      return {
        ...s,
        blocks: s.blocks.map(b => b.id === action.id ? { ...b, ...action.updates } : b),
        isDirty: true,
      };
    }

    case "MOVE_BLOCK": {
      const s = pushUndo(state);
      const block = s.blocks.find(b => b.id === action.id);
      if (!block) return state;
      
      // Remove from old parent, add to new
      let blocks = s.blocks.map(b => {
        if (b.id === action.id) {
          return { ...b, parentId: action.newParentId, order: action.newIndex };
        }
        return b;
      });
      
      // Reindex old parent
      blocks = reindexChildren(blocks, block.parentId);
      // Reindex new parent
      blocks = reindexChildren(blocks, action.newParentId);
      
      return { ...s, blocks, isDirty: true };
    }

    case "SET_DEVICE":
      return { ...state, device: action.device };

    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_PROPOSAL_TYPE":
      return { ...state, proposalType: action.proposalType };

    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        blocks: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.blocks],
        isDirty: true,
      };
    }

    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        blocks: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.blocks],
        isDirty: true,
      };
    }

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    default:
      return state;
  }
}

export const initialBuilderState: BuilderState = {
  blocks: [],
  selectedBlockId: null,
  hoveredBlockId: null,
  device: "desktop",
  mode: "edit",
  proposalType: "grid",
  undoStack: [],
  redoStack: [],
  isDirty: false,
};
