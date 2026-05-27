import React from 'react';
import SettingsScreen from './SettingsScreen';

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
    <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>{title}</div>
      <div className="uplabel">Coming soon</div>
    </div>
  </div>
);

export const DashboardScreen: React.FC = () => <Placeholder title="Your projects" />;
export const CrawlerScreen: React.FC = () => <Placeholder title="Crawl a wiki page" />;
export const EditorScreen: React.FC = () => <Placeholder title="Compose character" />;
export const LorebookScreen: React.FC = () => <Placeholder title="Author lorebook" />;
export const ProjectImageScreen: React.FC = () => <Placeholder title="Project image" />;
export const PortraitScreen: React.FC = () => <Placeholder title="Portrait" />;
export const PreviewScreen: React.FC = () => <Placeholder title="Preview character card" />;
export const ExportScreen: React.FC = () => <Placeholder title="Export hub" />;
export { SettingsScreen };
