// Graph data model matching knowing's export format.

export interface Repo {
  id: string;
  url: string;
  nodeCount: number;
  edgeCount: number;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: string; // function, type, method, interface, const, var
  repo: string;
  package: string;
  line: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string; // calls, imports, implements, references
  provenance: string; // ast_inferred, lsp_resolved, ast_resolved, runtime_calls
  confidence: number; // 0.0 to 1.0
  crossRepo: boolean;
  callSite?: { file: string; line: number; col: number };
}

export interface Snapshot {
  hash: string;
  commit: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
}

export interface KnowingGraph {
  repos: Repo[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  snapshots: Snapshot[];
}

export async function loadGraph(url: string): Promise<KnowingGraph> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load graph: ${response.statusText}`);
  }
  return response.json();
}

// Compute stats for display.
export function graphStats(graph: KnowingGraph) {
  const crossRepoEdges = graph.edges.filter(e => e.crossRepo).length;
  const provenanceCounts: Record<string, number> = {};
  for (const e of graph.edges) {
    provenanceCounts[e.provenance] = (provenanceCounts[e.provenance] || 0) + 1;
  }
  const kindCounts: Record<string, number> = {};
  for (const n of graph.nodes) {
    kindCounts[n.kind] = (kindCounts[n.kind] || 0) + 1;
  }
  return {
    repos: graph.repos.length,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    crossRepoEdges,
    provenanceCounts,
    kindCounts,
  };
}
