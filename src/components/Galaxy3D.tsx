/**
 * Galaxy3D: 3D galaxy view using react-force-graph-3d.
 *
 * Replaces the custom Three.js implementation in galaxy3d.ts with a
 * declarative React component. react-force-graph-3d manages its own Three.js
 * scene, resize handling, and cleanup — no manual Three.js management needed.
 *
 * Rendering strategy:
 * - Only the top 15 communities (by node count) are shown.
 * - At most 500 significant nodes are rendered for performance.
 * - Duplicate edges and self-loops are filtered out.
 * - Cross-community edges are highlighted in red with more particles.
 *
 * Note: UnrealBloomPass (from the original galaxy3d.ts) is omitted for now;
 * it can be added later as a post-processing enhancement.
 */

import { useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useGraphStore } from '../store';
import { COMMUNITY_COLORS } from '../constants';

interface GraphNode3D {
  id: string;
  name: string;
  community: number;
  kind: string;
  color: string;
  val: number;
}

interface GraphLink3D {
  source: string;
  target: string;
  color: string;
}

export function Galaxy3D() {
  const viewMode = useGraphStore((s) => s.viewMode);
  const graph = useGraphStore((s) => s.graph);

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [] as GraphNode3D[], links: [] as GraphLink3D[] };

    // Keep only the 15 largest communities.
    const topCommunities = [...graph.communities]
      .sort((a, b) => b.size - a.size)
      .slice(0, 15)
      .map((c) => c.id);
    const topCommSet = new Set(topCommunities);

    // Limit to 500 nodes from significant communities.
    const significantNodes = graph.nodes
      .filter((n) => topCommSet.has(n.community))
      .slice(0, 500);
    const nodeIds = new Set(significantNodes.map((n) => n.id));

    const nodes: GraphNode3D[] = significantNodes.map((n) => ({
      id: n.id,
      name: n.shortName,
      community: n.community,
      kind: n.kind,
      color: COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length],
      val: n.kind === 'service' ? 6 : n.kind === 'type' ? 3 : 2,
    }));

    const links: GraphLink3D[] = [];
    const seenEdges = new Set<string>();
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      const key = `${edge.source}-${edge.target}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      links.push({
        source: edge.source,
        target: edge.target,
        color: edge.crossCommunity
          ? 'rgba(248,81,73,0.6)'
          : 'rgba(100,116,139,0.35)',
      });
    }

    return { nodes, links };
  }, [graph]);

  const nodeColor = useCallback((node: object) => (node as GraphNode3D).color, []);
  const nodeVal = useCallback((node: object) => (node as GraphNode3D).val, []);
  const nodeLabel = useCallback(
    (node: object) => {
      const n = node as GraphNode3D;
      return `${n.name} (${n.kind})`;
    },
    [],
  );
  const linkColor = useCallback((link: object) => (link as GraphLink3D).color, []);
  const linkDirectionalParticles = useCallback(
    (link: object) =>
      (link as GraphLink3D).color.includes('248,81,73') ? 4 : 1,
    [],
  );
  const linkDirectionalParticleColor = useCallback(
    (link: object) =>
      (link as GraphLink3D).color.includes('248,81,73') ? '#f85149' : '#58a6ff',
    [],
  );

  if (viewMode !== 'galaxy3d' || !graph) return null;

  return (
    <div className="graph-container galaxy3d-container">
      <ForceGraph3D
        graphData={graphData}
        backgroundColor="#000000"
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeLabel={nodeLabel}
        nodeOpacity={0.9}
        linkColor={linkColor}
        linkWidth={0.8}
        linkOpacity={0.8}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={linkDirectionalParticles}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleColor={linkDirectionalParticleColor}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
      />
    </div>
  );
}
