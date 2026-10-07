import type { DependencyGraph } from "./dependency-graph.js";

export interface ArchitectureModel {
  entryPoints: string[];
  mostImported: Array<{ file: string; incomingEdges: number }>;
  isolatedFiles: string[];
  connectedComponents: string[][];
}

export function buildArchitectureModel(graph: DependencyGraph): ArchitectureModel {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    incoming.set(node, 0);
    adjacency.set(node, new Set());
  }

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    adjacency.get(edge.from)!.add(edge.to);
    if (graph.nodes.includes(edge.to)) {
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    }
  }

  const entryPoints = graph.nodes.filter((node) => {
    const hasIncoming = (incoming.get(node) ?? 0) > 0;
    const looksLikeEntry = /(^|\/)(index|main|app|server|cli)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(node);
    return !hasIncoming || looksLikeEntry;
  });

  const mostImported = [...incoming.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, incomingEdges]) => ({ file, incomingEdges }));

  const isolatedFiles = graph.nodes.filter(
    (node) => (incoming.get(node) ?? 0) === 0 && !(adjacency.get(node)?.size)
  );

  const visited = new Set<string>();
  const connectedComponents: string[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node)) continue;

    const component: string[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = new Set([
        ...(adjacency.get(current) ?? []),
        ...graph.nodes.filter((candidate) => adjacency.get(candidate)?.has(current))
      ]);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && graph.nodes.includes(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    connectedComponents.push(component.sort());
  }

  return {
    entryPoints,
    mostImported,
    isolatedFiles,
    connectedComponents
  };
}
