import React from 'react';
import CrawlerScreen from './CrawlerScreen';
import SettingsScreen from './SettingsScreen';
import ExportScreen from './ExportScreen';
import PortraitScreen from './PortraitScreen';
import ProjectImageScreen from './ProjectImageScreen';

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
    <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>{title}</div>
      <div className="uplabel">Coming soon</div>
    </div>
  </div>
);

export { default as DashboardScreen } from './DashboardScreen';
export { CrawlerScreen };
export { default as EditorScreen } from './EditorScreen';
export { default as LorebookScreen } from './LorebookScreen';
export { ProjectImageScreen };
export { PortraitScreen };
export const PreviewScreen: React.FC = () => <Placeholder title="Preview character card" />;
export { ExportScreen };
export { SettingsScreen };
