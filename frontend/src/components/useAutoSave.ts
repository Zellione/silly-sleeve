import { useEffect, useRef, useCallback } from 'react';
import { GetSettings } from '../../wailsjs/go/main/App';
import { settings } from '../../wailsjs/go/models';

interface UseAutoSaveOptions {
  projectPath: string;
  onSave: (path: string) => Promise<void>;
  enabled?: boolean;
}

export function useAutoSave({ projectPath, onSave, enabled = true }: UseAutoSaveOptions) {
  const settingsRef = useRef<settings.Settings | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const pathRef = useRef(projectPath);
  const initedRef = useRef(false);

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    pathRef.current = projectPath;
  });

  useEffect(() => {
    GetSettings().then(s => {
      settingsRef.current = s;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled || initedRef.current) return;

    const s = settingsRef.current;
    if (!s || !s.autoSaveMode || s.autoSaveMode === 'off' || s.autoSaveMode !== 'timed') return;

    const interval = (s.autoSaveInterval || 30) * 1000;
    timerRef.current = setInterval(() => {
      const p = pathRef.current;
      if (p) onSaveRef.current(p);
    }, interval);

    initedRef.current = true;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  const handleChange = useCallback(() => {
    const s = settingsRef.current;
    if (!s || !s.autoSaveMode || s.autoSaveMode !== 'onChange') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const p = pathRef.current;
      if (p) onSaveRef.current(p);
    }, 2000);
  }, []);

  const handleBlur = useCallback(() => {
    const s = settingsRef.current;
    if (!s || !s.autoSaveMode || s.autoSaveMode !== 'onBlur') return;
    const p = pathRef.current;
    if (p) onSaveRef.current(p);
  }, []);

  return { handleChange, handleBlur };
}
