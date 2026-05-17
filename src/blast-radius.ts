// Blast radius view: click a node, BFS forward, highlight everything reachable.
// Depth shown as concentric rings with fading color intensity.

import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';

export interface BlastResult {
  center: GraphNode;
  affected: Map<string, number>; // node id -> depth
  edges: GraphEdge[];
  maxDepth: number;
}

// Compute blast radius from a node via BFS over edges.
export function computeBlastRadius(
  graph: KnowingGraph,
  startId: string,
  maxDepth: number = 5
): BlastResult | null {
  const node = graph.nodes.find(n => n.id === startId);
  if (!node) return null;

  // Build adjacency (callers of the start node = who would be affected).
  const incomingByTarget = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    const list = incomingByTarget.get(e.target) || [];
    list.push(e);
    incomingByTarget.set(e.target, list);
  }

  // BFS backward (find all callers, transitively).
  const affected = new Map<string, number>();
  affected.set(startId, 0);
  const affectedEdges: GraphEdge[] = [];

  let frontier = [startId];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const incoming = incomingByTarget.get(nodeId) || [];
      for (const edge of incoming) {
        if (!affected.has(edge.source)) {
          affected.set(edge.source, depth);
          next.push(edge.source);
          affectedEdges.push(edge);
        }
      }
    }
    frontier = next;
  }

  return {
    center: node,
    affected,
    edges: affectedEdges,
    maxDepth,
  };
}

// Apply blast radius highlighting to Cytoscape.
export function applyBlastRadius(cy: any, result: BlastResult) {
  const maxDepth = Math.max(...Array.from(result.affected.values()), 1);

  // Dim everything first.
  cy.nodes().style('opacity', 0.08);
  cy.edges().style('opacity', 0.03);

  // Highlight affected nodes with depth-based intensity.
  for (const [nodeId, depth] of result.affected) {
    const ele = cy.getElementById(nodeId);
    if (ele.length === 0) continue;

    const intensity = 1.0 - (depth / (maxDepth + 1)) * 0.6;
    ele.style('opacity', intensity);

    if (depth === 0) {
      // Center node: bright gold.
      ele.style({
        'background-color': '#ffd33d',
        'border-width': 3,
        'border-color': '#ffd33d',
        'width': 28,
        'height': 28,
      });
    } else {
      // Affected nodes: red with depth-based size.
      const size = Math.max(22 - depth * 2, 12);
      const red = depth <= 2 ? '#f85149' : '#ff7b72';
      ele.style({
        'background-color': red,
        'width': size,
        'height': size,
      });
    }

    // Also highlight parent community.
    const parent = ele.data('parent');
    if (parent) {
      cy.getElementById(parent).style('opacity', 0.6);
    }
  }

  // Highlight blast radius edges.
  for (const edge of result.edges) {
    const eles = cy.edges(`[source = "${edge.source}"][target = "${edge.target}"]`);
    eles.style({
      'opacity': 0.8,
      'line-color': '#f85149',
      'target-arrow-color': '#f85149',
      'width': 2,
    });
  }
}
