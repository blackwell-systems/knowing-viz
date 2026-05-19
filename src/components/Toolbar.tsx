import { useGraphStore } from '../store';

export function Toolbar() {
  const resetSettings = useGraphStore((s) => s.resetSettings);

  return (
    <div className="toolbar">
      <button onClick={() => { /* TODO: screenshot via sigma ref */ }}>Screenshot</button>
      <button onClick={() => { /* TODO: fit via sigma camera */ }}>Fit</button>
      <button onClick={resetSettings}>Reset</button>
    </div>
  );
}
