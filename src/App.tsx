import React, { useEffect, useRef, useState } from 'react';
import { mountCanvas } from './index';
import { TahtaProvider } from './react/context';
import { LayersPanel } from './react/components/LayersPanel';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tahtaApi, setTahtaApi] = useState<any>(null);

  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const { api, destroy } = mountCanvas(containerRef.current, canvasRef.current);
      setTahtaApi(api);
      
      return () => {
        destroy();
      };
    }
  }, []);

  return (
    <div className="app-shell" ref={containerRef}>
      <canvas 
        ref={canvasRef} 
        className="board-canvas"
        style={{ display: 'block', width: '100vw', height: '100vh' }}
      />
      {tahtaApi && (
        <TahtaProvider api={tahtaApi}>
          <LayersPanel />
        </TahtaProvider>
      )}
    </div>
  );
};

export default App;
