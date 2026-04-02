import React, { createContext, useMemo, useState, useEffect } from 'react';
import type { ICanvasAPI, CanvasState } from '../core/types';

export interface TahtaContextType {
  api: ICanvasAPI;
  state: CanvasState;
}

export const TahtaContext = createContext<TahtaContextType | undefined>(undefined);

export interface TahtaProviderProps {
  api: ICanvasAPI;
  children: React.ReactNode;
}

export const TahtaProvider: React.FC<TahtaProviderProps> = ({ api, children }) => {
  const [state, setState] = useState<CanvasState>(api.getState());

  useEffect(() => {
    // Subscribe to store changes to keep React state in sync
    const unsubscribe = api.bus.on('document:changed', () => {
      setState(api.getState());
    });
    
    // Initial sync
    setState(api.getState());

    return () => {
      unsubscribe();
    };
  }, [api]);

  const value = useMemo(() => ({
    api,
    state
  }), [api, state]);

  return (
    <TahtaContext.Provider value={value}>
      {children}
    </TahtaContext.Provider>
  );
};
