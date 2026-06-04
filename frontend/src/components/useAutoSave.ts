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
  const timerRef = useRef<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  const pathRef = useRef(projectPath);

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    pathRef.current = projectPath;
  });

  useEffect(() => {
    GetSettings().then(s => {
      setAutoSaveMode(s?.autoSaveMode || 'off');
      setAutoSaveInterval(s?.autoSaveInterval || 30);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled || autoSaveMode !== 'timed') return;

    const interval = autoSaveInterval * 1000;
    timerRef.current = setInterval(() => {
      const p = pathRef.current;
      if (p) {
        onSaveRef.current(p);
      } else {
        console.warn('Auto-save (timed): skipped — no project path set. Save or open a project first.');
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, autoSaveMode, autoSaveInterval]);

  const handleChange = useCallback(() => {
    if (autoSaveMode !== 'onChange') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const p = pathRef.current;
      if (p) {
        onSaveRef.current(p);
      } else {
        console.warn('Auto-save (onChange): skipped — no project path set. Save or open a project first.');
      }
    }, 2000);
  }, [autoSaveMode]);

  const handleBlur = useCallback(() => {
    if (autoSaveMode !== 'onBlur') return;
    const p = pathRef.current;
    if (p) {
      onSaveRef.current(p);
    } else {
      console.warn('Auto-save (onBlur): skipped — no project path set. Save or open a project first.');
    }
  }, [autoSaveMode]);

  return { handleChange, handleBlur, autoSaveMode, autoSaveInterval };
}
