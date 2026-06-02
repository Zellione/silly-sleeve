import React, { useCallback } from 'react';
import CrawlerScreen from './CrawlerScreen';
import SettingsScreen from './SettingsScreen';
import ExportScreen from './ExportScreen';
import { PageHead } from '../components/Layout';
import { useToast } from '../components/ToastProvider';
import {
  SaveIcon, FolderIcon, ArrowIcon,
} from '../icons';
import { PickSaveBundle, SaveProjectBundle, PickOpenBundle, OpenProjectBundle } from '../../wailsjs/go/main/App';

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
    <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>{title}</div>
      <div className="uplabel">Coming soon</div>
    </div>
  </div>
);

const DashboardScreen: React.FC = () => {
  const { toast } = useToast();

  const handleSaveProject = useCallback(async () => {
    try {
      const filePath = await PickSaveBundle();
      if (!filePath) return;
      await SaveProjectBundle(filePath);
      toast({ kind: 'ok', title: 'Project saved', body: `Written to ${filePath}.` });
    } catch (e: any) {
      if (e?.message) {
        toast({ kind: 'bad', title: 'Save failed', body: e.message });
      }
    }
  }, [toast]);

  const handleOpenProject = useCallback(async () => {
    try {
      const filePath = await PickOpenBundle();
      if (!filePath) return;
      const manifest = await OpenProjectBundle(filePath);
      toast({ kind: 'ok', title: 'Project opened', body: `Loaded "${manifest.name}".` });
    } catch (e: any) {
      if (e?.message && e.message !== 'Cancelled') {
        toast({ kind: 'bad', title: 'Open failed', body: e.message });
      }
    }
  }, [toast]);

  return (
    <>
      <PageHead
        subtitle="Manage your character projects"
        title={<>Your <em style={{ fontStyle: 'normal', color: 'var(--acc)' }}>projects</em></>}
        actions={
          <>
            <button className="btn ghost" onClick={handleOpenProject}>
              <FolderIcon size={14} /> Open project
            </button>
            <button className="btn ghost" onClick={handleSaveProject}>
              <SaveIcon size={14} /> Save project
            </button>
            <button className="btn primary" disabled title="Coming in Phase 2">
              New project <ArrowIcon size={14} />
            </button>
          </>
        } />
      <div className="ss-page-body scroll" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="col" style={{ alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div className="serif-i" style={{ fontSize: 28, color: 'var(--ink-2)' }}>Your projects</div>
          <div className="uplabel">Save or open a project to get started</div>
        </div>
      </div>
    </>
  );
};

export { DashboardScreen };
export { CrawlerScreen };
export { default as EditorScreen } from './EditorScreen';
export const LorebookScreen: React.FC = () => <Placeholder title="Author lorebook" />;
export const ProjectImageScreen: React.FC = () => <Placeholder title="Project image" />;
export const PortraitScreen: React.FC = () => <Placeholder title="Portrait" />;
export const PreviewScreen: React.FC = () => <Placeholder title="Preview character card" />;
export { ExportScreen };
export { SettingsScreen };
