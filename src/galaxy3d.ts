// 3D Galaxy view: communities as glowing sphere clusters in 3D space.
// Uses Three.js with orbit controls. For hero screenshots and presentations.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { KnowingGraph } from './graph-data';

const COMMUNITY_COLORS = [
  0x3fb950, 0x58a6ff, 0xd29922, 0xbc8cff,
  0x39d2c0, 0xf85149, 0x7ee787, 0x79c0ff,
  0xa5d6ff, 0xffd33d, 0x56d4dd, 0xff7b72,
  0x8b949e, 0xd2a8ff, 0x2ea043, 0xe3b341,
];

interface NodePosition {
  id: string;
  x: number;
  y: number;
  z: number;
  community: number;
  size: number;
}

export function renderGalaxy3D(container: HTMLElement, graph: KnowingGraph): () => void {
  // Setup.
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 0, 300);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // Compute community positions (arrange in a circle, spread by size).
  const topCommunities = [...graph.communities]
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  const commPositions = new Map<number, THREE.Vector3>();
  const radius = 120;
  topCommunities.forEach((comm, i) => {
    const angle = (i / topCommunities.length) * Math.PI * 2;
    const r = radius + (comm.size > 30 ? 20 : 0);
    commPositions.set(comm.id, new THREE.Vector3(
      Math.cos(angle) * r,
      (Math.random() - 0.5) * 60,
      Math.sin(angle) * r,
    ));
  });

  // Place nodes around their community center.
  const nodePositions = new Map<string, NodePosition>();
  const commNodes = new Map<number, typeof graph.nodes>();

  for (const node of graph.nodes) {
    if (!commPositions.has(node.community)) continue;
    const list = commNodes.get(node.community) || [];
    list.push(node);
    commNodes.set(node.community, list);
  }

  for (const [commId, nodes] of commNodes) {
    const center = commPositions.get(commId)!;
    const spread = Math.sqrt(nodes.length) * 3;

    nodes.forEach((node, i) => {
      // Fibonacci sphere distribution.
      const phi = Math.acos(1 - 2 * (i + 0.5) / nodes.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      nodePositions.set(node.id, {
        id: node.id,
        x: center.x + spread * Math.sin(phi) * Math.cos(theta),
        y: center.y + spread * Math.sin(phi) * Math.sin(theta),
        z: center.z + spread * Math.cos(phi),
        community: commId,
        size: node.kind === 'service' ? 3 : node.kind === 'type' ? 2 : 1.5,
      });
    });
  }

  // Render nodes as points (instanced spheres are too expensive for 1500 nodes).
  const nodeGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];

  for (const [, pos] of nodePositions) {
    positions.push(pos.x, pos.y, pos.z);
    const color = new THREE.Color(COMMUNITY_COLORS[pos.community % COMMUNITY_COLORS.length]);
    colors.push(color.r, color.g, color.b);
    sizes.push(pos.size);
  }

  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  nodeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const nodeMaterial = new THREE.PointsMaterial({
    size: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });

  const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
  scene.add(nodePoints);

  // Render community labels as sprites.
  for (const comm of topCommunities) {
    const pos = commPositions.get(comm.id);
    if (!pos) continue;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(comm.label, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.6 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.position.y += Math.sqrt(comm.size) * 3 + 8;
    sprite.scale.set(30, 7.5, 1);
    scene.add(sprite);
  }

  // Render cross-community edges as lines.
  const edgeGeometry = new THREE.BufferGeometry();
  const edgePositions: number[] = [];
  const edgeColors: number[] = [];

  for (const edge of graph.edges) {
    if (!edge.crossCommunity) continue;
    const src = nodePositions.get(edge.source);
    const tgt = nodePositions.get(edge.target);
    if (!src || !tgt) continue;

    edgePositions.push(src.x, src.y, src.z, tgt.x, tgt.y, tgt.z);
    // Red for cross-community.
    edgeColors.push(0.97, 0.32, 0.29, 0.97, 0.32, 0.29);
  }

  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));

  const edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    linewidth: 1,
  });

  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  scene.add(edgeLines);

  // Ambient glow (subtle fog).
  scene.fog = new THREE.FogExp2(0x0d1117, 0.002);

  // Ambient light.
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // Animation loop.
  let animating = true;
  function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Handle resize.
  const resizeHandler = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resizeHandler);

  // Return cleanup function.
  return () => {
    animating = false;
    window.removeEventListener('resize', resizeHandler);
    renderer.dispose();
    controls.dispose();
  };
}
