// Timeline/diff view: compare two graph exports and show what changed.
// Added nodes glow green, removed nodes glow red, unchanged are dimmed.

import type { KnowingGraph } from './graph-data';

export interface GraphDiff {
  addedNodes: Set<string>;
  removedNodes: Set<string>;
  addedEdges: Set<string>;
  removedEdges: Set<string>;
  unchangedNodes: Set<string>;
  unchangedEdges: Set<string>;
  stats: {
    nodesAdded: number;
    nodesRemoved: number;
    edgesAdded: number;
    edgesRemoved: number;
  };
}

// Compute the diff between two graph states.
export function computeDiff(before: KnowingGraph, after: KnowingGraph): GraphDiff {
  const beforeNodeIds = new Set(before.nodes.map(n => n.id));
  const afterNodeIds = new Set(after.nodes.map(n => n.id));
  const beforeEdgeIds = new Set(before.edges.map(e => e.id));
  const afterEdgeIds = new Set(after.edges.map(e => e.id));

  const addedNodes = new Set<string>();
  const removedNodes = new Set<string>();
  const unchangedNodes = new Set<string>();
  const addedEdges = new Set<string>();
  const removedEdges = new Set<string>();
  const unchangedEdges = new Set<string>();

  for (const id of afterNodeIds) {
    if (beforeNodeIds.has(id)) {
      unchangedNodes.add(id);
    } else {
      addedNodes.add(id);
    }
  }
  for (const id of beforeNodeIds) {
    if (!afterNodeIds.has(id)) {
      removedNodes.add(id);
    }
  }

  for (const id of afterEdgeIds) {
    if (beforeEdgeIds.has(id)) {
      unchangedEdges.add(id);
    } else {
      addedEdges.add(id);
    }
  }
  for (const id of beforeEdgeIds) {
    if (!afterEdgeIds.has(id)) {
      removedEdges.add(id);
    }
  }

  return {
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges,
    unchangedNodes,
    unchangedEdges,
    stats: {
      nodesAdded: addedNodes.size,
      nodesRemoved: removedNodes.size,
      edgesAdded: addedEdges.size,
      edgesRemoved: removedEdges.size,
    },
  };
}

// Apply diff highlighting to Cytoscape.
export function applyDiffView(cy: any, diff: GraphDiff) {
  // Dim unchanged.
  cy.nodes().forEach((ele: any) => {
    const id = ele.id();
    if (diff.addedNodes.has(id)) {
      ele.style({
        'background-color': '#3fb950',
        'border-width': 3,
        'border-color': '#3fb950',
        'opacity': 1,
        'width': 22,
        'height': 22,
      });
    } else if (ele.data('kind')) {
      ele.style('opacity', 0.15);
    } else {
      ele.style('opacity', 0.2);
    }
  });

  cy.edges().forEach((ele: any) => {
    const id = ele.id();
    if (diff.addedEdges.has(id)) {
      ele.style({
        'line-color': '#3fb950',
        'target-arrow-color': '#3fb950',
        'width': 2.5,
        'opacity': 0.9,
      });
    } else {
      ele.style('opacity', 0.05);
    }
  });
}
