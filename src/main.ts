import { loadGraph, graphStats, type GraphNode, type GraphEdge, type Community } from './graph-data';
import { renderGalaxy } from './galaxy';
import { computeBlastRadius, applyBlastRadius } from './blast-radius';
import { applyProvenanceView, PROVENANCE_COLORS } from './provenance';
import { loadGraph as loadGraphRaw } from './graph-data';
import { computeDiff, applyDiffView } from './timeline';
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

type ViewMode = 'communities' | 'blast-radius' | 'provenance' | 'timeline' | 'galaxy3d';

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

  // Load graph data.
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

  // State.
  let currentView: ViewMode = 'communities';
  let blastTarget: string | null = null;

  // Stats bar.
  const stats = graphStats(graph);
  setText('node-count', `Nodes: ${stats.nodes.toLocaleString()}`);
  setText('edge-count', `Edges: ${stats.edges.toLocaleString()}`);
  setText('community-count', `Communities: ${stats.communities}`);
  setText('cross-count', `Cross-community: ${stats.crossCommunityEdges.toLocaleString()}`);

  // Node lookup.
  const nodeMap = new Map<string, GraphNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  // Populate community sidebar (multi-select: toggle each on/off).
  const activeCommunityIds = new Set<number>();
  const sortedCommunities = [...graph.communities].sort((a, b) => b.size - a.size);
  if (communitiesEl) {
    for (const comm of sortedCommunities) {
      const item = document.createElement('div');
      item.className = 'community-item';
      item.dataset.communityId = String(comm.id);
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
        if (activeCommunityIds.size === 0) {
          resetView(cy);
        } else {
          highlightCommunities(cy, activeCommunityIds);
        }
      });
      communitiesEl.appendChild(item);
    }
  }

  // Selection handler.
  function onSelect(node: GraphNode | null, edges: GraphEdge[]) {
    if (!selectedInfo || !detailPanel || !detailName) return;
    if (!node) {
      detailPanel.classList.add('hidden');
      return;
    }

    // In blast-radius mode, clicking a node shows its blast radius.
    if (currentView === 'blast-radius') {
      blastTarget = node.id;
      const result = computeBlastRadius(graph!, node.id, 4);
      if (result) {
        applyBlastRadius(cy, result);
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
    const crossComm = edges.filter(e => e.crossCommunity);
    const community = graph!.communities.find((c: Community) => c.id === node.community);

    let callersHtml = '';
    for (const e of callers.slice(0, 20)) {
      const src = nodeMap.get(e.source);
      const cls = e.crossCommunity ? 'edge-cross' : 'edge-type';
      callersHtml += `<li><span class="${cls}">${e.type}</span> ${src?.shortName || e.source.slice(0, 8)}</li>`;
    }
    if (callers.length > 20) callersHtml += `<li class="more">+${callers.length - 20} more</li>`;

    let calleesHtml = '';
    for (const e of callees.slice(0, 20)) {
      const tgt = nodeMap.get(e.target);
      const cls = e.crossCommunity ? 'edge-cross' : 'edge-type';
      calleesHtml += `<li><span class="${cls}">${e.type}</span> ${tgt?.shortName || e.target.slice(0, 8)}</li>`;
    }
    if (callees.length > 20) calleesHtml += `<li class="more">+${callees.length - 20} more</li>`;

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
        <ul class="edge-list">${callersHtml || '<li>none</li>'}</ul>
      </div>
      <div class="detail-section">
        <div class="detail-label">Callees <span class="stat-highlight">${callees.length}</span></div>
        <ul class="edge-list">${calleesHtml || '<li>none</li>'}</ul>
      </div>
    `;
  }

  function showBlastDetail(node: GraphNode, result: any) {
    if (!selectedInfo || !detailPanel || !detailName) return;
    detailPanel.classList.remove('hidden');
    detailName.textContent = `Blast: ${node.shortName}`;

    const byDepth = new Map<number, string[]>();
    for (const [id, depth] of result.affected) {
      if (depth === 0) continue;
      const list = byDepth.get(depth) || [];
      const n = nodeMap.get(id);
      list.push(n?.shortName || id.slice(0, 8));
      byDepth.set(depth, list);
    }

    let html = `
      <div class="detail-label">Center</div>
      <div class="detail-code">${node.label}</div>
      <div class="detail-label">Total Affected</div>
      <div class="detail-value"><span class="stat-danger">${result.affected.size - 1}</span> symbols across ${result.edges.length} edges</div>
    `;

    for (const [depth, names] of [...byDepth.entries()].sort((a, b) => a[0] - b[0])) {
      html += `
        <div class="detail-section">
          <div class="detail-label">Depth ${depth} <span class="stat-highlight">${names.length}</span></div>
          <ul class="edge-list">${names.map(n => `<li>${n}</li>`).join('')}</ul>
        </div>
      `;
    }

    selectedInfo.innerHTML = html;
  }

  // Close detail panel.
  detailClose?.addEventListener('click', () => {
    detailPanel?.classList.add('hidden');
    if (currentView === 'blast-radius') {
      blastTarget = null;
      resetView(cy);
    }
  });

  // Render graph.
  let cy = renderGalaxy(container, graph, { onSelect });
  let cleanup3D: (() => void) | null = null;

  function destroy3D() {
    if (cleanup3D) {
      cleanup3D();
      cleanup3D = null;
      // Restore Cytoscape.
      container.innerHTML = '';
      cy = renderGalaxy(container, graph!, { onSelect });
    }
  }

  // View switching.
  const viewButtons = document.querySelectorAll('#view-toggles button');
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = (btn as HTMLElement).dataset.view as ViewMode;

      // Clean up 3D if switching away from it.
      if (currentView !== 'galaxy3d') {
        destroy3D();
      }

      switch (currentView) {
        case 'communities':
          resetView(cy);
          break;
        case 'blast-radius':
          // Dim everything, wait for node click.
          cy.nodes('[kind]').style('opacity', 0.6);
          cy.edges().style('opacity', 0.15);
          cy.nodes('.community').style('opacity', 0.4);
          if (selectedInfo) {
            selectedInfo.innerHTML = '<em>Click a node to see its blast radius</em>';
            detailPanel?.classList.remove('hidden');
            if (detailName) detailName.textContent = 'Blast Radius';
          }
          break;
        case 'provenance':
          applyProvenanceView(cy);
          if (selectedInfo) {
            let legend = '<div class="detail-label">Provenance Legend</div>';
            for (const [prov, color] of Object.entries(PROVENANCE_COLORS)) {
              if (prov === 'default') continue;
              legend += `<div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${prov}</div>`;
            }
            selectedInfo.innerHTML = legend;
            detailPanel?.classList.remove('hidden');
            if (detailName) detailName.textContent = 'Provenance';
          }
          break;
        case 'timeline':
          // Load before snapshot and diff against current graph.
          (async () => {
            try {
              // @ts-ignore
              const beforeUrl = import.meta.env.BASE_URL + 'graph-before.json';
              const before = await loadGraphRaw(beforeUrl);
              const diff = computeDiff(before, graph!);
              applyDiffView(cy, diff);
              if (selectedInfo && detailPanel && detailName) {
                detailPanel.classList.remove('hidden');
                detailName.textContent = 'Timeline Diff';
                selectedInfo.innerHTML = `
                  <div class="detail-label">Changes</div>
                  <div class="detail-value">
                    <span style="color:#3fb950">+${diff.stats.nodesAdded} nodes</span> /
                    <span style="color:#f85149">-${diff.stats.nodesRemoved} nodes</span>
                  </div>
                  <div class="detail-value">
                    <span style="color:#3fb950">+${diff.stats.edgesAdded} edges</span> /
                    <span style="color:#f85149">-${diff.stats.edgesRemoved} edges</span>
                  </div>
                  <div class="detail-label" style="margin-top:12px">Legend</div>
                  <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3fb950;margin-right:6px;vertical-align:middle;"></span>Added</div>
                  <div class="detail-value"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8b949e;margin-right:6px;vertical-align:middle;opacity:0.3"></span>Unchanged</div>
                `;
              }
            } catch {
              if (selectedInfo && detailPanel && detailName) {
                detailPanel.classList.remove('hidden');
                detailName.textContent = 'Timeline';
                selectedInfo.innerHTML = '<em>No baseline snapshot found. Export a baseline with <code>knowing export > public/graph-before.json</code> before making changes.</em>';
              }
            }
          })();
          break;
        case 'galaxy3d':
          // Switch to Three.js 3D view.
          cy.destroy();
          cleanup3D = renderGalaxy3D(container, graph!);
          if (selectedInfo && detailPanel && detailName) {
            detailPanel.classList.remove('hidden');
            detailName.textContent = 'Galaxy 3D';
            selectedInfo.innerHTML = `
              <div class="detail-label">Controls</div>
              <div class="detail-value">Drag to orbit</div>
              <div class="detail-value">Scroll to zoom</div>
              <div class="detail-value">Auto-rotating</div>
              <div class="detail-label" style="margin-top:12px">Legend</div>
              <div class="detail-value">Each cluster = one community</div>
              <div class="detail-value"><span style="color:#f85149">Red lines</span> = cross-community edges</div>
              <div class="detail-value">Node color = community membership</div>
            `;
          }
          break;
      }
    });
  });

  // Search.
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      resetView(cy);
      return;
    }
    const matches = graph!.nodes
      .filter(n => n.shortName.toLowerCase().includes(query) || n.label.toLowerCase().includes(query))
      .map(n => n.id);
    const matchSet = new Set(matches);

    cy.nodes().forEach((ele: any) => {
      if (ele.data('kind')) {
        ele.style('opacity', matchSet.has(ele.id()) ? 1 : 0.08);
      } else {
        ele.style('opacity', 0.3);
      }
    });
    cy.edges().forEach((ele: any) => {
      const src = ele.data('source');
      const tgt = ele.data('target');
      ele.style('opacity', matchSet.has(src) || matchSet.has(tgt) ? 0.7 : 0.02);
    });
  });

  // Filter controls.
  function rerender() {
    cy.destroy();
    cy = renderGalaxy(container, graph!, {
      crossCommunityOnly: crossCommunityCheckbox?.checked || false,
      minConfidence: (confidenceSlider?.valueAsNumber || 0) / 100,
      onSelect,
    });
  }

  crossCommunityCheckbox?.addEventListener('change', rerender);
  confidenceSlider?.addEventListener('input', () => {
    if (confidenceVal) confidenceVal.textContent = `${confidenceSlider.value}%`;
    rerender();
  });
}

function highlightCommunities(cy: any, communityIds: Set<number>) {
  const parentIds = new Set([...communityIds].map(id => `comm:${id}`));
  cy.nodes().forEach((ele: any) => {
    const parent = ele.data('parent');
    if (parentIds.has(parent) || parentIds.has(ele.id())) {
      ele.style('opacity', 1);
    } else if (ele.data('kind')) {
      ele.style('opacity', 0.08);
    } else {
      ele.style('opacity', 0.15);
    }
  });
  cy.edges().forEach((ele: any) => {
    const src = cy.getElementById(ele.data('source'));
    const tgt = cy.getElementById(ele.data('target'));
    const srcIn = parentIds.has(src.data('parent'));
    const tgtIn = parentIds.has(tgt.data('parent'));
    if (srcIn && tgtIn) {
      // Edge between two selected communities: bright.
      ele.style('opacity', 0.9);
    } else if (srcIn || tgtIn) {
      // Edge from selected to non-selected: medium.
      ele.style('opacity', 0.4);
    } else {
      ele.style('opacity', 0.02);
    }
  });
}

function resetView(cy: any) {
  cy.nodes().style('opacity', 1);
  cy.nodes('[kind]').removeStyle('background-color border-width border-color width height');
  cy.edges().forEach((ele: any) => {
    ele.removeStyle('line-color target-arrow-color width');
    ele.style('opacity', ele.hasClass('cross-community') ? 0.5 : 0.3);
  });
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

main().catch(console.error);
