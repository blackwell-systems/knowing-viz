<p align="center">
  <img src="assets/knowing-viz-banner.png" alt="knowing-viz" width="600">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/blackwell-systems/knowing"><img src="https://img.shields.io/badge/powered_by-knowing-brightgreen.svg" alt="Powered by knowing"></a>
  <a href="https://github.com/blackwell-systems"><img src="https://raw.githubusercontent.com/blackwell-systems/blackwell-docs-theme/main/badge-trademark.svg" alt="Blackwell Systems"></a>
</p>

<p align="center">
  <strong>Interactive graph visualization for cross-repo software relationships.</strong>
</p>

## What This Is

A static site that visualizes [knowing](https://github.com/blackwell-systems/knowing)'s knowledge graph: nodes (symbols), edges (relationships), cross-repo connections, provenance tiers, and blast radius. No backend, no database, no auth. Reads a JSON export from knowing and renders it.

## Views

**Galaxy View:** All repos as clusters, cross-repo edges as arcs between them. Nodes sized by blast radius. The hero screenshot.

**Blast Radius View:** Click a symbol, see all transitive callers fan out. Cross-repo callers highlighted. Confidence shown as edge opacity.

**Timeline View:** Scrub through commits. New edges glow, removed edges fade. Visualizes the event-sourced history.

**Provenance Overlay:** Toggle between static edges (blue), runtime edges (green), and stale edges (red).

## Usage

```bash
# In your knowing repo, export the graph
knowing export > graph.json

# Copy to this project
cp graph.json public/demo-graph.json

# Run locally
npm install
npm run dev
```

Or use the pre-baked demo data from polywave-go + polywave-web (228 cross-repo edges).

## Data Source

This project consumes JSON exported by `knowing export`. No runtime dependency on knowing. The JSON schema:

```json
{
  "repos": [{"id": "...", "url": "...", "nodeCount": 6340}],
  "nodes": [{"id": "hash", "label": "pkg.Func", "kind": "function", "repo": "...", "package": "..."}],
  "edges": [{"source": "hash1", "target": "hash2", "type": "calls", "provenance": "lsp_resolved", "confidence": 0.9, "crossRepo": true}],
  "snapshots": [{"hash": "...", "commit": "abc123", "timestamp": 1715700000}]
}
```

## Tech Stack

- [Cytoscape.js](https://js.cytoscape.org/) (2D interactive graph)
- [Three.js](https://threejs.org/) (3D galaxy view for screenshots)
- [Vite](https://vite.dev/) (build tool)
- TypeScript
- Static deployment (GitHub Pages)

## Relationship to knowing

`knowing` is the system of record. `knowing-viz` is a read-only visualization layer that consumes exported data. No code is shared between the two projects. Screenshots generated here are used in knowing's README.

## License

MIT
