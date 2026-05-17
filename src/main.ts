import { loadGraph, graphStats, type GraphNode, type GraphEdge, type Community } from './graph-data';
import { renderGalaxy } from './galaxy';

// @ts-ignore
const GRAPH_URL = import.meta.env.BASE_URL + 'graph.json';

// Community colors (consistent with knowing dot export).
const COMMUNITY_COLORS = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

function communityColor(id: number): string {
  return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length];
}

async function main() {
  const container = document.getElementById('graph-container');
  const communitiesEl = document.getElementById('communities');
  const selectedInfo = document.getElementById('selected-info');
  const detailPanel = document.getElementById('detail-panel');
  const detailName = document.getElementById('detail-name');
  const detailClose = document.getElementById('detail-close');
  const searchInput = document.getElementById('search') as HTMLInputElement;
  const crossCommunityCheckbox = document.getElementById('cross-community-only') as HTMLInputElement;
  const confidenceSlider = document.getElementById('confidence-min') as HTMLInputElement;
  const confidenceVal = document.getElementById('confidence-val');

  if (!container) throw new Error('Missing #graph-container');

  // Load graph data.
  let graph;
  try {
    graph = await loadGraph(GRAPH_URL);
  } catch (err) {
    container.innerHTML = `<div style="color:#f85149;padding:40px;text-align:center;">
      <h2>No graph data found</h2>
      <p>Run <code>knowing export -format json > public/graph.json</code></p>
    </div>`;
    return;
  }

  // Stats bar.
  const stats = graphStats(graph);
  const nodeCountEl = document.getElementById('node-count');
  const edgeCountEl = document.getElementById('edge-count');
  const communityCountEl = document.getElementById('community-count');
  const crossCountEl = document.getElementById('cross-count');
  if (nodeCountEl) nodeCountEl.textContent = `Nodes: ${stats.nodes.toLocaleString()}`;
  if (edgeCountEl) edgeCountEl.textContent = `Edges: ${stats.edges.toLocaleString()}`;
  if (communityCountEl) communityCountEl.textContent = `Communities: ${stats.communities}`;
  if (crossCountEl) crossCountEl.textContent = `Cross-community: ${stats.crossCommunityEdges.toLocaleString()}`;

  // Populate community sidebar.
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
        // Toggle highlight on this community.
        const isActive = item.classList.contains('active');
        communitiesEl.querySelectorAll('.community-item').forEach(el => el.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
          highlightCommunity(cy, comm.id);
        } else {
          resetHighlight(cy);
        }
      });
      communitiesEl.appendChild(item);
    }
  }

  // Node lookup for detail panel.
  const nodeMap = new Map<string, GraphNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  // Selection handler.
  function onSelect(node: GraphNode | null, edges: GraphEdge[]) {
    if (!selectedInfo || !detailPanel || !detailName) return;
    if (!node) {
      detailPanel.classList.add('hidden');
      return;
    }

    detailPanel.classList.remove('hidden');
    detailName.textContent = node.shortName;

    const callers = edges.filter(e => e.target === node.id);
    const callees = edges.filter(e => e.source === node.id);
    const crossComm = edges.filter(e => e.crossCommunity);
    const community = graph!.communities.find((c: Community) => c.id === node.community);

    let callersHtml = '';
    for (const e of callers.slice(0, 15)) {
      const src = nodeMap.get(e.source);
      const cls = e.crossCommunity ? 'edge-cross' : 'edge-type';
      callersHtml += `<li><span class="${cls}">${e.type}</span> ${src?.shortName || e.source.slice(0, 8)}</li>`;
    }
    if (callers.length > 15) callersHtml += `<li>... +${callers.length - 15} more</li>`;

    let calleesHtml = '';
    for (const e of callees.slice(0, 15)) {
      const tgt = nodeMap.get(e.target);
      const cls = e.crossCommunity ? 'edge-cross' : 'edge-type';
      calleesHtml += `<li><span class="${cls}">${e.type}</span> ${tgt?.shortName || e.target.slice(0, 8)}</li>`;
    }
    if (callees.length > 15) calleesHtml += `<li>... +${callees.length - 15} more</li>`;

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
        <div class="detail-label">Callers <span class="stat-highlight">${callers.length}</span> (${crossComm.filter(e => e.target === node.id).length} cross-community)</div>
        <ul class="edge-list">${callersHtml || '<li>none</li>'}</ul>
      </div>

      <div class="detail-section">
        <div class="detail-label">Callees <span class="stat-highlight">${callees.length}</span></div>
        <ul class="edge-list">${calleesHtml || '<li>none</li>'}</ul>
      </div>
    `;
  }

  // Close detail panel.
  detailClose?.addEventListener('click', () => {
    detailPanel?.classList.add('hidden');
  });

  // Render graph.
  let cy = renderGalaxy(container!, graph, { onSelect });

  // Search.
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      resetHighlight(cy);
      return;
    }
    // Find matching nodes.
    const matches = graph!.nodes
      .filter(n => n.shortName.toLowerCase().includes(query) || n.label.toLowerCase().includes(query))
      .map(n => n.id);
    const matchSet = new Set(matches);

    cy.nodes().forEach((ele: any) => {
      if (ele.data('kind')) {
        const dim = !matchSet.has(ele.id());
        ele.style('opacity', dim ? 0.1 : 1);
      }
    });
    cy.edges().forEach((ele: any) => {
      const src = ele.data('source');
      const tgt = ele.data('target');
      ele.style('opacity', matchSet.has(src) || matchSet.has(tgt) ? 0.7 : 0.03);
    });
  });

  // Filter controls.
  function rerender() {
    cy.destroy();
    cy = renderGalaxy(container!, graph!, {
      crossCommunityOnly: crossCommunityCheckbox?.checked || false,
      minConfidence: (confidenceSlider?.valueAsNumber || 0) / 100,
      onSelect,
    });
  }

  crossCommunityCheckbox?.addEventListener('change', rerender);
  confidenceSlider?.addEventListener('input', () => {
    if (confidenceVal) {
      confidenceVal.textContent = `${confidenceSlider.value}%`;
    }
    rerender();
  });
}

function highlightCommunity(cy: any, communityId: number) {
  const parentId = `comm:${communityId}`;
  cy.nodes().forEach((ele: any) => {
    if (ele.data('parent') === parentId || ele.id() === parentId) {
      ele.style('opacity', 1);
    } else if (ele.data('kind')) {
      ele.style('opacity', 0.15);
    } else {
      ele.style('opacity', 0.3);
    }
  });
  cy.edges().forEach((ele: any) => {
    const src = cy.getElementById(ele.data('source'));
    const tgt = cy.getElementById(ele.data('target'));
    const srcIn = src.data('parent') === parentId;
    const tgtIn = tgt.data('parent') === parentId;
    ele.style('opacity', srcIn || tgtIn ? 0.8 : 0.03);
  });
}

function resetHighlight(cy: any) {
  cy.nodes().style('opacity', 1);
  cy.edges().forEach((ele: any) => {
    ele.style('opacity', ele.hasClass('cross-community') ? 0.7 : 0.3);
  });
}

main().catch(console.error);
