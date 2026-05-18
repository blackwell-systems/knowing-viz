import { loadGraph, loadGraphFromFile, graphStats, type GraphNode, type GraphEdge, type Community } from './graph-data';
import { renderSigma, type SigmaInstance } from './galaxy';
import { computeBlastRadius } from './blast-radius';
import { PROVENANCE_COLORS } from './provenance';
import { loadGraph as loadGraphAlt } from './graph-data';
import { computeDiff } from './timeline';
import { renderGalaxy3D } from './galaxy3d';

// @ts-ignore
const GRAPH_URL = import.meta.env.BASE_URL + 'graph.json';

const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

function communityColor(id: number): string {
  return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length];
}

type ViewMode = 'communities' | 'blast-radius' | 'provenance' | 'blame' | 'coverage' | 'timeline' | 'galaxy3d';

async function main() {
  const container = document.getElementById('graph-container')!;
  const communitiesEl = document.getElementById('communities');
  const selectedInfo = document.getElementById('selected-info');
  const detailPanel = document.getElementById('detail-panel');
  const detailName = document.getElementById('detail-name');
  const detailClose = document.getElementById('detail-close');
  const searchInput = document.getElementById('search') as HTMLInputElement;
  const crossCommunityCheckbox = document.getElementById('cross-community-only') as HTMLInputElement;
  const confidenceSlider = document.getElementById('confidence-min') as HTMLInputElement;
  const confidenceVal = document.getElementById('confidence-val');

  let graph;
  try {
    graph = await loadGraph(GRAPH_URL);
  } catch {
    container.innerHTML = `<div style="color:#f85149;padding:40px;text-align:center;">
      <h2>No graph data found</h2>
      <p>Run <code>knowing export -format json > public/graph.json</code></p>
    </div>`;
    return;
  }

  let currentView: ViewMode = 'communities';
  let sigmaInst: SigmaInstance | null = null;
  let cleanup3D: (() => void) | null = null;

  // File picker: load a different graph JSON.
  const graphFileInput = document.getElementById('graph-file') as HTMLInputElement;
  const graphNameEl = document.getElementById('current-graph-name');
  if (graphFileInput) {
    graphFileInput.addEventListener('change', async () => {
      const file = graphFileInput.files?.[0];
      if (!file) return;
      try {
        graph = await loadGraphFromFile(file);
        if (graphNameEl) graphNameEl.textContent = file.name;
        updateStats();
        buildCommunitySidebar();
        buildNodeList();
        currentView = 'communities';
        document.querySelectorAll('#view-toggles button').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-view="communities"]')?.classList.add('active');
        renderSigmaView();
      } catch (err) {
        console.error('Failed to load graph:', err);
        if (graphNameEl) graphNameEl.textContent = 'Error loading file';
      }
    });
  }

  function updateStats() {
    const s = graphStats(graph!);
    setText('node-count', `Nodes: ${s.nodes.toLocaleString()}`);
    setText('edge-count', `Edges: ${s.edges.toLocaleString()}`);
    setText('community-count', `Communities: ${s.communities}`);
    setText('cross-count', `Cross-community: ${s.crossCommunityEdges.toLocaleString()}`);
  }

  // Stats bar.
  const stats = graphStats(graph);
  setText('node-count', `Nodes: ${stats.nodes.toLocaleString()}`);
  setText('edge-count', `Edges: ${stats.edges.toLocaleString()}`);
  setText('community-count', `Communities: ${stats.communities}`);
  setText('cross-count', `Cross-community: ${stats.crossCommunityEdges.toLocaleString()}`);

  // Node lookup.
  const nodeMap = new Map<string, GraphNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  // Selection handler.
  function onSelect(node: GraphNode | null, edges: GraphEdge[]) {
    if (!selectedInfo || !detailPanel || !detailName) return;
    if (!node) {
      // Don't hide the panel when an overlay view (blame, coverage, provenance) is showing its legend.
      if (currentView !== 'communities' && currentView !== 'blast-radius' && currentView !== 'galaxy3d') return;
      detailPanel.classList.add('hidden');
      return;
    }

    if (currentView === 'blast-radius' && sigmaInst) {
      const result = computeBlastRadius(graph!, node.id, 4);
      if (result) {
        sigmaInst.applyBlast(result.affected);
        showBlastDetail(node, result);
        return;
      }
    }

    detailPanel.classList.remove('hidden');
    detailName.textContent = node.shortName;
    showNodeDetail(node, edges);
  }

  function showNodeDetail(node: GraphNode, edges: GraphEdge[]) {
    if (!selectedInfo) return;
    const callers = edges.filter(e => e.target === node.id);
    const callees = edges.filter(e => e.source === node.id);
    const community = graph!.communities.find((c: Community) => c.id === node.community);

    selectedInfo.innerHTML = `
      <div class="detail-label">Qualified Name</div>
      <div class="detail-code">${node.label}</div>
      <div class="detail-label">Kind</div>
      <div class="detail-value">${node.kind}</div>
      <div class="detail-label">Package</div>
      <div class="detail-value">${node.package}</div>
      <div class="detail-label">Community</div>
      <div class="detail-value">
        <span class="community-dot" style="background:${communityColor(node.community)};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle;"></span>
        ${community ? community.label : 'ungrouped'} (${community?.size || 0} symbols)
      </div>
      <div class="detail-label">Signature</div>
      <div class="detail-code">${node.signature || 'n/a'}</div>
      <div class="detail-section">
        <div class="detail-label">Callers <span class="stat-highlight">${callers.length}</span></div>
        <ul class="edge-list">${renderEdgeList(callers, 'source')}</ul>
      </div>
      <div class="detail-section">
        <div class="detail-label">Callees <span class="stat-highlight">${callees.length}</span></div>
        <ul class="edge-list">${renderEdgeList(callees, 'target')}</ul>
      </div>
    `;
  }

  function renderEdgeList(edges: GraphEdge[], peerField: 'source' | 'target'): string {
    if (edges.length === 0) return '<li>none</li>';
    let html = '';
    for (const e of edges.slice(0, 20)) {
      const peer = nodeMap.get(e[peerField]);
      const cls = e.crossCommunity ? 'edge-cross' : 'edge-type';
      html += `<li><span class="${cls}">${e.type}</span> ${peer?.shortName || e[peerField].slice(0, 8)}</li>`;
    }
    if (edges.length > 20) html += `<li class="more">+${edges.length - 20} more</li>`;
    return html;
  }

  function showBlastDetail(node: GraphNode, result: any) {
    if (!selectedInfo || !detailPanel || !detailName) return;
    detailPanel.classList.remove('hidden');
    detailName.textContent = `Blast: ${node.shortName}`;

    const byDepth = new Map<number, string[]>();
    for (const [id, depth] of result.affected) {
      if (depth === 0) continue;
      const list = byDepth.get(depth) || [];
      list.push(nodeMap.get(id)?.shortName || id.slice(0, 8));
      byDepth.set(depth, list);
    }

    let html = `
      <div class="detail-label">Center</div>
      <div class="detail-code">${node.label}</div>
      <div class="detail-label">Total Affected</div>
      <div class="detail-value"><span class="stat-danger">${result.affected.size - 1}</span> symbols</div>
    `;
    for (const [depth, names] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
      html += `<div class="detail-section"><div class="detail-label">Depth ${depth} <span class="stat-highlight">${names.length}</span></div><ul class="edge-list">${names.map(n => `<li>${n}</li>`).join('')}</ul></div>`;
    }
    selectedInfo.innerHTML = html;
  }

  // Community sidebar (multi-select, top 15 only).
  const activeCommunityIds = new Set<number>();

  function buildCommunitySidebar() {
    if (!communitiesEl) return;
    communitiesEl.innerHTML = '';
    activeCommunityIds.clear();
    const sorted = [...graph!.communities].sort((a, b) => b.size - a.size);
    const top = sorted.slice(0, 15);
    for (const comm of top) {
      const item = document.createElement('div');
      item.className = 'community-item';
      item.innerHTML = `
        <span class="community-dot" style="background:${communityColor(comm.id)}"></span>
        <span class="community-label">${comm.label}</span>
        <span class="community-count">${comm.size}</span>
      `;
      item.addEventListener('click', () => {
        if (item.classList.contains('active')) {
          item.classList.remove('active');
          activeCommunityIds.delete(comm.id);
        } else {
          item.classList.add('active');
          activeCommunityIds.add(comm.id);
        }
        if (sigmaInst) {
          if (activeCommunityIds.size === 0) sigmaInst.resetHighlight();
          else sigmaInst.highlightCommunities(activeCommunityIds);
        }
      });
      communitiesEl.appendChild(item);
    }
  }

  buildCommunitySidebar();

  // Node list panel.
  const nodeListEl = document.getElementById('node-list');
  const nodeFilterEl = document.getElementById('node-filter') as HTMLInputElement;

  function buildNodeList() {
    if (!nodeListEl) return;
    nodeListEl.innerHTML = '';
    const sorted = [...graph!.nodes].sort((a, b) => a.shortName.localeCompare(b.shortName));
    for (const node of sorted) {
      const item = document.createElement('div');
      item.className = 'node-list-item';
      item.dataset.nodeId = node.id;
      item.innerHTML = `
        <span class="node-list-dot" style="background:${communityColor(node.community)}"></span>
        <span>${node.shortName}</span>
        <span class="node-list-kind">${node.kind}</span>
      `;
      item.addEventListener('click', () => {
        // Highlight in graph and show detail.
        const edges = graph!.edges.filter(e => e.source === node.id || e.target === node.id);
        onSelect(node, edges);
        // Scroll to and center the node in Sigma.
        if (sigmaInst) {
          const nodeAttrs = sigmaInst.graph.getNodeAttributes(node.id);
          if (nodeAttrs) {
            sigmaInst.sigma.getCamera().animate(
              { x: nodeAttrs.x as number, y: nodeAttrs.y as number, ratio: 0.3 },
              { duration: 300 }
            );
          }
        }
        // Visual feedback.
        nodeListEl.querySelectorAll('.node-list-item').forEach(e => e.classList.remove('active'));
        item.classList.add('active');
      });
      nodeListEl.appendChild(item);
    }
  }

  buildNodeList();

  // Filter the node list.
  nodeFilterEl?.addEventListener('input', () => {
    const query = nodeFilterEl.value.toLowerCase().trim();
    nodeListEl?.querySelectorAll('.node-list-item').forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      (el as HTMLElement).style.display = text.includes(query) ? '' : 'none';
    });
  });

  detailClose?.addEventListener('click', () => {
    if (sigmaInst) sigmaInst.resetHighlight();
  });

  // Read slider values safely (elements may not exist yet on first call).
  function sliderVal(id: string, fallback: number): number {
    const el = document.getElementById(id) as HTMLInputElement | null;
    const v = el?.valueAsNumber;
    return (v !== undefined && !isNaN(v)) ? v : fallback;
  }

  function renderSigmaView() {
    if (cleanup3D) { cleanup3D(); cleanup3D = null; }
    if (sigmaInst) sigmaInst.destroy();

    sigmaInst = renderSigma(container, graph!, {
      onSelect,
      maxNodes: sliderVal('max-nodes', 10000),
      nodeScale: sliderVal('node-size', 10) / 10,
      topLabelCount: sliderVal('label-count', 40),
      edgeOpacity: sliderVal('edge-opacity', 100) / 100,
      labelSize: sliderVal('label-size', 11),
      gravity: sliderVal('gravity', 10) / 10,
      spread: sliderVal('spread', 10),
    });
  }
  renderSigmaView();

  // Toolbar buttons.
  document.getElementById('btn-screenshot')?.addEventListener('click', () => {
    if (!sigmaInst) return;
    // Sigma renders to a canvas inside the container.
    const canvas = container.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'knowing-graph.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  document.getElementById('btn-fit')?.addEventListener('click', () => {
    if (sigmaInst) {
      sigmaInst.sigma.getCamera().animatedReset();
    }
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    // Reset all sliders to defaults.
    const defaults: Record<string, number> = {
      'node-size': 10, 'label-count': 40, 'edge-opacity': 100,
      'label-size': 11, 'gravity': 10, 'spread': 10,
      'max-nodes': 10000, 'confidence-min': 0,
    };
    for (const [id, val] of Object.entries(defaults)) {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.value = String(val);
    }
    const cb = document.getElementById('cross-community-only') as HTMLInputElement;
    if (cb) cb.checked = false;
    // Clear community selection.
    communitiesEl?.querySelectorAll('.community-item').forEach(el => el.classList.remove('active'));
    activeCommunityIds.clear();
    // Update value displays.
    setText('node-size-val', '1.0x');
    setText('label-count-val', '40');
    setText('edge-opacity-val', '100%');
    setText('label-size-val', '11px');
    setText('gravity-val', '1');
    setText('spread-val', '10');
    setText('max-nodes-val', 'All');
    setText('confidence-val', '0%');
    rerender();
  });

  // View switching.
  document.querySelectorAll('#view-toggles button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-toggles button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = (btn as HTMLElement).dataset.view as ViewMode;

      switch (currentView) {
        case 'communities':
          renderSigmaView();
          break;

        case 'blast-radius':
          renderSigmaView();
          showPanel('Blast Radius', '<em>Click a node to see its blast radius</em>');
          break;

        case 'provenance':
          renderSigmaView();
          if (sigmaInst) sigmaInst.applyProvenance();
          let legend = '<div class="detail-label">Provenance Legend</div>';
          for (const [prov, color] of Object.entries(PROVENANCE_COLORS)) {
            if (prov === 'default') continue;
            legend += `<div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${prov}</div>`;
          }
          showPanel('Provenance', legend);
          break;

        case 'blame':
          renderSigmaView();
          if (sigmaInst) {
            const authorColors = sigmaInst.applyBlame();
            let blameLegend = '<div class="detail-label">Authors <span style="font-size:0.7rem;color:var(--text-muted)">(click to filter)</span></div>';
            blameLegend += `<div class="detail-value blame-author-item" data-author="__all__" style="cursor:pointer;padding:2px 4px;border-radius:3px;background:var(--accent-dim);color:var(--text-primary);margin-bottom:2px;"><strong>Show all</strong></div>`;
            for (const [author, color] of authorColors) {
              blameLegend += `<div class="detail-value blame-author-item" data-author="${author}" style="cursor:pointer;padding:2px 4px;border-radius:3px;margin-bottom:1px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${author}</div>`;
            }
            showPanel('Blame', blameLegend);
            // Wire click handlers for author filtering.
            document.querySelectorAll('.blame-author-item').forEach(el => {
              el.addEventListener('click', (evt) => {
                evt.stopPropagation(); // Prevent Sigma clickStage from hiding the panel.
                const author = (el as HTMLElement).dataset.author;
                if (author === '__all__') {
                  sigmaInst!.applyBlame();
                } else if (author) {
                  sigmaInst!.highlightAuthor(author);
                }
                // Visual feedback: highlight selected.
                document.querySelectorAll('.blame-author-item').forEach(e => (e as HTMLElement).style.background = '');
                (el as HTMLElement).style.background = 'var(--bg-tertiary)';
                // Re-show the panel in case it was hidden.
                detailPanel?.classList.remove('hidden');
              });
            });
          }
          break;

        case 'coverage':
          renderSigmaView();
          if (sigmaInst) {
            sigmaInst.applyCoverage();
            const covLegend = `
              <div class="detail-label">Coverage Legend</div>
              <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f85149;margin-right:6px;vertical-align:middle;"></span>0% (uncovered)</div>
              <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#d29922;margin-right:6px;vertical-align:middle;"></span>1-49% (low)</div>
              <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7ee787;margin-right:6px;vertical-align:middle;"></span>50-79% (medium)</div>
              <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3fb950;margin-right:6px;vertical-align:middle;"></span>80-100% (high)</div>
              <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(48,54,61,0.3);margin-right:6px;vertical-align:middle;"></span>Not measured</div>
            `;
            showPanel('Coverage', covLegend);
          }
          break;

        case 'timeline':
          renderSigmaView();
          (async () => {
            try {
              // @ts-ignore
              const before = await loadGraphAlt(import.meta.env.BASE_URL + 'graph-before.json');
              const diff = computeDiff(before, graph!);
              if (sigmaInst) sigmaInst.applyDiff(diff.addedNodes, diff.addedEdges);
              showPanel('Timeline Diff', `
                <div class="detail-label">Changes</div>
                <div class="detail-value"><span style="color:#3fb950">+${diff.stats.nodesAdded} nodes</span> / <span style="color:#f85149">-${diff.stats.nodesRemoved} nodes</span></div>
                <div class="detail-value"><span style="color:#3fb950">+${diff.stats.edgesAdded} edges</span> / <span style="color:#f85149">-${diff.stats.edgesRemoved} edges</span></div>
              `);
            } catch {
              showPanel('Timeline', '<em>No baseline found. Export with <code>knowing export > public/graph-before.json</code></em>');
            }
          })();
          break;

        case 'galaxy3d':
          if (sigmaInst) { sigmaInst.destroy(); sigmaInst = null; }
          cleanup3D = renderGalaxy3D(container, graph!);
          showPanel('Galaxy 3D', `
            <div class="detail-value">Drag to orbit, scroll to zoom</div>
            <div class="detail-value">Auto-rotating</div>
            <div class="detail-label" style="margin-top:8px">Legend</div>
            <div class="detail-value">Each cluster = one community</div>
            <div class="detail-value"><span style="color:#f85149">Red lines</span> = cross-community</div>
          `);
          break;
      }
    });
  });

  function showPanel(title: string, html: string) {
    if (detailPanel && detailName && selectedInfo) {
      detailPanel.classList.remove('hidden');
      detailName.textContent = title;
      selectedInfo.innerHTML = html;
    }
  }

  // Search.
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!sigmaInst) return;
    if (!query) { sigmaInst.resetHighlight(); return; }
    const matches = new Set(
      graph!.nodes
        .filter(n => n.shortName.toLowerCase().includes(query) || n.label.toLowerCase().includes(query))
        .map(n => n.id)
    );
    sigmaInst.highlightSearch(matches);
  });

  // Display settings.
  const nodeSizeSlider = document.getElementById('node-size') as HTMLInputElement;
  const nodeSizeVal = document.getElementById('node-size-val');
  const labelCountSlider = document.getElementById('label-count') as HTMLInputElement;
  const labelCountVal = document.getElementById('label-count-val');
  const edgeOpacitySlider = document.getElementById('edge-opacity') as HTMLInputElement;
  const edgeOpacityVal = document.getElementById('edge-opacity-val');
  const labelSizeSlider = document.getElementById('label-size') as HTMLInputElement;
  const labelSizeVal = document.getElementById('label-size-val');
  const maxNodesSlider = document.getElementById('max-nodes') as HTMLInputElement;
  const maxNodesVal = document.getElementById('max-nodes-val');

  function getDisplaySettings() {
    return {
      nodeScale: (nodeSizeSlider?.valueAsNumber || 10) / 10,
      topLabelCount: labelCountSlider?.valueAsNumber || 40,
      edgeOpacity: (edgeOpacitySlider?.valueAsNumber || 100) / 100,
      labelSize: labelSizeSlider?.valueAsNumber || 11,
      maxNodes: maxNodesSlider?.valueAsNumber || 10000,
    };
  }

  // Filters + display settings trigger rerender.
  function rerender() {
    if (currentView === 'galaxy3d') return;
    const settings = getDisplaySettings();
    if (sigmaInst) sigmaInst.destroy();
    sigmaInst = renderSigma(container, graph!, {
      crossCommunityOnly: crossCommunityCheckbox?.checked || false,
      minConfidence: (confidenceSlider?.valueAsNumber || 0) / 100,
      maxNodes: settings.maxNodes,
      nodeScale: settings.nodeScale,
      topLabelCount: settings.topLabelCount,
      edgeOpacity: settings.edgeOpacity,
      labelSize: settings.labelSize,
      onSelect,
    });
  }

  crossCommunityCheckbox?.addEventListener('change', rerender);
  confidenceSlider?.addEventListener('input', () => {
    if (confidenceVal) confidenceVal.textContent = `${confidenceSlider.value}%`;
    rerender();
  });

  // Display setting listeners.
  function addSliderListener(slider: HTMLInputElement | null, valEl: HTMLElement | null, fmt: (v: number) => string) {
    slider?.addEventListener('input', () => {
      if (valEl) valEl.textContent = fmt(slider.valueAsNumber);
      rerender();
    });
  }
  addSliderListener(nodeSizeSlider, nodeSizeVal, v => `${(v / 10).toFixed(1)}x`);
  addSliderListener(labelCountSlider, labelCountVal, v => `${v}`);
  addSliderListener(edgeOpacitySlider, edgeOpacityVal, v => `${v}%`);
  addSliderListener(labelSizeSlider, labelSizeVal, v => `${v}px`);
  addSliderListener(maxNodesSlider, maxNodesVal, v => v >= 10000 ? 'All' : `${v}`);

  const gravitySlider = document.getElementById('gravity') as HTMLInputElement;
  const gravityValEl = document.getElementById('gravity-val');
  const spreadSlider = document.getElementById('spread') as HTMLInputElement;
  const spreadValEl = document.getElementById('spread-val');
  addSliderListener(gravitySlider, gravityValEl, v => `${(v / 10).toFixed(1)}`);
  addSliderListener(spreadSlider, spreadValEl, v => `${v}`);
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

main().catch(console.error);
