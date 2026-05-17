# Roadmap

## Current State

The viz repo has Cytoscape.js + Three.js + Vite + TypeScript. Graph data is available as:
- `public/graph.json` (1497 nodes, 7370 edges, raw export from knowing)
- `public/graph.dot` (Graphviz DOT with 20 Louvain community subgraphs)

The JSON currently lacks community annotations. The viz has no rendering yet.

---

## Phase 1: Community-Annotated Data (knowing side)

**Goal:** `knowing export -format json` includes community membership so the viz doesn't need to run Louvain client-side.

| Task | Description | Status |
|------|-------------|--------|
| Add `community` field to JSON export | Each node gets `"community": {"id": N, "label": "context", "size": 45}` | planned |
| Add `cross_community` field to edge export | Boolean flag for edges crossing community boundaries | planned |
| Add community summary to metadata | Top-level `"communities": [{"id": 0, "label": "...", "size": N, "cohesion": 0.8}]` | planned |
| Re-export graph.json with annotations | Refresh `public/graph.json` | planned |

---

## Phase 2: Static Community Overview (the "architectural map")

**Goal:** One-page view showing all communities as clusters. The screenshot teams put in their README.

| Task | Description | Status |
|------|-------------|--------|
| Cytoscape compound node layout | Use `cose-bilkent` with community parent nodes | planned |
| Community color palette | 16 distinct colors, consistent across renders | planned |
| Node sizing by blast radius | Higher caller count = larger node | planned |
| Edge bundling | Cross-community edges bundled as thick colored arcs | planned |
| Community labels | Dominant package name as cluster label | planned |
| Node shape by kind | box=function, ellipse=type, hexagon=service | planned |
| Cross-community edges in red | Same visual language as dot export | planned |
| Static HTML export | `npm run build` produces a self-contained `index.html` | planned |

---

## Phase 3: Interactive Navigation

**Goal:** Click to explore. Three zoom levels.

| Task | Description | Status |
|------|-------------|--------|
| Level 1: Community overview | Communities as circles sized by member count. Click to drill in. | planned |
| Level 2: Community internals | Expand a community to show its symbols + internal edges | planned |
| Level 3: Symbol detail | Click a symbol to see callers, callees, signature, file, line | planned |
| Edge type filtering | Toggle calls/imports/references/implements visibility | planned |
| Search | Type symbol name, highlight its community and connections | planned |
| Breadcrumb navigation | "All > context > RankSymbols" with back navigation | planned |
| Tooltip on hover | Symbol signature, kind, community, caller count | planned |

---

## Phase 4: Temporal Diff (the "animated architecture")

**Goal:** Compare two snapshots. Show what changed visually.

| Task | Description | Status |
|------|-------------|--------|
| Load two graph.json files | File picker or URL params for base/head | planned |
| Diff computation | Added/removed nodes and edges between snapshots | planned |
| Animation | New edges glow in, removed edges fade out | planned |
| Community drift | Communities that split/merge highlighted with annotation | planned |
| Scrubber | Timeline control to step through commits | planned |

---

## Phase 5: Blast Radius Visualization

**Goal:** Click a symbol, see everything affected. Same data as knowing's `blast_radius` MCP tool, rendered visually.

| Task | Description | Status |
|------|-------------|--------|
| Click-to-blast | Click any node, BFS forward highlights all reachable | planned |
| Depth rings | Concentric rings showing hop distance (1, 2, 3) | planned |
| Cross-community highlighting | Blast radius crossing a community boundary shown in red | planned |
| Risk scoring | Color intensity by distance (close = hot, far = cool) | planned |
| Export as image | "Share blast radius" button for PR comments | planned |

---

## Phase 6: 3D Galaxy View

**Goal:** The hero visual. All communities as glowing clusters in 3D space, connected by arcs. For landing pages and presentations.

| Task | Description | Status |
|------|-------------|--------|
| Three.js force-directed 3D | Communities as sphere clusters in 3D space | planned |
| Glow effects | Cross-community edges as glowing arcs | planned |
| Camera controls | Orbit, zoom, auto-rotate | planned |
| Community proximity | Related communities (many cross-edges) physically closer | planned |
| Particle effects | Data flowing along edges (optional, for wow factor) | planned |
| Screenshot mode | High-res export for README/landing page | planned |

---

## Phase 7: Live Connection

**Goal:** Connect directly to knowing's MCP server for real-time data (no manual export step).

| Task | Description | Status |
|------|-------------|--------|
| WebSocket to knowing daemon | Stream graph updates in real-time | planned |
| Live community recomputation | Louvain re-runs when graph changes | planned |
| File save highlighting | "You just edited context.go" -> highlight affected community | planned |
| Feedback recording | Click "useful"/"not useful" on symbols, sends to feedback MCP tool | planned |

---

## Design Principles

1. **No backend.** Static site that reads JSON. Works from `file://` or any CDN.
2. **Progressive disclosure.** Overview first, detail on demand. Never show 1500 nodes at once.
3. **Community-first.** Everything is organized by community. The community IS the UI.
4. **Red = risk.** Cross-community edges, high blast radius, architectural drift all use red.
5. **Shareable.** Any view can be exported as PNG/SVG for PRs, docs, presentations.
6. **Data from knowing.** This repo never indexes code. It only visualizes what knowing exports.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| cytoscape | 2D interactive graph rendering (phases 2-5) |
| cytoscape-cose-bilkent | Compound node layout for community clusters |
| three | 3D galaxy view (phase 6) |
| vite | Build tool, dev server |

---

## Relationship to knowing

```
knowing (Go binary)                    knowing-viz (static site)
  |                                       |
  | knowing export -format json           | reads public/graph.json
  |-------------------------------------->|
  |                                       | renders with Cytoscape/Three.js
  | knowing export -format dot            | reads public/graph.dot (optional)
  |-------------------------------------->|
```

The two repos are independent. No shared code. knowing produces data; knowing-viz renders it.
