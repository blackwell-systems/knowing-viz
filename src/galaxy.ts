// Community view: symbols grouped by Louvain community clusters.
// Uses Cytoscape.js with compound nodes for community grouping.
// Cross-community edges highlighted in red.

import cytoscape from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';

cytoscape.use(coseBilkent);

// Color palette for communities (matches knowing dot export).
const COMMUNITY_COLORS = [
  '#E8F5E9', '#E3F2FD', '#FFF3E0', '#F3E5F5',
  '#E0F7FA', '#FBE9E7', '#F1F8E9', '#EDE7F6',
  '#E8EAF6', '#FFF8E1', '#E0F2F1', '#FCE4EC',
  '#ECEFF1', '#F9FBE7', '#E1F5FE', '#FFF9C4',
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
    const colorIdx = commId % COMMUNITY_COLORS.length;
    elements.push({
      data: {
        id: `comm:${commId}`,
        label,
        bgColor: COMMUNITY_COLORS[colorIdx],
      },
      classes: 'community',
    });
  }

  // Symbol nodes (grouped by community).
  for (const node of significantNodes) {
    elements.push({
      data: {
        id: node.id,
        label: node.shortName,
        parent: `comm:${node.community}`,
        kind: node.kind,
        fullLabel: node.label,
        package: node.package,
        signature: node.signature,
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
      // Community compound nodes.
      {
        selector: 'node.community',
        style: {
          'background-color': 'data(bgColor)',
          'border-color': '#475569',
          'border-width': 1,
          'label': 'data(label)',
          'color': '#1e293b',
          'font-size': '14px',
          'font-weight': 'bold',
          'text-valign': 'top',
          'text-halign': 'center',
          'padding': '15px',
          'shape': 'roundrectangle',
        },
      },
      // Symbol nodes.
      {
        selector: 'node[kind]',
        style: {
          'background-color': (ele: any) => kindColor(ele.data('kind')),
          'label': 'data(label)',
          'color': '#1e293b',
          'font-size': '10px',
          'width': 20,
          'height': 20,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 5,
        },
      },
      // Type nodes are ellipses.
      {
        selector: 'node.node-type',
        style: { 'shape': 'ellipse' },
      },
      // Service nodes are hexagons.
      {
        selector: 'node.node-service',
        style: { 'shape': 'hexagon', 'width': 18, 'height': 18 },
      },
      // Internal edges (within community).
      {
        selector: 'edge.internal',
        style: {
          'width': 0.5,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.3,
          'arrow-scale': 0.4,
        },
      },
      // Cross-community edges (highlighted).
      {
        selector: 'edge.cross-community',
        style: {
          'width': 2,
          'line-color': '#ef4444',
          'target-arrow-color': '#ef4444',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 0.7,
          'arrow-scale': 0.6,
        },
      },
      // Selected.
      {
        selector: ':selected',
        style: {
          'background-color': '#f59e0b',
          'border-color': '#f59e0b',
          'border-width': 3,
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
