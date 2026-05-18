// Graph data model matching knowing's export format (with community annotations).

export interface Community {
  id: number;
  label: string;
  size: number;
}

export interface GraphNode {
  id: string;        // node_hash
  label: string;     // qualified_name
  kind: string;      // function, type, method, service
  line: number;
  signature: string;
  community: number; // -1 = ungrouped
  lastAuthor: string;    // git blame: who last touched this symbol
  lastCommitAt: number;  // git blame: unix timestamp
  coveragePct: number;   // test coverage percentage (-1 = not measured)
  doc: string;           // doc comment
  // Derived fields (populated by loadGraph):
  repo: string;
  package: string;
  shortName: string;
}

export interface GraphEdge {
  id: string;          // edge_hash
  source: string;      // source_hash
  target: string;      // target_hash
  type: string;        // calls, imports, implements, references
  provenance: string;
  confidence: number;
  crossCommunity: boolean;
}

export interface GraphMetadata {
  repo: string;
  snapshot: string;
  exported_at: string;
  node_count: number;
  edge_count: number;
  community_count: number;
}

export interface KnowingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: Community[];
  metadata: GraphMetadata;
}

// Raw JSON shape from knowing export.
interface RawNode {
  node_hash: string;
  qualified_name: string;
  kind: string;
  line: number;
  signature: string;
  community: number;
  last_author?: string;
  last_commit_at?: number;
  coverage_pct?: number;
  doc?: string;
}

interface RawEdge {
  edge_hash: string;
  source_hash: string;
  target_hash: string;
  edge_type: string;
  confidence: number;
  provenance: string;
  cross_community: boolean;
}

interface RawGraph {
  nodes: RawNode[];
  edges: RawEdge[];
  communities: Community[];
  metadata: GraphMetadata;
}

function extractPackage(qualifiedName: string): string {
  const sep = qualifiedName.indexOf('://');
  if (sep < 0) return '';
  const rest = qualifiedName.slice(sep + 3);
  const lastDot = rest.lastIndexOf('.');
  if (lastDot < 0) return rest;
  const pkg = rest.slice(0, lastDot);
  const lastSlash = pkg.lastIndexOf('/');
  return lastSlash >= 0 ? pkg.slice(lastSlash + 1) : pkg;
}

function extractRepo(qualifiedName: string): string {
  const sep = qualifiedName.indexOf('://');
  if (sep < 0) return '';
  return qualifiedName.slice(0, sep);
}

function extractShortName(qualifiedName: string): string {
  const lastDot = qualifiedName.lastIndexOf('.');
  return lastDot >= 0 ? qualifiedName.slice(lastDot + 1) : qualifiedName;
}

export async function loadGraph(url: string): Promise<KnowingGraph> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load graph: ${response.statusText}`);
  }
  const raw: RawGraph = await response.json();

  // Transform raw nodes to the internal model.
  const nodes: GraphNode[] = raw.nodes.map(n => ({
    id: n.node_hash,
    label: n.qualified_name,
    kind: n.kind,
    line: n.line,
    signature: n.signature,
    community: n.community,
    lastAuthor: n.last_author || '',
    lastCommitAt: n.last_commit_at || 0,
    coveragePct: n.coverage_pct ?? -1,
    doc: n.doc || '',
    repo: extractRepo(n.qualified_name),
    package: extractPackage(n.qualified_name),
    shortName: extractShortName(n.qualified_name),
  }));

  // Transform raw edges.
  const edges: GraphEdge[] = raw.edges.map(e => ({
    id: e.edge_hash,
    source: e.source_hash,
    target: e.target_hash,
    type: e.edge_type,
    provenance: e.provenance,
    confidence: e.confidence,
    crossCommunity: e.cross_community,
  }));

  return {
    nodes,
    edges,
    communities: raw.communities || [],
    metadata: raw.metadata,
  };
}

// Load graph from a File object (from file picker).
export async function loadGraphFromFile(file: File): Promise<KnowingGraph> {
  const text = await file.text();
  const raw: RawGraph = JSON.parse(text);

  const nodes: GraphNode[] = raw.nodes.map(n => ({
    id: n.node_hash,
    label: n.qualified_name,
    kind: n.kind,
    line: n.line,
    signature: n.signature,
    community: n.community,
    lastAuthor: n.last_author || '',
    lastCommitAt: n.last_commit_at || 0,
    coveragePct: n.coverage_pct ?? -1,
    doc: n.doc || '',
    repo: extractRepo(n.qualified_name),
    package: extractPackage(n.qualified_name),
    shortName: extractShortName(n.qualified_name),
  }));

  const edges: GraphEdge[] = raw.edges.map(e => ({
    id: e.edge_hash,
    source: e.source_hash,
    target: e.target_hash,
    type: e.edge_type,
    provenance: e.provenance,
    confidence: e.confidence,
    crossCommunity: e.cross_community,
  }));

  return {
    nodes,
    edges,
    communities: raw.communities || [],
    metadata: raw.metadata,
  };
}

// Compute stats for display.
export function graphStats(graph: KnowingGraph) {
  const crossCommunityEdges = graph.edges.filter(e => e.crossCommunity).length;
  const provenanceCounts: Record<string, number> = {};
  for (const e of graph.edges) {
    provenanceCounts[e.provenance] = (provenanceCounts[e.provenance] || 0) + 1;
  }
  const kindCounts: Record<string, number> = {};
  for (const n of graph.nodes) {
    kindCounts[n.kind] = (kindCounts[n.kind] || 0) + 1;
  }
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    communities: graph.communities.length,
    crossCommunityEdges,
    provenanceCounts,
    kindCounts,
  };
}
