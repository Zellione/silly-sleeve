import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (message: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirmDialog = (): ConfirmContextValue => {
  const ctx = useContext(ConfirmContext);
  if (ctx) return ctx;
  return {
    confirm: (message: string) => Promise.resolve(globalThis.confirm(message)),
  };
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setPending({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    pending?.resolve(true);
    setPending(null);
  }, [pending]);

  const handleCancel = useCallback(() => {
    pending?.resolve(false);
    setPending(null);
  }, [pending]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }, [handleCancel]);

  const confirmValue = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={confirmValue}>
      {children}
      {pending && (
        <div
          className="ss-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={handleBackdropClick}
          onKeyDown={e => { if (e.key === 'Escape') handleCancel(); }}
        >
          <div className="ss-confirm-card">
            <p>{pending.message}</p>
            <div className="ss-confirm-actions">
              <button className="btn ghost sm" onClick={handleCancel}>Cancel</button>
              <button className="btn primary sm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
