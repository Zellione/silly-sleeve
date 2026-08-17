import { useState, useEffect, useRef } from 'react';
import './style.css';
import {
  TopBar, StatusBar,
  type Route,
} from './components/Layout';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog';
import {
  DashboardScreen, CrawlerScreen, CharactersScreen, LorebookScreen,
  ImagesScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './screens';
import { GetSettings, NewProject } from '../wailsjs/go/app/App';
import { settings } from '../wailsjs/go/models';
import { logError } from './utils/log';

function AppShell() {
  const [route, setRoute] = useState<Route>('dashboard');
  const [settingsData, setSettingsData] = useState<settings.Settings | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const creatingProject = useRef(false);

  const handleOpenProject = (path: string, name?: string) => {
    setProjectPath(path);
    // Prefer the manifest name; fall back to the bundle's file name.
    setProjectName(name || (path.split(/[\\/]/).pop()?.replace(/\.slv$/, '') ?? ''));
    setRoute('characters');
  };

  const handleNewProject = async (name: string) => {
    if (creatingProject.current) return;
    creatingProject.current = true;
    try {
      await NewProject(name);
      setProjectPath('');
      setProjectName(name);
      setRoute('crawler');
    } catch (e) {
      logError('App.newProject', e);
    } finally {
      creatingProject.current = false;
    }
  };

  useEffect(() => {
    GetSettings().then(s => setSettingsData(s)).catch(e => {
      logError('App.loadSettings', e);
      setSettingsData(settings.Settings.createFrom({ endpoints: [] }));
    });
  }, []);

  useEffect(() => {
    GetSettings().then(s => setSettingsData(s)).catch(e => logError('App.reloadSettings', e));
  }, [route]);

  const routeLabels: Record<Route, string> = {
    dashboard: 'PROJECTS',
    crawler: 'CRAWL',
    characters: 'CHARACTERS',
    lorebook: 'LOREBOOK',
    images: 'IMAGES',
    preview: 'PREVIEW',
    export: 'EXPORT',
    settings: 'SETTINGS',
  };

  const defaultEp = settingsData?.endpoints.find(e => e.isDefault) ?? settingsData?.endpoints[0];
  // Flattened from a nested ternary (SonarCloud typescript:S3358).
  let llmStatus: 'ok' | 'warn' | 'bad' | 'idle' = 'idle';
  if (defaultEp?.ok) llmStatus = 'ok';
  const llmName = defaultEp?.name ?? '—';

  const renderScreen = () => {
    switch (route) {
      case 'crawler': return <CrawlerScreen projectPath={projectPath} />;
      case 'characters': return <CharactersScreen projectPath={projectPath} onProjectPathChange={setProjectPath} />;
      /* v8 ignore next */
      /* v8 ignore next */
      case 'lorebook': return <LorebookScreen projectPath={projectPath} />;
      case 'images': return <ImagesScreen projectPath={projectPath} />;
      case 'preview': return <PreviewScreen />;
      case 'export': return <ExportScreen />;
      case 'settings': return <SettingsScreen />;
      /* v8 ignore next */
      default: return <DashboardScreen onOpenProject={handleOpenProject} onNewProject={handleNewProject} />;
    }
  };

  // The projects screen is a full-screen pre-screen: no top bar, no status
  // bar. Everything else renders inside the tabbed shell.
  if (route === 'dashboard') {
    return <DashboardScreen onOpenProject={handleOpenProject} onNewProject={handleNewProject} />;
  }

  return (
    <div className="ss-app-v2">
      <TopBar current={route} onNav={setRoute} projectName={projectName || undefined} />
      <main className="ss-content">
        {renderScreen()}
      </main>
      <StatusBar routeLabel={routeLabels[route]} llmStatus={llmStatus} llmName={llmName} autoSaveMode={settingsData?.autoSaveMode} />
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
