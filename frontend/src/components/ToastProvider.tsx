import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckIcon, XIcon, BoltIcon, SaveIcon } from '../icons';

export type ToastKind = 'ok' | 'bad' | 'warn' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

const ToastIcon: React.FC<{ kind: ToastKind }> = ({ kind }) => {
  switch (kind) {
    case 'ok': return <CheckIcon size={14} />;
    case 'bad': return <XIcon size={14} />;
    case 'warn': return <BoltIcon size={14} />;
    case 'info': return <SaveIcon size={14} />;
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 4200);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  }, []);

  const ctx = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {toasts.length > 0 && (
        <div className="ss-toast-stack">
          {toasts.map(t => (
            <div key={t.id} className="ss-toast" data-kind={t.kind}>
              <div className="ss-toast-ic">
                <ToastIcon kind={t.kind} />
              </div>
              <div className="ss-toast-body">
                <b>{t.title}</b>
                {t.body && <span>{t.body}</span>}
              </div>
              <button className="ss-toast-x" onClick={() => dismiss(t.id)}>
                <XIcon size={12} />
              </button>
              <div className="ss-toast-progress" />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};
