import { useMemo } from 'react';
import { PROVENANCE_COLORS } from '../../provenance';
import { useGraphStore } from '../../store';

export function ProvenanceLegend() {
  const graph = useGraphStore((s) => s.graph);
  const highlightedProvenance = useGraphStore((s) => s.highlightedProvenance);
  const setHighlightedProvenance = useGraphStore((s) => s.setHighlightedProvenance);

  const provCounts = useMemo(() => {
    if (!graph) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const e of graph.edges) {
      const p = e.provenance || 'unknown';
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    return counts;
  }, [graph]);

  const handleClick = (prov: string) => {
    setHighlightedProvenance(highlightedProvenance === prov ? null : prov);
  };

  return (
    <>
      <div className="detail-label">
        Edge Provenance <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(click to filter)</span>
      </div>
      {Object.entries(PROVENANCE_COLORS)
        .filter(([prov]) => prov !== 'default')
        .map(([prov, color]) => {
          const count = provCounts.get(prov) || 0;
          if (count === 0) return null;
          return (
            <div
              className="detail-value"
              key={prov}
              onClick={() => handleClick(prov)}
              style={{
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: 4,
                marginBottom: 2,
                background: highlightedProvenance === prov ? 'var(--bg-tertiary)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
                {prov.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
      {highlightedProvenance && (
        <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Showing only <strong style={{ color: 'var(--text-primary)' }}>{highlightedProvenance.replace(/_/g, ' ')}</strong> edges. Click again to clear.
        </div>
      )}
    </>
  );
}
