/**
 * ═══════════════════════════════════════════════════════════════
 * Tree Utilities — Build & Flatten block tree from flat JSON
 * ═══════════════════════════════════════════════════════════════
 */

import type { TemplateBlock, TreeNode, ProposalType } from "./types";

/** Build a tree from flat block array. Roots have parentId === null */
export function buildTree(blocks: TemplateBlock[]): TreeNode[] {
  const childrenMap = new Map<string | "root", TemplateBlock[]>();
  
  for (const block of blocks) {
    const key = block.parentId ?? "root";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(block);
  }
  
  // Sort children by order
  for (const [, children] of childrenMap) {
    children.sort((a, b) => a.order - b.order);
  }
  
  function buildNode(block: TemplateBlock): TreeNode {
    const children = (childrenMap.get(block.id) || []).map(buildNode);
    return { block, children };
  }
  
  const roots = (childrenMap.get("root") || []).map(buildNode);
  return roots;
}

/** Flatten tree back to flat array, updating order fields */
export function flattenTree(nodes: TreeNode[], parentId: string | null = null): TemplateBlock[] {
  const result: TemplateBlock[] = [];
  
  nodes.forEach((node, index) => {
    result.push({
      ...node.block,
      parentId,
      order: index,
    });
    result.push(...flattenTree(node.children, node.block.id));
  });
  
  return result;
}

/** Get all descendant block IDs (for cascade delete) */
export function getDescendantIds(blocks: TemplateBlock[], blockId: string): string[] {
  const ids: string[] = [];
  const directChildren = blocks.filter(b => b.parentId === blockId);
  
  for (const child of directChildren) {
    ids.push(child.id);
    ids.push(...getDescendantIds(blocks, child.id));
  }
  
  return ids;
}

/** Find a block by ID */
export function findBlock(blocks: TemplateBlock[], id: string): TemplateBlock | undefined {
  return blocks.find(b => b.id === id);
}

/** Get parent chain for breadcrumb */
export function getParentChain(blocks: TemplateBlock[], blockId: string): TemplateBlock[] {
  const chain: TemplateBlock[] = [];
  let current = blocks.find(b => b.id === blockId);
  
  while (current?.parentId) {
    const parent = blocks.find(b => b.id === current!.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  
  return chain;
}

/** Validate block hierarchy — returns orphan block IDs */
export function findOrphanBlocks(blocks: TemplateBlock[]): string[] {
  const ids = new Set(blocks.map(b => b.id));
  return blocks
    .filter(b => b.parentId !== null && !ids.has(b.parentId))
    .map(b => b.id);
}

/** Validate duplicate orders within same parent */
export function findDuplicateOrders(blocks: TemplateBlock[]): string[] {
  const byParent = new Map<string, Map<number, string[]>>();
  
  for (const block of blocks) {
    const key = block.parentId ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, new Map());
    const orderMap = byParent.get(key)!;
    if (!orderMap.has(block.order)) orderMap.set(block.order, []);
    orderMap.get(block.order)!.push(block.id);
  }
  
  const duplicates: string[] = [];
  for (const [, orderMap] of byParent) {
    for (const [, ids] of orderMap) {
      if (ids.length > 1) duplicates.push(...ids);
    }
  }
  
  return duplicates;
}

/** Generate unique block ID */
export function generateBlockId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Filter blocks by proposal type */
export function filterByProposalType(blocks: TemplateBlock[], type: ProposalType): TemplateBlock[] {
  return blocks.filter(b => b._proposalType === type);
}

/** Re-index order for children of a parent */
export function reindexChildren(blocks: TemplateBlock[], parentId: string | null): TemplateBlock[] {
  return blocks.map(b => {
    if (b.parentId !== parentId) return b;
    const siblings = blocks
      .filter(s => s.parentId === parentId)
      .sort((a, c) => a.order - c.order);
    const idx = siblings.findIndex(s => s.id === b.id);
    return { ...b, order: idx };
  });
}
