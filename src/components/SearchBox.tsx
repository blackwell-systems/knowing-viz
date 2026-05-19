import { useGraphStore } from '../store';

export function SearchBox() {
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);

  return (
    <div className="search-box">
      <input
        type="text"
        className="search-input"
        placeholder="Search symbols, files, types..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
}
