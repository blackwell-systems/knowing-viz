import { useGraphStore, type GroupBy } from '../store';

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: 'package', label: 'Package' },
  { key: 'community', label: 'Louvain' },
  { key: 'author', label: 'Author' },
];

export function GroupByToggle() {
  const groupBy = useGraphStore((s) => s.groupBy);
  const setGroupBy = useGraphStore((s) => s.setGroupBy);

  return (
    <div className="groupby-toggles">
      <h3>Group by</h3>
      <div style={{ display: 'flex', gap: '4px', padding: '0 16px 8px' }}>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            className={`groupby-btn ${groupBy === g.key ? 'active' : ''}`}
            onClick={() => setGroupBy(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
