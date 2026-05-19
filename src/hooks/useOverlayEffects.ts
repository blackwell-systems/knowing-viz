/**
 * useOverlayEffects: applies view-specific overlays to the Sigma graph.
 *
 * This hook runs INSIDE the SigmaContainer context (rendered as a child of
 * SigmaContainer) so it can call useSigma() from @react-sigma/core to access
 * the live Sigma instance.
 *
 * Port of overlay logic from galaxy.ts:
 *   highlightCommunities (lines 296-319)
 *   resetHighlight (lines 321-334)
 *   highlightSearch (lines 336-347)
 *   applyBlast (lines 349-379)
 *   applyProvenance (lines 382-399)
 *   applyDiff (lines 401-420)
 *   applyBlame (lines 424-476)
 *   highlightAuthor (lines 479-507)
 *   applyCoverage (lines 510-546)
 *   Hover effects (lines 237-277)
 */

import { useEffect } from 'react';
import { useSigma, useRegisterEvents } from '@react-sigma/core';
import { useGraphStore } from '../store';
import { computeBlastRadius } from '../blast-radius';
import { computeDiff } from '../timeline';
import { loadGraph } from '../graph-data';
import type Graph from 'graphology';

// ---------------------------------------------------------------------------
// Overlay helper functions (operate on graphology Graph instance directly)
// ---------------------------------------------------------------------------

function resetHighlight(graph: Graph): void {
  graph.forEachNode((id, attrs) => {
    graph.setNodeAttribute(id, 'color', attrs.originalColor);
    graph.setNodeAttribute(id, 'size', attrs.originalSize);
    graph.setNodeAttribute(id, 'label', attrs.label);
    graph.removeNodeAttribute(id, 'labelColor');
  });
  graph.forEachEdge((id, attrs) => {
    graph.setEdgeAttribute(id, 'color', attrs.originalColor);
    graph.setEdgeAttribute(id, 'size', (attrs as Record<string, unknown>).crossCommunity ? 1.5 : 0.5);
  });
}

function highlightCommunities(graph: Graph, ids: Set<number>): void {
  graph.forEachNode((id, attrs) => {
    const inSet = ids.has(attrs.community as number);
    graph.setNodeAttribute(id, 'color', inSet ? attrs.originalColor : 'rgba(48,54,61,0.15)');
    graph.setNodeAttribute(id, 'size', inSet ? (attrs.originalSize as number) * 1.2 : 2);
    graph.setNodeAttribute(id, 'label', inSet ? attrs.label : '');
  });
  graph.forEachEdge((id) => {
    const src = graph.source(id);
    const tgt = graph.target(id);
    const srcComm = graph.getNodeAttribute(src, 'community') as number;
    const tgtComm = graph.getNodeAttribute(tgt, 'community') as number;
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

function highlightSearch(graph: Graph, matchIds: Set<string>): void {
  graph.forEachNode((id, attrs) => {
    const match = matchIds.has(id);
    graph.setNodeAttribute(id, 'color', match ? attrs.originalColor : 'rgba(48,54,61,0.1)');
    graph.setNodeAttribute(id, 'size', match ? (attrs.originalSize as number) * 1.5 : 2);
  });
  graph.forEachEdge((id) => {
    const src = graph.source(id);
    const tgt = graph.target(id);
    graph.setEdgeAttribute(
      id,
      'color',
      matchIds.has(src) || matchIds.has(tgt)
        ? 'rgba(88,166,255,0.5)'
        : 'rgba(48,54,61,0.02)',
    );
  });
}

function applyBlast(graph: Graph, affected: Map<string, number>): void {
  graph.forEachNode((id) => {
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

function applyProvenance(graph: Graph): void {
  const PROV_COLORS: Record<string, string> = {
    lsp_resolved: 'rgba(88,166,255,0.7)',
    ast_resolved: 'rgba(121,192,255,0.7)',
    ast_inferred: 'rgba(210,153,34,0.6)',
    runtime_calls: 'rgba(63,185,80,0.7)',
    runtime_rpc: 'rgba(63,185,80,0.7)',
    otel_trace: 'rgba(63,185,80,0.7)',
  };
  graph.forEachEdge((id, attrs) => {
    const prov = (attrs as Record<string, unknown>).provenance as string || '';
    const color = PROV_COLORS[prov] || 'rgba(72,79,88,0.3)';
    const conf = (attrs as Record<string, unknown>).confidence as number || 0.5;
    graph.setEdgeAttribute(id, 'color', color);
    graph.setEdgeAttribute(id, 'size', conf > 0.8 ? 2 : 1);
  });
}

function applyDiff(graph: Graph, addedNodes: Set<string>, addedEdges: Set<string>): void {
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

function applyBlame(graph: Graph): Map<string, string> {
  const authorColors = new Map<string, string>();
  const palette = [
    '#58a6ff', '#3fb950', '#d29922', '#bc8cff', '#39d2c0',
    '#f85149', '#7ee787', '#79c0ff', '#ffd33d', '#56d4dd',
    '#ff7b72', '#a5d6ff', '#d2a8ff', '#e3b341', '#2ea043',
  ];
  let colorIdx = 0;

  graph.forEachNode((id, attrs) => {
    const author = (attrs as Record<string, unknown>).lastAuthor as string || '';
    if (!author) {
      graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.15)');
      graph.setNodeAttribute(id, 'size', 2);
      graph.setNodeAttribute(id, 'label', '');
      return;
    }
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

  return authorColors;
}

function highlightAuthor(graph: Graph, author: string): void {
  graph.forEachNode((id, attrs) => {
    const nodeAuthor = (attrs as Record<string, unknown>).lastAuthor as string || '';
    if (nodeAuthor === author) {
      graph.setNodeAttribute(id, 'color', attrs.originalColor || '#58a6ff');
      graph.setNodeAttribute(id, 'size', ((attrs.originalSize as number) || 5) * 1.3);
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
    const srcAuthor = (graph.getNodeAttributes(src) as Record<string, unknown>).lastAuthor as string || '';
    const tgtAuthor = (graph.getNodeAttributes(tgt) as Record<string, unknown>).lastAuthor as string || '';
    if (srcAuthor === author && tgtAuthor === author) {
      graph.setEdgeAttribute(id, 'color', 'rgba(88,166,255,0.5)');
      graph.setEdgeAttribute(id, 'size', 1.5);
    } else {
      graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.03)');
      graph.setEdgeAttribute(id, 'size', 0.3);
    }
  });
}

function applyCoverage(graph: Graph): void {
  graph.forEachNode((id, attrs) => {
    const pct = (attrs as Record<string, unknown>).coveragePct as number ?? -1;
    if (pct < 0) {
      graph.setNodeAttribute(id, 'color', 'rgba(48,54,61,0.2)');
      graph.setNodeAttribute(id, 'size', 3);
      graph.setNodeAttribute(id, 'label', '');
    } else if (pct === 0) {
      graph.setNodeAttribute(id, 'color', '#f85149');
      graph.setNodeAttribute(id, 'size', 8);
      graph.setNodeAttribute(id, 'label', attrs.shortName || '');
    } else if (pct < 50) {
      graph.setNodeAttribute(id, 'color', '#d29922');
      graph.setNodeAttribute(id, 'size', 6);
      graph.setNodeAttribute(id, 'label', attrs.shortName || '');
    } else if (pct < 80) {
      graph.setNodeAttribute(id, 'color', '#7ee787');
      graph.setNodeAttribute(id, 'size', 5);
      graph.setNodeAttribute(id, 'label', '');
    } else {
      graph.setNodeAttribute(id, 'color', '#3fb950');
      graph.setNodeAttribute(id, 'size', 5);
      graph.setNodeAttribute(id, 'label', '');
    }
  });
  graph.forEachEdge((id) => {
    graph.setEdgeAttribute(id, 'color', 'rgba(48,54,61,0.05)');
    graph.setEdgeAttribute(id, 'size', 0.3);
  });
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useOverlayEffects(): void {
  const sigma = useSigma();
  const graph = sigma.getGraph() as Graph;
  const registerEvents = useRegisterEvents();

  const viewMode = useGraphStore((s) => s.viewMode);
  const knGraph = useGraphStore((s) => s.graph);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const activeCommunityIds = useGraphStore((s) => s.activeCommunityIds);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setBlameAuthorColors = useGraphStore((s) => s.setBlameAuthorColors);

  // --- Register click/hover events (galaxy.ts hover lines 237-277, click lines 279-293) ---
  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => {
        const gNode = knGraph?.nodes.find(n => n.id === node) || null;
        const edges = knGraph?.edges.filter(e => e.source === node || e.target === node) || [];
        selectNode(gNode, edges);
      },
      clickStage: () => {
        resetHighlight(graph);
        selectNode(null);
      },
      enterNode: ({ node }) => {
        // Highlight neighbors on hover (galaxy.ts lines 237-271).
        const neighbors = new Set(graph.neighbors(node));
        neighbors.add(node);
        graph.forEachNode((id, attrs) => {
          if (id === node) {
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
      },
      leaveNode: () => {
        // Reset highlight on leave (galaxy.ts lines 273-277).
        resetHighlight(graph);
      },
    });
  }, [registerEvents, knGraph, graph, selectNode]);

  // --- Apply overlay based on viewMode (galaxy.ts per-overlay functions) ---
  useEffect(() => {
    if (!graph || graph.order === 0) return;

    switch (viewMode) {
      case 'provenance':
        applyProvenance(graph);
        break;
      case 'blame': {
        const colors = applyBlame(graph);
        setBlameAuthorColors(colors);
        sigma.refresh({ skipIndexation: false });
        // Force camera nudge to flush WebGL state (matches galaxy.ts lines 469-474).
        const cam = sigma.getCamera();
        cam.setState({ ...cam.getState(), ratio: cam.getState().ratio * 1.0001 });
        setTimeout(() => {
          cam.setState({ ...cam.getState(), ratio: cam.getState().ratio / 1.0001 });
        }, 50);
        break;
      }
      case 'coverage':
        applyCoverage(graph);
        sigma.refresh();
        break;
      case 'timeline': {
        (async () => {
          try {
            const before = await loadGraph(import.meta.env.BASE_URL + 'graph-before.json');
            if (knGraph) {
              const diff = computeDiff(before, knGraph);
              applyDiff(graph, diff.addedNodes, diff.addedEdges);
            }
          } catch {
            // No baseline graph available; leave default coloring.
          }
        })();
        break;
      }
      case 'communities':
        resetHighlight(graph);
        break;
      case 'blast-radius':
        // Blast radius is triggered by node selection (see selectedNode effect below).
        break;
    }
  }, [viewMode, graph, sigma, knGraph, setBlameAuthorColors]);

  // --- Apply blast radius when a node is selected in blast-radius mode ---
  useEffect(() => {
    if (viewMode !== 'blast-radius' || !selectedNode || !knGraph || !graph || graph.order === 0) {
      return;
    }
    const result = computeBlastRadius(knGraph, selectedNode.id);
    if (result) {
      applyBlast(graph, result.affected);
    }
  }, [viewMode, selectedNode, knGraph, graph]);

  // --- Apply community highlighting (galaxy.ts highlightCommunities) ---
  useEffect(() => {
    if (!graph || graph.order === 0) return;
    if (activeCommunityIds.size > 0) {
      highlightCommunities(graph, activeCommunityIds);
    } else if (viewMode === 'communities') {
      resetHighlight(graph);
    }
  }, [activeCommunityIds, graph, viewMode]);

  // --- Apply search highlighting (galaxy.ts highlightSearch) ---
  useEffect(() => {
    if (!graph || graph.order === 0) return;
    if (!searchQuery.trim()) {
      resetHighlight(graph);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = new Set(
      knGraph?.nodes
        .filter(
          n =>
            n.shortName.toLowerCase().includes(q) ||
            n.label.toLowerCase().includes(q),
        )
        .map(n => n.id) || [],
    );
    highlightSearch(graph, matches);
  }, [searchQuery, graph, knGraph]);
}

// Re-export helpers so GraphEvents component can use them directly if needed.
export { resetHighlight, highlightCommunities, highlightSearch, highlightAuthor };
