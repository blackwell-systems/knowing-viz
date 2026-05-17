// Provenance view: color edges by how they were discovered.
// Static edges (blue), runtime edges (green), stale/low-confidence (red).

export const PROVENANCE_COLORS: Record<string, string> = {
  lsp_resolved: '#58a6ff',   // blue (compiler-verified)
  ast_resolved: '#79c0ff',   // light blue
  ast_inferred: '#d29922',   // amber (tree-sitter, lower confidence)
  runtime_calls: '#3fb950',  // green (observed in production)
  runtime_rpc: '#3fb950',
  otel_trace: '#3fb950',
  default: '#484f58',        // gray (unknown)
};

export function provenanceColor(provenance: string): string {
  return PROVENANCE_COLORS[provenance] || PROVENANCE_COLORS.default;
}

// Apply provenance coloring to Cytoscape edges.
export function applyProvenanceView(cy: any) {
  // Reset node opacity.
  cy.nodes().style('opacity', 1);

  // Color edges by provenance.
  cy.edges().forEach((ele: any) => {
    const prov = ele.data('provenance') || 'default';
    const color = provenanceColor(prov);
    const confidence = ele.data('confidence') || 0.5;
    ele.style({
      'line-color': color,
      'target-arrow-color': color,
      'opacity': Math.max(confidence, 0.2),
      'width': confidence > 0.8 ? 2 : 1,
    });
  });
}
