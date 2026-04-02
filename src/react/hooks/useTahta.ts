import { useContext } from 'react';
import { TahtaContext, type TahtaContextType } from '../context';

/**
 * Access the tahta.js engine instance and state within a React component.
 * Must be used within a <TahtaProvider />.
 * 
 * @returns {TahtaContextType} The API and current engine state.
 */
export const useTahta = (): TahtaContextType => {
  const context = useContext(TahtaContext);
  if (context === undefined) {
    throw new Error('useTahta must be used within a TahtaProvider');
  }
  return context;
};
