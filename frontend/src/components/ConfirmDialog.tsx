import React, { createContext, useContext, useState, useCallback } from 'react';

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
    confirm: (message: string) => Promise.resolve(window.confirm(message)),
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

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="ss-confirm-backdrop" onClick={handleCancel}>
          <div className="ss-confirm-card" onClick={e => e.stopPropagation()}>
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
