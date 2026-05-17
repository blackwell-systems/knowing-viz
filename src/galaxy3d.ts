// 3D Galaxy view using 3d-force-graph (standalone, includes its own Three.js renderer).

// @ts-ignore
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
// @ts-ignore
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
      color: edge.crossCommunity ? 'rgba(248,81,73,0.6)' : 'rgba(100,116,139,0.35)',
    });
  }

  container.innerHTML = '';

  const fg = ForceGraph3D()(container)
    .graphData({ nodes, links })
    .backgroundColor('#000000')
    .nodeColor((node: any) => node.color)
    .nodeVal((node: any) => node.val)
    .nodeLabel((node: any) => `${node.name} (${node.kind})`)
    .nodeOpacity(0.9)
    .linkColor((link: any) => link.color)
    .linkWidth(0.8)
    .linkOpacity(0.8)
    .linkDirectionalArrowLength(3)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalParticles((link: any) => link.color.includes('248,81,73') ? 4 : 1)
    .linkDirectionalParticleWidth(1.5)
    .linkDirectionalParticleSpeed(0.004)
    .linkDirectionalParticleColor((link: any) => link.color.includes('248,81,73') ? '#f85149' : '#58a6ff')
    .enableNodeDrag(true)
    .enableNavigationControls(true)
    .showNavInfo(false)
    .width(container.clientWidth)
    .height(container.clientHeight);

  // Add subtle bloom for glow effect (minimal to avoid background wash-out).
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.3,   // strength (very subtle)
    0.2,   // radius (tight glow)
    0.9    // threshold (only the brightest nodes glow)
  );
  fg.postProcessingComposer().addPass(bloomPass);

  // Enable built-in orbit controls auto-rotate (doesn't fight with user interaction).
  const controls = fg.controls();
  if (controls) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
  }

  // Resize handler.
  const resizeHandler = () => {
    fg.width(container.clientWidth).height(container.clientHeight);
  };
  window.addEventListener('resize', resizeHandler);

  return () => {
    window.removeEventListener('resize', resizeHandler);
    fg._destructor?.();
    container.innerHTML = '';
  };
}
