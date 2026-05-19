import { useGraphStore } from '../store';
import { GROUPING_REGISTRY } from '../grouping';

export function GroupByToggle() {
  const groupBy = useGraphStore((s) => s.groupBy);
  const setGroupBy = useGraphStore((s) => s.setGroupBy);

  return (
    <div className="groupby-toggles">
      <h3>Group by</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0 16px 8px' }}>
        {GROUPING_REGISTRY.map((g) => (
          <button
            key={g.id}
            className={`groupby-btn ${groupBy === g.id ? 'active' : ''}`}
            onClick={() => setGroupBy(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
