// 3D Galaxy view using 3d-force-graph (standalone, includes its own Three.js renderer).

// @ts-ignore
import ForceGraph3D from '3d-force-graph';
import type { KnowingGraph } from './graph-data';

const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

export function renderGalaxy3D(container: HTMLElement, graph: KnowingGraph): () => void {
  // Filter to top communities.
  const topCommunities = [...graph.communities]
    .sort((a, b) => b.size - a.size)
    .slice(0, 15)
    .map(c => c.id);
  const topCommSet = new Set(topCommunities);

  const significantNodes = graph.nodes
    .filter(n => topCommSet.has(n.community))
    .slice(0, 500);
  const nodeIds = new Set(significantNodes.map(n => n.id));

  // Build data.
  const nodes = significantNodes.map(n => ({
    id: n.id,
    name: n.shortName,
    community: n.community,
    kind: n.kind,
    color: COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length],
    val: n.kind === 'service' ? 6 : n.kind === 'type' ? 3 : 2,
  }));

  const links: { source: string; target: string; color: string }[] = [];
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
      color: edge.crossCommunity ? 'rgba(248,81,73,0.4)' : 'rgba(48,54,61,0.2)',
    });
  }

  container.innerHTML = '';

  const fg = ForceGraph3D()(container)
    .graphData({ nodes, links })
    .backgroundColor('#0d1117')
    .nodeColor((node: any) => node.color)
    .nodeVal((node: any) => node.val)
    .nodeLabel((node: any) => `${node.name} (${node.kind})`)
    .nodeOpacity(0.9)
    .linkColor((link: any) => link.color)
    .linkWidth(0.5)
    .linkOpacity(0.6)
    .linkDirectionalArrowLength(3)
    .linkDirectionalArrowRelPos(1)
    .enableNodeDrag(true)
    .enableNavigationControls(true)
    .showNavInfo(false)
    .width(container.clientWidth)
    .height(container.clientHeight);

  // Auto-rotate.
  let angle = 0;
  const rotateInterval = setInterval(() => {
    angle += 0.002;
    const dist = fg.cameraPosition().z || 400;
    fg.cameraPosition({
      x: dist * Math.sin(angle),
      z: dist * Math.cos(angle),
    });
  }, 30);

  // Resize handler.
  const resizeHandler = () => {
    fg.width(container.clientWidth).height(container.clientHeight);
  };
  window.addEventListener('resize', resizeHandler);

  return () => {
    clearInterval(rotateInterval);
    window.removeEventListener('resize', resizeHandler);
    fg._destructor?.();
    container.innerHTML = '';
  };
}
