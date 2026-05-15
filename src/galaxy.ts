// Galaxy view: repos as clusters, cross-repo edges as arcs.
// Uses Cytoscape.js with compound nodes for repo grouping.

import cytoscape from 'cytoscape';
import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';

// Color palette by provenance.
const PROVENANCE_COLORS: Record<string, string> = {
  lsp_resolved: '#60a5fa',   // blue
  ast_resolved: '#818cf8',   // indigo
  ast_inferred: '#f59e0b',   // amber
  runtime_calls: '#10b981',  // green
  runtime_rpc: '#10b981',
  default: '#4b5563',        // gray
};

// Color palette by edge type.
const EDGE_TYPE_COLORS: Record<string, string> = {
  calls: '#60a5fa',
  imports: '#6b7280',
  implements: '#a78bfa',
  references: '#f472b6',
  default: '#4b5563',
};

function provenanceColor(provenance: string): string {
  return PROVENANCE_COLORS[provenance] || PROVENANCE_COLORS.default;
}

function edgeTypeColor(edgeType: string): string {
  return EDGE_TYPE_COLORS[edgeType] || EDGE_TYPE_COLORS.default;
}

export function renderGalaxy(
  container: HTMLElement,
  graph: KnowingGraph,
  options: {
    crossRepoOnly?: boolean;
    minConfidence?: number;
    colorBy?: 'provenance' | 'type';
    onSelect?: (node: GraphNode | null, edges: GraphEdge[]) => void;
  } = {}
): cytoscape.Core {
  const { crossRepoOnly = false, minConfidence = 0, colorBy = 'provenance' } = options;

  // Build Cytoscape elements.
  const elements: cytoscape.ElementDefinition[] = [];

  // Repo compound nodes.
  for (const repo of graph.repos) {
    elements.push({
      data: {
        id: `repo:${repo.id}`,
        label: repo.url.split('/').pop() || repo.id,
      },
      classes: 'repo',
    });
  }

  // Symbol nodes (grouped by repo).
  for (const node of graph.nodes) {
    elements.push({
      data: {
        id: node.id,
        label: node.label.split('.').pop() || node.label,
        parent: `repo:${node.repo}`,
        kind: node.kind,
        fullLabel: node.label,
        package: node.package,
      },
      classes: `node-${node.kind}`,
    });
  }

  // Edges (filtered).
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  for (const edge of graph.edges) {
    if (crossRepoOnly && !edge.crossRepo) continue;
    if (edge.confidence < minConfidence) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    const color = colorBy === 'provenance'
      ? provenanceColor(edge.provenance)
      : edgeTypeColor(edge.type);

    elements.push({
      data: {
        id: `${edge.source}-${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        edgeType: edge.type,
        provenance: edge.provenance,
        confidence: edge.confidence,
        crossRepo: edge.crossRepo,
        color,
      },
      classes: edge.crossRepo ? 'cross-repo' : '',
    });
  }

  const cy = cytoscape({
    container,
    elements,
    style: [
      {
        selector: 'node.repo',
        style: {
          'background-color': '#1a1a2e',
          'border-color': '#2a2a4e',
          'border-width': 2,
          'label': 'data(label)',
          'color': '#888',
          'font-size': '14px',
          'text-valign': 'top',
          'text-halign': 'center',
          'padding': '20px',
        },
      },
      {
        selector: 'node[kind]',
        style: {
          'background-color': '#2a3a5e',
          'label': 'data(label)',
          'color': '#ccc',
          'font-size': '8px',
          'width': 12,
          'height': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node.node-function',
        style: { 'background-color': '#3b82f6' },
      },
      {
        selector: 'node.node-type',
        style: { 'background-color': '#8b5cf6' },
      },
      {
        selector: 'node.node-interface',
        style: { 'background-color': '#a78bfa' },
      },
      {
        selector: 'node.node-method',
        style: { 'background-color': '#06b6d4' },
      },
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': 'data(color)',
          'target-arrow-color': 'data(color)',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 'data(confidence)',
          'arrow-scale': 0.6,
        },
      },
      {
        selector: 'edge.cross-repo',
        style: {
          'width': 2,
          'line-style': 'solid',
        },
      },
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
      name: 'cose',
      animate: false,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 100,
      nodeOverlap: 20,
    },
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
