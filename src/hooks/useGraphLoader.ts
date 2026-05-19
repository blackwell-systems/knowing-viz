/**
 * useGraphLoader: builds a graphology Graph from the KnowingGraph data in
 * the Zustand store, applying current display settings (groupBy, maxNodes,
 * nodeScale, edgeOpacity, etc.).
 *
 * This extracts the graph-building logic from renderSigma() in galaxy.ts
 * (lines 68-206). The Sigma rendering itself is handled by @react-sigma/core's
 * SigmaContainer; this hook only builds the graphology Graph data structure.
 *
 * Port of galaxy.ts renderSigma() graph-building logic.
 */

import { useEffect } from 'react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { useGraphStore } from '../store';
import { COMMUNITY_COLORS } from '../constants';

export function useGraphLoader(): void {
  const knGraph = useGraphStore((s) => s.graph);
  const groupBy = useGraphStore((s) => s.groupBy);
  const settings = useGraphStore((s) => s.settings);
  const viewMode = useGraphStore((s) => s.viewMode);
  const setSigmaGraph = useGraphStore((s) => s.setSigmaGraph);
  const setGroupLabels = useGraphStore((s) => s.setGroupLabels);
  const hiddenEdgeTypes = useGraphStore((s) => s.hiddenEdgeTypes);

  useEffect(() => {
    if (!knGraph || viewMode === 'galaxy3d') {
      setSigmaGraph(null);
      return;
    }

    const {
      maxNodes = 10000,
      nodeScale = 1.0,
      topLabelCount = 40,
      edgeOpacity = 1.0,
      gravity = 1.0,
      spread = 10,
      crossCommunityOnly = false,
      confidenceMin = 0,
    } = settings;

    // --- Group assignment (galaxy.ts lines 70-90) ---
    const nodeGroup = new Map<string, string>(); // node id -> group label
    const commLabelMap = new Map<number, string>();
    for (const c of knGraph.communities) {
      commLabelMap.set(c.id, c.label);
    }
    for (const n of knGraph.nodes) {
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

    // --- Top 20 group filtering (galaxy.ts lines 92-101) ---
    const groupSizes = new Map<string, number>();
    for (const g of nodeGroup.values()) {
      groupSizes.set(g, (groupSizes.get(g) || 0) + 1);
    }
    const topGroups = [...groupSizes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([g]) => g);
    const topGroupSet = new Set(topGroups);

    // --- Group-to-color mapping (galaxy.ts lines 103-105) ---
    const groupToId = new Map<string, number>();
    topGroups.forEach((g, i) => groupToId.set(g, i));

    // --- Node filtering by maxNodes (galaxy.ts lines 107-109) ---
    const significantNodes = knGraph.nodes
      .filter(n => topGroupSet.has(nodeGroup.get(n.id) || ''))
      .slice(0, maxNodes);
    const nodeIds = new Set(significantNodes.map(n => n.id));

    // --- Degree computation for sizing (galaxy.ts lines 112-119) ---
    const degree = new Map<string, number>();
    for (const n of significantNodes) degree.set(n.id, 0);
    for (const e of knGraph.edges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    }

    // --- Top-N label filtering (galaxy.ts lines 122-123) ---
    const sortedByDegree = [...degree.entries()].sort((a, b) => b[1] - a[1]);
    const topLabelIds = new Set(sortedByDegree.slice(0, topLabelCount).map(([id]) => id));

    // --- Seed positions on a circle per group (galaxy.ts lines 126-135) ---
    const groupPosition = new Map<string, { x: number; y: number }>();
    topGroups.forEach((g, i) => {
      const angle = (i / topGroups.length) * Math.PI * 2;
      const r = 50;
      groupPosition.set(g, {
        x: 50 + Math.cos(angle) * r,
        y: 50 + Math.sin(angle) * r,
      });
    });

    // --- Build graphology graph ---
    const sigmaGraph = new Graph();

    // --- Node attribute assignment (galaxy.ts lines 138-164) ---
    for (const node of significantNodes) {
      const group = nodeGroup.get(node.id) || '0';
      const gid = groupToId.get(group) || 0;
      const color = COMMUNITY_COLORS[gid % COMMUNITY_COLORS.length];
      const deg = degree.get(node.id) || 0;
      const baseSize = node.kind === 'service' ? 6 : 3;
      const size = (baseSize + Math.log2(deg + 1) * 2) * nodeScale;
      const pos = groupPosition.get(group) || { x: 50, y: 50 };
      sigmaGraph.addNode(node.id, {
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

    // --- Edge filtering and attribute assignment (galaxy.ts lines 167-193) ---
    for (const edge of knGraph.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      if (crossCommunityOnly && !edge.crossCommunity) continue;
      if (edge.confidence < confidenceMin) continue;
      if (edge.source === edge.target) continue; // skip self-loops
      if (hiddenEdgeTypes.has(edge.type)) continue;

      const key = `${edge.source}-${edge.target}-${edge.type}`;
      if (sigmaGraph.hasEdge(key)) continue;

      const crossAlpha = (0.4 * edgeOpacity).toFixed(2);
      const intAlpha = (0.2 * edgeOpacity).toFixed(2);
      const color = edge.crossCommunity
        ? `rgba(248, 81, 73, ${crossAlpha})`
        : `rgba(100, 116, 139, ${intAlpha})`;
      try {
        sigmaGraph.addEdgeWithKey(key, edge.source, edge.target, {
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

    // --- ForceAtlas2 layout (galaxy.ts lines 196-206) ---
    forceAtlas2.assign(sigmaGraph, {
      iterations: 300,
      settings: {
        gravity: gravity,
        scalingRatio: spread,
        barnesHutOptimize: true,
        strongGravityMode: true,
        slowDown: 5,
      },
    });

    // --- Group label computation for sidebar (galaxy.ts lines 561-567) ---
    const labels = topGroups.map((g, i) => ({
      id: i,
      label: g,
      size: groupSizes.get(g) || 0,
    }));

    setSigmaGraph(sigmaGraph);
    setGroupLabels(labels);

    // No cleanup needed; sigmaGraph is just data (not a live resource).
  }, [knGraph, groupBy, settings, viewMode, hiddenEdgeTypes]);
}
