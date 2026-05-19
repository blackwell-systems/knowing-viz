/**
 * Zustand store: central state for the knowing-viz application.
 *
 * All components read from this store; actions are the only way to mutate state.
 * Sigma instance is NOT stored here; @react-sigma/core provides its own
 * useSigma() hook via SigmaContainer context.
 *
 * Created by Scaffold Agent for Polywave react-migration.
 * Shared by agents: B (implementer), C, D, E (consumers).
 */

import { create } from 'zustand';
import type { KnowingGraph, GraphNode, GraphEdge } from './graph-data';
import Graph from 'graphology';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Available visualization modes. */
export type ViewMode =
  | 'communities'
  | 'blast-radius'
  | 'provenance'
  | 'blame'
  | 'coverage'
  | 'timeline'
  | 'galaxy3d';

/** Grouping strategies for graph layout. */
export type GroupBy = 'community' | 'package' | 'author';

/** User-adjustable display settings (slider values). */
export interface DisplaySettings {
  nodeScale: number;          // 0.5-3.0, default 1.0
  topLabelCount: number;      // 0-100, default 40
  edgeOpacity: number;        // 0-1, default 1.0
  labelSize: number;          // 6-20, default 11
  gravity: number;            // 0.1-5.0, default 1.0
  spread: number;             // 5-100, default 10
  maxNodes: number;           // 50-10000, default 10000
  confidenceMin: number;      // 0-1, default 0
  crossCommunityOnly: boolean; // default false
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface GraphState {
  // Data
  graph: KnowingGraph | null;
  graphFileName: string;
  sigmaGraph: Graph | null;

  // View state
  viewMode: ViewMode;
  groupBy: GroupBy;
  selectedNode: GraphNode | null;
  selectedEdges: GraphEdge[];
  activeCommunityIds: Set<number>;
  searchQuery: string;
  settings: DisplaySettings;

  // Overlay state (derived, used by GraphEvents)
  blameAuthorColors: Map<string, string>;

  // Group labels derived from current sigma graph
  groupLabels: { id: number; label: string; size: number }[];

  // Actions
  setGraph: (graph: KnowingGraph, fileName?: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setGroupBy: (groupBy: GroupBy) => void;
  selectNode: (node: GraphNode | null, edges?: GraphEdge[]) => void;
  toggleCommunity: (id: number) => void;
  clearCommunities: () => void;
  setSearchQuery: (query: string) => void;
  updateSettings: (partial: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
  setSigmaGraph: (g: Graph | null) => void;
  setGroupLabels: (labels: { id: number; label: string; size: number }[]) => void;
  setBlameAuthorColors: (colors: Map<string, string>) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: DisplaySettings = {
  nodeScale: 1.0,
  topLabelCount: 40,
  edgeOpacity: 1.0,
  labelSize: 11,
  gravity: 1.0,
  spread: 10,
  maxNodes: 10000,
  confidenceMin: 0,
  crossCommunityOnly: false,
};

// ---------------------------------------------------------------------------
// Store (stub implementations; Agent B will flesh these out)
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>()((set) => ({
  // Data
  graph: null,
  graphFileName: '',
  sigmaGraph: null,

  // View state
  viewMode: 'communities' as ViewMode,
  groupBy: 'community' as GroupBy,
  selectedNode: null,
  selectedEdges: [],
  activeCommunityIds: new Set<number>(),
  searchQuery: '',
  settings: { ...DEFAULT_SETTINGS },

  // Overlay state
  blameAuthorColors: new Map<string, string>(),

  // Group labels
  groupLabels: [],

  // Actions (stub implementations)
  setGraph: (graph, fileName) =>
    set({ graph, graphFileName: fileName ?? '' }),

  setViewMode: (mode) =>
    set({ viewMode: mode }),

  setGroupBy: (groupBy) =>
    set({ groupBy }),

  selectNode: (node, edges) =>
    set({ selectedNode: node, selectedEdges: edges ?? [] }),

  toggleCommunity: (id) =>
    set((state) => {
      const next = new Set(state.activeCommunityIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { activeCommunityIds: next };
    }),

  clearCommunities: () =>
    set({ activeCommunityIds: new Set<number>() }),

  setSearchQuery: (query) =>
    set({ searchQuery: query }),

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  resetSettings: () =>
    set({
      settings: { ...DEFAULT_SETTINGS },
      activeCommunityIds: new Set<number>(),
      searchQuery: '',
    }),

  setSigmaGraph: (g) =>
    set({ sigmaGraph: g }),

  setGroupLabels: (labels) =>
    set({ groupLabels: labels }),

  setBlameAuthorColors: (colors) =>
    set({ blameAuthorColors: colors }),
}));
