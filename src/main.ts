import { loadGraph, graphStats, type GraphNode, type GraphEdge } from './graph-data';
import { renderGalaxy } from './galaxy';

const GRAPH_URL = '/graph.json';

async function main() {
  const container = document.getElementById('graph-container');
  const statsEl = document.getElementById('stats');
  const selectedInfo = document.getElementById('selected-info');
  const crossCommunityCheckbox = document.getElementById('cross-community-only') as HTMLInputElement;
  const confidenceSlider = document.getElementById('confidence-min') as HTMLInputElement;
  const confidenceVal = document.getElementById('confidence-val');

  if (!container) throw new Error('Missing #graph-container');

  // Load graph data.
  let graph;
  try {
    graph = await loadGraph(GRAPH_URL);
  } catch (err) {
    container.innerHTML = `<div style="color:#f87171;padding:40px;text-align:center;">
      <h2>No graph data found</h2>
      <p>Run <code>knowing export -format json > public/graph.json</code> to generate data.</p>
    </div>`;
    return;
  }

  // Display stats.
  const stats = graphStats(graph);
  if (statsEl) {
    statsEl.innerHTML = `
      Nodes: ${stats.nodes.toLocaleString()}<br>
      Edges: ${stats.edges.toLocaleString()}<br>
      Communities: ${stats.communities}<br>
      Cross-community: ${stats.crossCommunityEdges.toLocaleString()}<br>
      <br>
      <strong>By kind:</strong><br>
      ${Object.entries(stats.kindCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k}: ${v}`)
        .join('<br>')}
    `;
  }

  // Selection handler.
  function onSelect(node: GraphNode | null, edges: GraphEdge[]) {
    if (!selectedInfo) return;
    if (!node) {
      selectedInfo.innerHTML = '<em>Click a node to see details</em>';
      return;
    }
    const callers = edges.filter(e => e.target === node.id);
    const callees = edges.filter(e => e.source === node.id);
    const crossComm = edges.filter(e => e.crossCommunity);
    const community = graph!.communities.find(c => c.id === node.community);

    selectedInfo.innerHTML = `
      <div class="symbol-name">${node.shortName}</div>
      <div class="symbol-qname">${node.label}</div>
      Kind: ${node.kind}<br>
      Package: ${node.package}<br>
      Community: ${community ? community.label : 'ungrouped'}<br>
      Signature: <code>${node.signature}</code><br>
      <br>
      <span class="callers">Callers: ${callers.length}</span><br>
      Callees: ${callees.length}<br>
      <span class="cross-community">Cross-community edges: ${crossComm.length}</span>
    `;
  }

  // Render initial graph.
  let cy = renderGalaxy(container, graph, { onSelect });

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
    if (confidenceVal) {
      confidenceVal.textContent = `${confidenceSlider.value}%`;
    }
    rerender();
  });
}

main().catch(console.error);
