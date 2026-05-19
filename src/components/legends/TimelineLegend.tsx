import { useGraphStore } from '../../store';
import { loadGraphFromFile } from '../../graph-data';

export function TimelineLegend() {
  const baselineFileName = useGraphStore((s) => s.baselineFileName);
  const setBaselineGraph = useGraphStore((s) => s.setBaselineGraph);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const graph = await loadGraphFromFile(file);
      setBaselineGraph(graph, file.name);
    } catch (err) {
      console.error('Failed to load baseline graph:', err);
    }
  };

  return (
    <>
      <div className="detail-label">Timeline Diff</div>
      <div className="detail-value" style={{ marginBottom: 8 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#3fb950', marginRight: 6, verticalAlign: 'middle' }} />
        Added nodes/edges
      </div>
      <div className="detail-value" style={{ marginBottom: 12 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'rgba(48,54,61,0.3)', marginRight: 6, verticalAlign: 'middle' }} />
        Unchanged
      </div>
      <div className="detail-label">Baseline Snapshot</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
        {baselineFileName || 'No baseline loaded'}
      </div>
      <label className="file-picker-label" htmlFor="baseline-file" style={{ fontSize: '0.7rem' }}>
        Load baseline JSON
      </label>
      <input
        type="file"
        id="baseline-file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {baselineFileName && (
        <button
          onClick={() => setBaselineGraph(null)}
          style={{
            marginLeft: 6,
            fontSize: '0.65rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          Clear
        </button>
      )}
    </>
  );
}
