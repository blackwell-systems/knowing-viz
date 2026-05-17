// 3D Galaxy view using three-forcegraph.
// Force-directed layout in 3D with community-colored nodes.

import ForceGraph3D from 'three-forcegraph';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { KnowingGraph } from './graph-data';

const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

interface FGNode {
  id: string;
  name: string;
  community: number;
  kind: string;
  color: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
}

interface FGLink {
  source: string;
  target: string;
  crossCommunity: boolean;
  color: string;
}

export function renderGalaxy3D(container: HTMLElement, graph: KnowingGraph): () => void {
  const width = container.clientWidth;
  const height = container.clientHeight;

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

  // Build force-graph data.
  const fgNodes: FGNode[] = significantNodes.map(n => ({
    id: n.id,
    name: n.shortName,
    community: n.community,
    kind: n.kind,
    color: COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length],
    val: n.kind === 'service' ? 6 : n.kind === 'type' ? 3 : 2,
  }));

  const fgLinks: FGLink[] = [];
  const seenEdges = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    const key = `${edge.source}-${edge.target}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    fgLinks.push({
      source: edge.source,
      target: edge.target,
      crossCommunity: edge.crossCommunity,
      color: edge.crossCommunity ? 'rgba(248,81,73,0.3)' : 'rgba(48,54,61,0.15)',
    });
  }

  // Setup Three.js scene.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
  camera.position.set(0, 0, 400);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  // Create force graph.
  const fg = new ForceGraph3D(scene)
    .graphData({ nodes: fgNodes, links: fgLinks })
    .nodeColor((node: any) => node.color)
    .nodeVal((node: any) => node.val)
    .nodeLabel((node: any) => `${node.name} (${node.kind})`)
    .nodeOpacity(0.9)
    .linkColor((link: any) => link.color)
    .linkWidth((link: any) => link.crossCommunity ? 1 : 0.3)
    .linkOpacity(0.6)
    .linkDirectionalArrowLength(3)
    .linkDirectionalArrowRelPos(1)
    .d3AlphaDecay(0.03)
    .d3VelocityDecay(0.3);

  // Warm up the simulation.
  fg.tickFrame();

  // Animation loop.
  let animating = true;
  function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);
    fg.tickFrame();
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize handler.
  const resizeHandler = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resizeHandler);

  return () => {
    animating = false;
    window.removeEventListener('resize', resizeHandler);
    renderer.dispose();
    controls.dispose();
  };
}
