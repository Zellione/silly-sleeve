import { useCallback, useEffect, useRef } from 'react';
import { SaveProjectBundle } from '../../wailsjs/go/app/App';
import { useToast } from './ToastProvider';

/**
 * Debounced project-bundle writer shared by every screen that mutates project
 * data.
 *
 * Most backend mutations (SaveLorebook, SavePortrait, SaveProjectImage) only
 * update in-memory state; the bundle write is what actually puts the change on
 * disk. A failure therefore means the user's work exists only until the app
 * closes, so it is reported as a toast rather than logged — a console message
 * leaves them believing the change was saved.
 *
 * @param projectPath Bundle path; when empty, saving is skipped (no project open).
 * @param delay Debounce window in ms. Tests pass 0 to avoid fake timers.
 * @param label Screen-specific noun used in the failure toast, e.g. 'Portrait'.
 */
export function useBundleSave(projectPath: string, delay: number, label: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Screens fully unmount on tab switch; without this the pending timer would
  // fire against an unmounted component.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useCallback(() => {
    if (!projectPath) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      SaveProjectBundle(projectPath).catch(e => {
        toast({
          kind: 'bad',
          title: 'Project not saved',
          body: `${label} was updated but the project file could not be written: ${String(e)}`,
        });
      });
    }, delay);
  }, [projectPath, delay, label, toast]);
}
