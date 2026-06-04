import { useState, useEffect } from 'react';
import './style.css';
import {
  TitleBar, Sidebar, StatusBar, ThemeToggle,
  type Route,
} from './components/Layout';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './screens';
import { GetSettings } from '../wailsjs/go/main/App';
import { settings } from '../wailsjs/go/models';

function AppShell() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [settingsData, setSettingsData] = useState<settings.Settings | null>(null);

  useEffect(() => {
    GetSettings().then(s => setSettingsData(s)).catch(() => setSettingsData(settings.Settings.createFrom({ endpoints: [] })));
  }, []);

  const routeLabels: Record<Route, string> = {
    dashboard: 'PROJECTS',
    crawler: 'CRAWL · STEP 01',
    editor: 'COMPOSE · STEP 02',
    lorebook: 'LOREBOOK · STEP 03',
    projectImage: 'PROJECT IMAGE · STEP 04',
    image: 'PORTRAIT · STEP 05',
    preview: 'PREVIEW · STEP 06',
    export: 'EXPORT · STEP 07',
    settings: 'SETTINGS',
  };

  const defaultEp = settingsData?.endpoints.find(e => e.isDefault) ?? settingsData?.endpoints[0];
  const llmStatus: 'ok' | 'warn' | 'bad' | 'idle' = defaultEp ? (defaultEp.ok ? 'ok' : 'idle') : 'idle';
  const llmName = defaultEp?.name ?? '—';

  const renderScreen = () => {
    switch (route) {
      case 'dashboard': return <DashboardScreen />;
      case 'crawler': return <CrawlerScreen />;
      case 'editor': return <EditorScreen />;
      case 'lorebook': return <LorebookScreen />;
      case 'projectImage': return <ProjectImageScreen />;
      case 'image': return <PortraitScreen />;
      case 'preview': return <PreviewScreen />;
      case 'export': return <ExportScreen />;
      case 'settings': return <SettingsScreen />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <div className="ss-app">
      <TitleBar />
      <div className="ss-main">
        <Sidebar current={route} onNav={setRoute} />
        <main className="ss-content">
          {renderScreen()}
        </main>
      </div>
      <StatusBar routeLabel={routeLabels[route]} llmStatus={llmStatus} llmName={llmName} />

      {/* Floating theme toggle for now */}
      <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 50 }}>
        <ThemeToggle />
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShell />
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
