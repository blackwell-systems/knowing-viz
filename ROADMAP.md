# Roadmap

## Current State

Sigma.js 2D + Three.js 3D + Vite + TypeScript. Graph data from `knowing export -format json`.

**Shipped views:**
- Community overview (Sigma.js, ForceAtlas2 layout, color-coded clusters)
- Blast radius (click to pin, BFS backward, depth-based coloring)
- Provenance overlay (edge colors by extraction method)
- Blame overlay (nodes colored by git author)
- Coverage heatmap (red = uncovered, green = covered)
- Timeline diff (compare two snapshots, glow added/removed)
- Galaxy 3D (Three.js force-directed)
- Cross-community edge toggle
- Community highlight filtering (select top N)
- Search (highlight matching nodes)
- Node detail panel (qualified name, kind, signature, community, edges)

**Data:** `public/graph.json` (2692 nodes, 11984 edges, 231 communities, blame + coverage metadata)

---

## Next Improvements

| Task | Effort | Impact |
|------|--------|--------|
| Symbol tooltip on hover | Low | Show signature, author, coverage without clicking |
| Export as image | Low | "Share this view" button, canvas screenshot for PRs/docs |
| Depth rings in blast radius | Medium | Concentric circles showing 1-hop, 2-hop, 3-hop |
| Edge bundling | Medium | Clean arcs between community clusters instead of spaghetti |
| Node shape by kind | Low | box=function, ellipse=type, hexagon=service |
| Breadcrumb navigation | Medium | "All > context > RankSymbols" with drill-in/back |
| Screenshot mode | Low | High-res export for README/landing page |

## Planned Features

### Interactive Navigation
| Task | Description | Status |
|------|-------------|--------|
| Level 1: Community overview | Communities as circles sized by member count. Click to drill in. | planned |
| Level 2: Community internals | Expand a community to show its symbols + internal edges | planned |
| Level 3: Symbol detail | Click a symbol to see callers, callees, signature, file, line | partial (detail panel exists) |
| Edge type filtering | Toggle calls/imports/references/implements visibility | planned |
| Breadcrumb navigation | "All > context > RankSymbols" with back navigation | planned |

### Temporal Diff
| Task | Description | Status |
|------|-------------|--------|
| Load two graph.json files | File picker or URL params for base/head | planned |
| Animation | New edges glow in, removed edges fade out | partial (diff view exists) |
| Community drift | Communities that split/merge highlighted with annotation | planned |
| Scrubber | Timeline control to step through commits | planned |

### Live Connection
| Task | Description | Status |
|------|-------------|--------|
| WebSocket to knowing daemon | Stream graph updates in real-time | planned |
| File save highlighting | "You just edited context.go" -> highlight affected community | planned |
| Feedback recording | Click "useful"/"not useful" on symbols, sends to feedback MCP tool | planned |

---

## Design Principles

1. **No backend.** Static site that reads JSON. Works from `file://` or any CDN.
2. **Progressive disclosure.** Overview first, detail on demand.
3. **Community-first.** Everything is organized by community.
4. **Red = risk.** Cross-community edges, uncovered code, high blast radius all use red.
5. **Shareable.** Any view should be exportable as PNG for PRs, docs, presentations.
6. **Data from knowing.** This repo never indexes code. It only visualizes what knowing exports.
