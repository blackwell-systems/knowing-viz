import { useGraphStore } from '../store';
import { communityColor } from '../constants';

export function CommunityList() {
  const groupLabels = useGraphStore((s) => s.groupLabels);
  const activeCommunityIds = useGraphStore((s) => s.activeCommunityIds);
  const toggleCommunity = useGraphStore((s) => s.toggleCommunity);
  const groupBy = useGraphStore((s) => s.groupBy);

  const headings: Record<string, string> = {
    package: 'Packages',
    community: 'Communities',
    author: 'Authors',
  };

  return (
    <div className="community-list">
      <h3>{headings[groupBy] ?? 'Groups'}</h3>
      <div>
        {groupLabels.map((g) => (
          <div
            key={g.id}
            className={`community-item ${activeCommunityIds.has(g.id) ? 'active' : ''}`}
            onClick={() => toggleCommunity(g.id)}
          >
            <span className="community-dot" style={{ background: communityColor(g.id) }} />
            <span className="community-label">{g.label}</span>
            <span className="community-count">{g.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
