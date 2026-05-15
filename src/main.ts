import { loadGraph, graphStats, type GraphNode, type GraphEdge } from './graph-data';
import { renderGalaxy } from './galaxy';

const GRAPH_URL = '/demo-graph.json';

async function main() {
  const container = document.getElementById('graph-container');
  const statsEl = document.getElementById('stats');
  const selectedInfo = document.getElementById('selected-info');
  const crossRepoCheckbox = document.getElementById('cross-repo-only') as HTMLInputElement;
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
      <p>Run <code>knowing export > public/demo-graph.json</code> to generate data.</p>
    </div>`;
    return;
  }

  // Display stats.
  const stats = graphStats(graph);
  if (statsEl) {
    statsEl.innerHTML = `
      Repos: ${stats.repos}<br>
      Nodes: ${stats.nodes.toLocaleString()}<br>
      Edges: ${stats.edges.toLocaleString()}<br>
      Cross-repo: ${stats.crossRepoEdges}<br>
      <br>
      ${Object.entries(stats.provenanceCounts)
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
    const crossRepoCallers = callers.filter(e => e.crossRepo);

    selectedInfo.innerHTML = `
      <div class="symbol-name">${node.label}</div>
      Kind: ${node.kind}<br>
      Package: ${node.package}<br>
      Repo: ${node.repo}<br>
      Line: ${node.line}<br>
      <br>
      <span class="callers">Callers: ${callers.length}</span><br>
      Callees: ${callees.length}<br>
      <span class="cross-repo">Cross-repo callers: ${crossRepoCallers.length}</span>
    `;
  }

  // Render initial graph.
  let cy = renderGalaxy(container, graph, { onSelect });

  // Filter controls.
  function rerender() {
    cy.destroy();
    cy = renderGalaxy(container, graph!, {
      crossRepoOnly: crossRepoCheckbox?.checked || false,
      minConfidence: (confidenceSlider?.valueAsNumber || 0) / 100,
      onSelect,
    });
  }

  crossRepoCheckbox?.addEventListener('change', rerender);
  confidenceSlider?.addEventListener('input', () => {
    if (confidenceVal) {
      confidenceVal.textContent = `${confidenceSlider.value}%`;
    }
    rerender();
  });

  // View toggle buttons.
  const viewButtons = document.querySelectorAll('#view-toggles button');
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Future: switch between galaxy, blast-radius, provenance views
    });
  });
}

main().catch(console.error);
