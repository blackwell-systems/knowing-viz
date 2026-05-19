import { useGraphStore } from '../store';
import { loadGraphFromFile } from '../graph-data';

export function FileLoader() {
  const setGraph = useGraphStore((s) => s.setGraph);
  const graphFileName = useGraphStore((s) => s.graphFileName);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const graph = await loadGraphFromFile(file);
      setGraph(graph, file.name);
    } catch (err) {
      console.error('Failed to load graph:', err);
    }
  };

  return (
    <div className="graph-source">
      <label className="file-picker-label" htmlFor="graph-file">Load graph JSON</label>
      <input type="file" id="graph-file" accept=".json" onChange={handleFileChange} />
      <div className="current-graph-name subtitle">{graphFileName}</div>
    </div>
  );
}
