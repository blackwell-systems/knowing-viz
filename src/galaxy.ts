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

export type GroupBy = 'community' | 'package' | 'author';

export interface RenderOptions {
  crossCommunityOnly?: boolean;
  minConfidence?: number;
  maxNodes?: number;
  nodeScale?: number;       // multiplier for node sizes (default 1.0)
  topLabelCount?: number;   // how many top-degree nodes show labels (default 40)
  edgeOpacity?: number;     // 0-1 multiplier for edge opacity (default 1.0)
  labelSize?: number;       // font size in px (default 11)
  gravity?: number;         // ForceAtlas2 gravity (default 0.5, higher = tighter)
  spread?: number;          // ForceAtlas2 scaling ratio (default 30, higher = more spread)
  groupBy?: GroupBy;        // how to group nodes: 'community' (Louvain), 'package', 'author'
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
  applyBlame: () => Map<string, string>;
  highlightAuthor: (author: string) => void;
  applyCoverage: () => void;
  getGroupLabels: () => { id: number; label: string; size: number }[];
}

export function renderSigma(
  container: HTMLElement,
  knowingGraph: KnowingGraph,
  options: RenderOptions = {}
): SigmaInstance {
  const {
    crossCommunityOnly = false,
    minConfidence = 0,
    maxNodes = Infinity,
    nodeScale = 1.0,
    topLabelCount = 40,
    edgeOpacity = 1.0,
    labelSize = 11,
    gravity = 0.5,
    spread = 30,
  } = options;

  const groupBy = options.groupBy || 'community';

  // Build graphology graph.
  const graph = new Graph();

  // Compute group assignment for each node based on groupBy mode.
  const nodeGroup = new Map<string, string>(); // node id -> group label
  // Build community ID -> label lookup from export data.
  const commLabelMap = new Map<number, string>();
  for (const c of knowingGraph.communities) {
    commLabelMap.set(c.id, c.label);
  }
  for (const n of knowingGraph.nodes) {
    switch (groupBy) {
      case 'package':
        nodeGroup.set(n.id, n.package || 'unknown');
        break;
      case 'author':
        nodeGroup.set(n.id, n.lastAuthor || 'unknown');
        break;
      case 'community':
      default:
        nodeGroup.set(n.id, commLabelMap.get(n.community) || `community ${n.community}`);
        break;
    }
  }

  // Count group sizes and pick top 20.
  const groupSizes = new Map<string, number>();
  for (const g of nodeGroup.values()) {
    groupSizes.set(g, (groupSizes.get(g) || 0) + 1);
  }
  const topGroups = [...groupSizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([g]) => g);
  const topGroupSet = new Set(topGroups);

  // Map group labels to numeric IDs for coloring.
  const groupToId = new Map<string, number>();
  topGroups.forEach((g, i) => groupToId.set(g, i));

  const significantNodes = knowingGraph.nodes
    .filter(n => topGroupSet.has(nodeGroup.get(n.id) || ''))
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
  const topLabelIds = new Set(sortedByDegree.slice(0, topLabelCount).map(([id]) => id));
  const maxDegree = Math.max(sortedByDegree[0]?.[1] || 1, 1);

  // Seed positions: groups placed on a circle.
  const groupPosition = new Map<string, { x: number; y: number }>();
  topGroups.forEach((g, i) => {
    const angle = (i / topGroups.length) * Math.PI * 2;
    const r = 50;
    groupPosition.set(g, {
      x: 50 + Math.cos(angle) * r,
      y: 50 + Math.sin(angle) * r,
    });
  });

  // Add nodes with degree-based sizing, seeded near their group position.
  for (const node of significantNodes) {
    const group = nodeGroup.get(node.id) || '0';
    const gid = groupToId.get(group) || 0;
    const color = COMMUNITY_COLORS[gid % COMMUNITY_COLORS.length];
    const deg = degree.get(node.id) || 0;
    const baseSize = node.kind === 'service' ? 6 : 3;
    const size = (baseSize + Math.log2(deg + 1) * 2) * nodeScale;
    const pos = groupPosition.get(group) || { x: 50, y: 50 };
    graph.addNode(node.id, {
      label: topLabelIds.has(node.id) ? node.shortName : '',
      color,
      size,
      x: pos.x + (Math.random() - 0.5) * 5,
      y: pos.y + (Math.random() - 0.5) * 5,
      community: gid,
      groupLabel: group,
      kind: node.kind,
      fullLabel: node.label,
      shortName: node.shortName,
      originalColor: color,
      originalSize: size,
      degree: deg,
      lastAuthor: node.lastAuthor || '',
      lastCommitAt: node.lastCommitAt || 0,
      coveragePct: node.coveragePct ?? -1,
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

    const crossAlpha = (0.4 * edgeOpacity).toFixed(2);
    const intAlpha = (0.2 * edgeOpacity).toFixed(2);
    const color = edge.crossCommunity ? `rgba(248, 81, 73, ${crossAlpha})` : `rgba(100, 116, 139, ${intAlpha})`;
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
  // These defaults produced the best cluster separation (original working version).
  forceAtlas2.assign(graph, {
    iterations: 300,
    settings: {
      gravity: gravity,
      scalingRatio: spread,
      barnesHutOptimize: true,
      strongGravityMode: true,
      slowDown: 5,
    },
  });


  // Render with Sigma.
  container.innerHTML = '';
  let hoveredNode: string | null = null;
  let blastActive = false; // true when blast radius view is pinned on a clicked node
  let activeOverlay: 'none' | 'blast' | 'provenance' | 'blame' | 'coverage' | 'diff' = 'none';

  const sigma = new Sigma(graph, container, {
    defaultEdgeType: 'arrow',
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 8,
    labelColor: { attribute: 'labelColor', color: '#c9d1d9' },
    labelFont: `${labelSize}px -apple-system, BlinkMacSystemFont, sans-serif`,
    labelWeight: 'bold',
    defaultNodeColor: '#58a6ff',
    defaultEdgeColor: '#30363d',
    stagePadding: 40,
    labelBackgroundColor: 'transparent',
    hoverRenderer: () => {},
    zIndex: true,
    minCameraRatio: 0.08,
    maxCameraRatio: 8,
  } as any);

  // Cursor feedback.
  sigma.on('enterNode', () => { container.style.cursor = 'pointer'; });
  sigma.on('leaveNode', () => { container.style.cursor = 'default'; });

  // Hover: highlight neighbors, show label. Skipped when an overlay is active.
  sigma.on('enterNode', ({ node }) => {
    if (activeOverlay !== 'none') return;
    hoveredNode = node;
    const neighbors = new Set(graph.neighbors(node));
    neighbors.add(node);

    graph.forEachNode((id, attrs) => {
      if (id === node) {
        // Hovered node: highlighted, dark label text for contrast.
        graph.setNodeAttribute(id, 'color', attrs.originalColor);
        graph.setNodeAttribute(id, 'size', (attrs.originalSize as number) * 1.6);
        graph.setNodeAttribute(id, 'label', attrs.shortName || attrs.label || '');
        graph.setNodeAttribute(id, 'labelColor', '#000000');
      } else if (neighbors.has(id)) {
        graph.setNodeAttribute(id, 'color', attrs.originalColor);
        graph.setNodeAttribute(id, 'size', (attrs.originalSize as number) * 1.2);
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
    if (activeOverlay !== 'none') return;
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
    resetHighlight();
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
    activeOverlay = 'none';
    blastActive = false;
    graph.forEachNode((id, attrs) => {
      graph.setNodeAttribute(id, 'color', attrs.originalColor);
      graph.setNodeAttribute(id, 'size', attrs.originalSize);
      graph.setNodeAttribute(id, 'label', attrs.label);
      graph.removeNodeAttribute(id, 'labelColor');
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
    blastActive = true;
    activeOverlay = 'blast';
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
    activeOverlay = 'provenance';
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
    activeOverlay = 'diff';
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

  // Blame overlay: color nodes by author, dim unattributed.
  function applyBlame() {
    activeOverlay = 'blame';
    const authorColors = new Map<string, string>();
    const palette = [
      '#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#39d2c0',
      '#f85149', '#7ee787', '#79c0ff', '#ffd33d', '#56d4dd',
      '#ff7b72', '#a5d6ff', '#d2a8ff', '#e3b341', '#2ea043',
    ];
    let colorIdx = 0;
    let attributed = 0;

    let debugFirst = true;
    graph.forEachNode((id, attrs) => {
      const author = (attrs as any).lastAuthor || '';
      if (debugFirst) {
        console.log('[blame] first node attrs:', JSON.stringify(Object.keys(attrs)));
        console.log('[blame] lastAuthor value:', JSON.stringify(author));
        console.log('[blame] all attrs:', JSON.stringify(attrs));
        debugFirst = false;
      }
      if (!author) {
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.15)');
        graph.setNodeAttribute(id, 'size', 2);
        graph.setNodeAttribute(id, 'label', '');
        return;
      }
      attributed++;
      if (!authorColors.has(author)) {
        authorColors.set(author, palette[colorIdx % palette.length]);
        colorIdx++;
      }
      const authorColor = authorColors.get(author)!;
      graph.setNodeAttribute(id, 'color', authorColor);
      graph.setNodeAttribute(id, 'size', Math.max((attrs.originalSize as number) || 5, 6));
      graph.setNodeAttribute(id, 'label', attrs.shortName || '');
      graph.setNodeAttribute(id, 'zIndex', 1);
    });
    graph.forEachEdge((id) => {
      graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.08)');
      graph.setEdgeAttribute(id, 'size', 0.5);
    });

    console.log(`[blame] ${attributed} attributed nodes, ${authorColors.size} authors`);
    // Force full re-render: Sigma caches WebGL state and refresh() alone
    // may not update all node colors. Toggle a camera state to force it.
    sigma.refresh({ skipIndexation: false });
    const cam = sigma.getCamera();
    cam.setState({ ...cam.getState(), ratio: cam.getState().ratio * 1.0001 });
    setTimeout(() => {
      cam.setState({ ...cam.getState(), ratio: cam.getState().ratio / 1.0001 });
    }, 50);
    return authorColors;
  }

  // Highlight a single author, dim everyone else.
  function highlightAuthor(author: string) {
    activeOverlay = 'blame';
    graph.forEachNode((id, attrs) => {
      const nodeAuthor = (attrs as any).lastAuthor || '';
      if (nodeAuthor === author) {
        graph.setNodeAttribute(id, 'color', attrs.originalColor || '#58a6ff');
        graph.setNodeAttribute(id, 'size', (attrs.originalSize as number || 5) * 1.3);
        graph.setNodeAttribute(id, 'label', attrs.shortName || '');
      } else {
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.1)');
        graph.setNodeAttribute(id, 'size', 2);
        graph.setNodeAttribute(id, 'label', '');
      }
    });
    graph.forEachEdge((id) => {
      const src = graph.source(id);
      const tgt = graph.target(id);
      const srcAuthor = (graph.getNodeAttributes(src) as any).lastAuthor || '';
      const tgtAuthor = (graph.getNodeAttributes(tgt) as any).lastAuthor || '';
      if (srcAuthor === author && tgtAuthor === author) {
        graph.setEdgeAttribute(id, 'color', 'rgba(88,166,255,0.5)');
        graph.setEdgeAttribute(id, 'size', 1.5);
      } else {
        graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.03)');
        graph.setEdgeAttribute(id, 'size', 0.3);
      }
    });
    sigma.refresh();
  }

  // Coverage heatmap: green = covered, red = uncovered, gray = not measured.
  function applyCoverage() {
    activeOverlay = 'coverage';
    graph.forEachNode((id, attrs) => {
      const pct = (attrs as any).coveragePct ?? -1;
      if (pct < 0) {
        // Not measured.
        graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.2)');
        graph.setNodeAttribute(id, 'size', 3);
        graph.setNodeAttribute(id, 'label', '');
      } else if (pct === 0) {
        // Zero coverage: bright red.
        graph.setNodeAttribute(id, 'color', '#f85149');
        graph.setNodeAttribute(id, 'size', 8);
        graph.setNodeAttribute(id, 'label', attrs.shortName || '');
      } else if (pct < 50) {
        // Low coverage: orange.
        graph.setNodeAttribute(id, 'color', '#d29922');
        graph.setNodeAttribute(id, 'size', 6);
        graph.setNodeAttribute(id, 'label', attrs.shortName || '');
      } else if (pct < 80) {
        // Medium coverage: yellow-green.
        graph.setNodeAttribute(id, 'color', '#7ee787');
        graph.setNodeAttribute(id, 'size', 5);
        graph.setNodeAttribute(id, 'label', '');
      } else {
        // High coverage: green.
        graph.setNodeAttribute(id, 'color', '#3fb950');
        graph.setNodeAttribute(id, 'size', 5);
        graph.setNodeAttribute(id, 'label', '');
      }
    });
    graph.forEachEdge((id) => {
      graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.05)');
      graph.setEdgeAttribute(id, 'size', 0.3);
    });
    sigma.refresh();
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
    applyBlame,
    highlightAuthor,
    applyCoverage,
    getGroupLabels: () => {
      return topGroups.map((g, i) => ({
        id: i,
        label: g,
        size: groupSizes.get(g) || 0,
      }));
    },
  };
}
