/**
 * Topological sort utility for custom variable dependency resolution.
 * Ensures variables are evaluated in correct order when they reference each other.
 */

import { extractVariables } from "./expressionEngine";

export interface SortableVariable {
  nome: string;
  expressao: string;
}

interface TopoResult<T extends SortableVariable> {
  sorted: T[];
  cycles: string[][];
}

/**
 * Topologically sorts variables by their expression dependencies.
 * Variables that depend on others are evaluated after their dependencies.
 * Detects circular dependencies and excludes them from sorted output.
 */
export function topologicalSortVariables<T extends SortableVariable>(
  variables: T[],
): TopoResult<T> {
  const nameToVar = new Map<string, T>();
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Build the graph
  for (const v of variables) {
    nameToVar.set(v.nome, v);
    graph.set(v.nome, new Set());
    inDegree.set(v.nome, 0);
  }

  const customNames = new Set(variables.map(v => v.nome));

  for (const v of variables) {
    const deps = extractVariables(v.expressao || "");
    for (const dep of deps) {
      // Only track dependencies on other custom variables
      if (customNames.has(dep) && dep !== v.nome) {
        graph.get(dep)!.add(v.nome);
        inDegree.set(v.nome, (inDegree.get(v.nome) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: T[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const name = queue.shift()!;
    visited.add(name);
    const v = nameToVar.get(name);
    if (v) sorted.push(v);

    for (const dependent of graph.get(name) || []) {
      const newDegree = (inDegree.get(dependent) || 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  // Detect cycles (remaining unvisited nodes)
  const cycles: string[][] = [];
  const unvisited = variables.filter(v => !visited.has(v.nome));
  if (unvisited.length > 0) {
    // Group cycles by connected components
    const remaining = new Set(unvisited.map(v => v.nome));
    for (const v of unvisited) {
      if (!remaining.has(v.nome)) continue;
      const cycle: string[] = [v.nome];
      remaining.delete(v.nome);
      const deps = extractVariables(v.expressao || "");
      for (const dep of deps) {
        if (remaining.has(dep)) {
          cycle.push(dep);
          remaining.delete(dep);
        }
      }
      cycles.push(cycle);
    }
  }

  return { sorted, cycles };
}
