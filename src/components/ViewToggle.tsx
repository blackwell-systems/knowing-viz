import { useGraphStore, type ViewMode } from '../store';

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'communities', label: 'Communities' },
  { key: 'blast-radius', label: 'Blast Radius' },
  { key: 'provenance', label: 'Provenance' },
  { key: 'blame', label: 'Blame' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'galaxy3d', label: 'Galaxy 3D' },
];

export function ViewToggle() {
  const viewMode = useGraphStore((s) => s.viewMode);
  const setViewMode = useGraphStore((s) => s.setViewMode);

  return (
    <div className="view-toggles">
      <h3>Views</h3>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          className={viewMode === v.key ? 'active' : ''}
          onClick={() => setViewMode(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
