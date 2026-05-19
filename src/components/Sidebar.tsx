import { motion } from 'framer-motion';
import { FileLoader } from './FileLoader';
import { SearchBox } from './SearchBox';
import { ViewToggle } from './ViewToggle';
import { GroupByToggle } from './GroupByToggle';
import { CommunityList } from './CommunityList';
import { SettingsPanel } from './SettingsPanel';
import { Toolbar } from './Toolbar';

export function Sidebar() {
  return (
    <motion.aside
      className="sidebar"
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="sidebar-header">
        <h1>knowing</h1>
        <span className="subtitle">Graph Explorer</span>
      </div>
      <FileLoader />
      <SearchBox />
      <ViewToggle />
      <GroupByToggle />
      <CommunityList />
      <SettingsPanel />
      <Toolbar />
    </motion.aside>
  );
}
