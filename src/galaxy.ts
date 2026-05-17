// 2D Community view using Sigma.js (WebGL) + graphology + ForceAtlas2.
// Replaces Cytoscape for better performance and visual quality.

import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';

const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

export interface RenderOptions {
  crossCommunityOnly?: boolean;
  minConfidence?: number;
  maxNodes?: number;
  onSelect?: (node: GraphNode | null, edges: GraphEdge[]) => void;
}

export interface SigmaInstance {
  sigma: Sigma;
  graph: Graph;
  destroy: () => void;
  highlightCommunities: (ids: Set<number>) => void;
  resetHighlight: () => void;
  highlightSearch: (matchIds: Set<string>) => void;
  applyBlast: (affected: Map<string, number>) => void;
  applyProvenance: () => void;
  applyDiff: (added: Set<string>, addedEdges: Set<string>) => void;
}

export function renderSigma(
  container: HTMLElement,
  knowingGraph: KnowingGraph,
  options: RenderOptions = {}
): SigmaInstance {
  const {
    crossCommunityOnly = false,
    minConfidence = 0,
    maxNodes = 600,
  } = options;

  // Build graphology graph.
  const graph = new Graph();

  // Filter to top communities.
  const topCommunities = [...knowingGraph.communities]
    .sort((a, b) => b.size - a.size)
    .slice(0, 20)
    .map(c => c.id);
  const topCommSet = new Set(topCommunities);

  const significantNodes = knowingGraph.nodes
    .filter(n => topCommSet.has(n.community))
    .slice(0, maxNodes);
  const nodeIds = new Set(significantNodes.map(n => n.id));

  // Compute degree per node for sizing and label filtering.
  const degree = new Map<string, number>();
  for (const n of significantNodes) degree.set(n.id, 0);
  for (const e of knowingGraph.edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }

  // Top-N by degree get visible labels (avoids label soup).
  const sortedByDegree = [...degree.entries()].sort((a, b) => b[1] - a[1]);
  const topLabelCount = 40;
  const topLabelIds = new Set(sortedByDegree.slice(0, topLabelCount).map(([id]) => id));
  const maxDegree = Math.max(sortedByDegree[0]?.[1] || 1, 1);

  // Add nodes with degree-based sizing.
  for (const node of significantNodes) {
    const color = COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length];
    const deg = degree.get(node.id) || 0;
    // Size: base + log2(degree+1) * scale. Service nodes get a bonus.
    const baseSize = node.kind === 'service' ? 6 : 3;
    const size = baseSize + Math.log2(deg + 1) * 2;
    graph.addNode(node.id, {
      label: topLabelIds.has(node.id) ? node.shortName : '',
      color,
      size,
      x: Math.random() * 100,
      y: Math.random() * 100,
      community: node.community,
      kind: node.kind,
      fullLabel: node.label,
      shortName: node.shortName,
      originalColor: color,
      originalSize: size,
      degree: deg,
    });
  }

  // Add edges.
  for (const edge of knowingGraph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (crossCommunityOnly && !edge.crossCommunity) continue;
    if (edge.confidence < minConfidence) continue;
    if (edge.source === edge.target) continue; // skip self-loops

    const key = `${edge.source}-${edge.target}-${edge.type}`;
    if (graph.hasEdge(key)) continue;

    const color = edge.crossCommunity ? 'rgba(248, 81, 73, 0.4)' : 'rgba(48, 54, 61, 0.2)';
    try {
      graph.addEdgeWithKey(key, edge.source, edge.target, {
        color,
        size: edge.crossCommunity ? 1.5 : 0.5,
        type: 'arrow',
        crossCommunity: edge.crossCommunity,
        edgeType: edge.type,
        provenance: edge.provenance,
        confidence: edge.confidence,
        originalColor: color,
      });
    } catch {
      // Skip duplicate edges.
    }
  }

  // Run ForceAtlas2 layout.
  forceAtlas2.assign(graph, {
    iterations: 300,
    settings: {
      gravity: 1,
      scalingRatio: 10,
      barnesHutOptimize: true,
      strongGravityMode: true,
      slowDown: 5,
    },
  });

  // Render with Sigma.
  container.innerHTML = '';
  let hoveredNode: string | null = null;

  const sigma = new Sigma(graph, container, {
    defaultEdgeType: 'arrow',
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 5,
    labelColor: { color: '#e6edf3' },
    labelFont: '11px -apple-system, BlinkMacSystemFont, sans-serif',
    labelWeight: 'bold',
    defaultNodeColor: '#58a6ff',
    defaultEdgeColor: '#30363d',
    stagePadding: 40,
    nodeReducer: (node, data) => {
      const res = { ...data };
      // Show label on hover even for non-top-N nodes.
      if (hoveredNode && hoveredNode !== node && !graph.neighbors(hoveredNode).includes(node)) {
        res.label = '';
      }
      return res;
    },
  } as any);

  // Hover: highlight neighbors, show label.
  sigma.on('enterNode', ({ node }) => {
    hoveredNode = node;
    const neighbors = new Set(graph.neighbors(node));
    neighbors.add(node);

    graph.forEachNode((id, attrs) => {
      if (neighbors.has(id)) {
        graph.setNodeAttribute(id, 'color', attrs.originalColor);
        graph.setNodeAttribute(id, 'size', (attrs.originalSize as number) * 1.3);
        graph.setNodeAttribute(id, 'label', attrs.shortName || attrs.label || '');
      } else {
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.15)');
        graph.setNodeAttribute(id, 'size', 2);
        graph.setNodeAttribute(id, 'label', '');
      }
    });
    graph.forEachEdge((id) => {
      const src = graph.source(id);
      const tgt = graph.target(id);
      if (neighbors.has(src) && neighbors.has(tgt)) {
        graph.setEdgeAttribute(id, 'color', 'rgba(88,166,255,0.7)');
        graph.setEdgeAttribute(id, 'size', 2);
      } else {
        graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.03)');
        graph.setEdgeAttribute(id, 'size', 0.3);
      }
    });
  });

  sigma.on('leaveNode', () => {
    hoveredNode = null;
    resetHighlight();
  });

  // Click handler.
  sigma.on('clickNode', ({ node }) => {
    if (options.onSelect) {
      const gNode = knowingGraph.nodes.find(n => n.id === node) || null;
      const edges = knowingGraph.edges.filter(e => e.source === node || e.target === node);
      options.onSelect(gNode, edges);
    }
  });

  sigma.on('clickStage', () => {
    if (options.onSelect) {
      options.onSelect(null, []);
    }
  });

  // Helper methods for view switching.
  function highlightCommunities(ids: Set<number>) {
    graph.forEachNode((id, attrs) => {
      const inSet = ids.has(attrs.community as number);
      graph.setNodeAttribute(id, 'color', inSet ? attrs.originalColor : 'rgba(48,54,61,0.15)');
      graph.setNodeAttribute(id, 'size', inSet ? (attrs.originalSize as number) * 1.2 : 2);
      graph.setNodeAttribute(id, 'label', inSet ? attrs.label : '');
    });
    graph.forEachEdge((id, attrs) => {
      const srcComm = graph.getNodeAttribute(attrs.source || graph.source(id), 'community');
      const tgtComm = graph.getNodeAttribute(attrs.target || graph.target(id), 'community');
      const srcIn = ids.has(srcComm);
      const tgtIn = ids.has(tgtComm);
      if (srcIn && tgtIn) {
        graph.setEdgeAttribute(id, 'color', 'rgba(248, 81, 73, 0.7)');
        graph.setEdgeAttribute(id, 'size', 2);
      } else if (srcIn || tgtIn) {
        graph.setEdgeAttribute(id, 'color', 'rgba(248, 81, 73, 0.3)');
        graph.setEdgeAttribute(id, 'size', 1);
      } else {
        graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.03)');
        graph.setEdgeAttribute(id, 'size', 0.3);
      }
    });
  }

  function resetHighlight() {
    graph.forEachNode((id, attrs) => {
      graph.setNodeAttribute(id, 'color', attrs.originalColor);
      graph.setNodeAttribute(id, 'size', attrs.originalSize);
      graph.setNodeAttribute(id, 'label', attrs.label);
    });
    graph.forEachEdge((id, attrs) => {
      graph.setEdgeAttribute(id, 'color', attrs.originalColor);
      graph.setEdgeAttribute(id, 'size', (attrs as any).crossCommunity ? 1.5 : 0.5);
    });
  }

  function highlightSearch(matchIds: Set<string>) {
    graph.forEachNode((id, attrs) => {
      const match = matchIds.has(id);
      graph.setNodeAttribute(id, 'color', match ? attrs.originalColor : 'rgba(48,54,61,0.1)');
      graph.setNodeAttribute(id, 'size', match ? (attrs.originalSize as number) * 1.5 : 2);
    });
    graph.forEachEdge((id) => {
      const src = graph.source(id);
      const tgt = graph.target(id);
      graph.setEdgeAttribute(id, 'color', matchIds.has(src) || matchIds.has(tgt) ? 'rgba(88,166,255,0.5)' : 'rgba(48,54,61,0.02)');
    });
  }

  function applyBlast(affected: Map<string, number>) {
    const maxDepth = Math.max(...affected.values(), 1);
    graph.forEachNode((id, attrs) => {
      if (affected.has(id)) {
        const depth = affected.get(id)!;
        if (depth === 0) {
          graph.setNodeAttribute(id, 'color', '#ffd33d');
          graph.setNodeAttribute(id, 'size', 12);
        } else {
          const red = depth <= 2 ? '#f85149' : '#ff7b72';
          graph.setNodeAttribute(id, 'color', red);
          graph.setNodeAttribute(id, 'size', Math.max(10 - depth, 4));
        }
      } else {
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.08)');
        graph.setNodeAttribute(id, 'size', 2);
      }
    });
    graph.forEachEdge((id) => {
      const src = graph.source(id);
      const tgt = graph.target(id);
      if (affected.has(src) && affected.has(tgt)) {
        graph.setEdgeAttribute(id, 'color', 'rgba(248,81,73,0.7)');
        graph.setEdgeAttribute(id, 'size', 2);
      } else {
        graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.02)');
        graph.setEdgeAttribute(id, 'size', 0.3);
      }
    });
  }

  function applyProvenance() {
    const PROV_COLORS: Record<string, string> = {
      lsp_resolved: 'rgba(88,166,255,0.7)',
      ast_resolved: 'rgba(121,192,255,0.7)',
      ast_inferred: 'rgba(210,153,34,0.6)',
      runtime_calls: 'rgba(63,185,80,0.7)',
      runtime_rpc: 'rgba(63,185,80,0.7)',
      otel_trace: 'rgba(63,185,80,0.7)',
    };
    graph.forEachEdge((id, attrs) => {
      const prov = (attrs as any).provenance || '';
      const color = PROV_COLORS[prov] || 'rgba(72,79,88,0.3)';
      const conf = (attrs as any).confidence || 0.5;
      graph.setEdgeAttribute(id, 'color', color);
      graph.setEdgeAttribute(id, 'size', conf > 0.8 ? 2 : 1);
    });
  }

  function applyDiff(addedNodes: Set<string>, addedEdges: Set<string>) {
    graph.forEachNode((id) => {
      if (addedNodes.has(id)) {
        graph.setNodeAttribute(id, 'color', '#3fb950');
        graph.setNodeAttribute(id, 'size', 8);
      } else {
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.15)');
        graph.setNodeAttribute(id, 'size', 2);
      }
    });
    graph.forEachEdge((id) => {
      if (addedEdges.has(id)) {
        graph.setEdgeAttribute(id, 'color', 'rgba(63,185,80,0.8)');
        graph.setEdgeAttribute(id, 'size', 2);
      } else {
        graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.03)');
        graph.setEdgeAttribute(id, 'size', 0.3);
      }
    });
  }

  return {
    sigma,
    graph,
    destroy: () => { sigma.kill(); container.innerHTML = ''; },
    highlightCommunities,
    resetHighlight,
    highlightSearch,
    applyBlast,
    applyProvenance,
    applyDiff,
  };
}
