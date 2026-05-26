import { useState } from 'react';
import './style.css';
import {
  TitleBar, Sidebar, StatusBar, ThemeToggle,
  type Route,
} from './components/Layout';
import {
  DashboardScreen, CrawlerScreen, EditorScreen, LorebookScreen,
  ProjectImageScreen, PortraitScreen, PreviewScreen, ExportScreen,
  SettingsScreen,
} from './screens';

function App() {
  const [route, setRoute] = useState<Route>('dashboard');

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
      <StatusBar routeLabel={routeLabels[route]} />

      {/* Floating theme toggle for now */}
      <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 50 }}>
        <ThemeToggle />
      </div>
    </div>
  );
}

export default App;
