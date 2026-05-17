// Community view: symbols grouped by Louvain community clusters.
// Uses Cytoscape.js with compound nodes for community grouping.
// Cross-community edges highlighted in red.

import cytoscape from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';

cytoscape.use(coseBilkent);

// Community colors (vibrant for dark backgrounds).
const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

// Node colors by kind.
const KIND_COLORS: Record<string, string> = {
  function: '#3b82f6',
  type: '#8b5cf6',
  service: '#10b981',
  method: '#06b6d4',
  interface: '#a78bfa',
  var: '#f59e0b',
  default: '#64748b',
};

function kindColor(kind: string): string {
  return KIND_COLORS[kind] || KIND_COLORS.default;
}

export interface RenderOptions {
  crossCommunityOnly?: boolean;
  minConfidence?: number;
  maxNodes?: number;
  onSelect?: (node: GraphNode | null, edges: GraphEdge[]) => void;
}

export function renderGalaxy(
  container: HTMLElement,
  graph: KnowingGraph,
  options: RenderOptions = {}
): cytoscape.Core {
  const {
    crossCommunityOnly = false,
    minConfidence = 0,
    maxNodes = 500,
  } = options;

  const elements: cytoscape.ElementDefinition[] = [];

  // Only render nodes in the top communities by size.
  // Sort communities by size, take top 15 for readability.
  const topCommunities = [...graph.communities]
    .sort((a, b) => b.size - a.size)
    .slice(0, 15)
    .map(c => c.id);
  const topCommSet = new Set(topCommunities);

  const significantNodes = graph.nodes
    .filter(n => topCommSet.has(n.community))
    .slice(0, maxNodes);

  const nodeIds = new Set(significantNodes.map(n => n.id));

  // Community label map.
  const communityLabels = new Map<number, string>();
  for (const c of graph.communities) {
    communityLabels.set(c.id, c.label);
  }

  // Determine which communities are represented.
  const activeCommunities = new Set<number>();
  for (const n of significantNodes) {
    activeCommunities.add(n.community);
  }

  // Community compound nodes.
  for (const commId of activeCommunities) {
    const label = communityLabels.get(commId) || `community_${commId}`;
    const color = COMMUNITY_COLORS[commId % COMMUNITY_COLORS.length];
    elements.push({
      data: {
        id: `comm:${commId}`,
        label,
        communityColor: color,
      },
      classes: 'community',
    });
  }

  // Symbol nodes (grouped by community).
  for (const node of significantNodes) {
    const color = COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length];
    elements.push({
      data: {
        id: node.id,
        label: node.shortName,
        parent: `comm:${node.community}`,
        kind: node.kind,
        fullLabel: node.label,
        package: node.package,
        signature: node.signature,
        nodeColor: color,
      },
      classes: `node-${node.kind}`,
    });
  }

  // Edges (filtered).
  for (const edge of graph.edges) {
    if (crossCommunityOnly && !edge.crossCommunity) continue;
    if (edge.confidence < minConfidence) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType: edge.type,
        provenance: edge.provenance,
        confidence: edge.confidence,
        crossCommunity: edge.crossCommunity,
      },
      classes: edge.crossCommunity ? 'cross-community' : 'internal',
    });
  }

  const cy = cytoscape({
    container,
    elements,
    style: [
      // Community compound nodes (dark semi-transparent backgrounds).
      {
        selector: 'node.community',
        style: {
          'background-color': '#161b22',
          'background-opacity': 0.8,
          'border-color': 'data(communityColor)',
          'border-width': 2,
          'border-opacity': 0.6,
          'label': 'data(label)',
          'color': '#8b949e',
          'font-size': '12px',
          'font-weight': 'bold',
          'text-valign': 'top',
          'text-halign': 'center',
          'padding': '20px',
          'shape': 'roundrectangle',
        },
      },
      // Symbol nodes (colored by community).
      {
        selector: 'node[kind]',
        style: {
          'background-color': 'data(nodeColor)',
          'label': 'data(label)',
          'color': '#c9d1d9',
          'font-size': '9px',
          'width': 16,
          'height': 16,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 4,
          'border-width': 0,
        },
      },
      // Type nodes.
      {
        selector: 'node.node-type',
        style: { 'shape': 'ellipse', 'width': 14, 'height': 14 },
      },
      // Service nodes.
      {
        selector: 'node.node-service',
        style: { 'shape': 'hexagon', 'width': 20, 'height': 20 },
      },
      // Internal edges (subtle).
      {
        selector: 'edge.internal',
        style: {
          'width': 0.5,
          'line-color': '#30363d',
          'target-arrow-color': '#30363d',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.3,
          'arrow-scale': 0.4,
        },
      },
      // Cross-community edges (visible).
      {
        selector: 'edge.cross-community',
        style: {
          'width': 1.5,
          'line-color': '#f85149',
          'target-arrow-color': '#f85149',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.5,
          'arrow-scale': 0.5,
        },
      },
      // Selected node.
      {
        selector: ':selected',
        style: {
          'background-color': '#ffd33d',
          'border-color': '#ffd33d',
          'border-width': 3,
          'width': 24,
          'height': 24,
        },
      },
    ],
    layout: {
      name: 'cose-bilkent',
      animate: false,
      quality: 'proof',
      nodeRepulsion: 8000,
      idealEdgeLength: 120,
      edgeElasticity: 0.1,
      nestingFactor: 0.2,
      gravity: 0.3,
      gravityRange: 1.5,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 20,
      tilingPaddingHorizontal: 20,
    } as any,
  });

  // Selection handler.
  if (options.onSelect) {
    cy.on('tap', 'node[kind]', (evt) => {
      const nodeId = evt.target.id();
      const graphNode = graph.nodes.find(n => n.id === nodeId) || null;
      const connectedEdges = graph.edges.filter(
        e => e.source === nodeId || e.target === nodeId
      );
      options.onSelect!(graphNode, connectedEdges);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        options.onSelect!(null, []);
      }
    });
  }

  return cy;
}
