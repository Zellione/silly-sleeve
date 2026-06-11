import { useEffect, useRef, useCallback, useState } from 'react';
import { GetSettings } from '../../wailsjs/go/main/App';

interface UseAutoSaveOptions {
  projectPath: string;
  onSave: (path: string) => Promise<void>;
  enabled?: boolean;
}

export function useAutoSave({ projectPath, onSave, enabled = true }: UseAutoSaveOptions) {
  const [autoSaveMode, setAutoSaveMode] = useState<string>('off');
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const pathRef = useRef(projectPath);
  const mountedRef = useRef(true);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    pathRef.current = projectPath;
  }, [projectPath]);

  // Clear any pending timers and stop saves once the component unmounts, so a
  // debounced save can't fire against a stale path or after teardown.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    };
  }, []);

  // runSave invokes the latest onSave for the current path, surfacing failures
  // instead of silently dropping them.
  const runSave = useCallback((mode: string) => {
    if (!mountedRef.current) return;
    const p = pathRef.current;
    if (!p) {
      console.warn(`Auto-save (${mode}): skipped — no project path set. Save or open a project first.`);
      return;
    }
    Promise.resolve(onSaveRef.current(p)).catch(err => {
      console.error(`Auto-save (${mode}) failed:`, err);
    });
  }, []);

  useEffect(() => {
    GetSettings().then(s => {
      setAutoSaveMode(s?.autoSaveMode || 'off');
      setAutoSaveInterval(s?.autoSaveInterval || 30);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!enabled || autoSaveMode !== 'timed') return;

    const interval = autoSaveInterval * 1000;
    intervalRef.current = setInterval(() => runSave('timed'), interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, autoSaveMode, autoSaveInterval, runSave]);

  const handleChange = useCallback(() => {
    if (autoSaveMode !== 'onChange') return;
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => runSave('onChange'), 2000);
  }, [autoSaveMode, runSave]);

  const handleBlur = useCallback(() => {
    if (autoSaveMode !== 'onBlur') return;
    runSave('onBlur');
  }, [autoSaveMode, runSave]);

  return { handleChange, handleBlur, autoSaveMode, autoSaveInterval };
}
