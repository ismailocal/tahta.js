import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Type, 
  Square, 
  Circle, 
  MousePointer2, 
  Trash2, 
  ChevronDown,
  Search,
  Hash,
  ArrowRight,
  Diamond,
  Minus,
  Image as ImageIcon
} from 'lucide-react';
import { useTahta } from '../hooks/useTahta';
import { calculateCenteredViewport } from '../../geometry/ViewportUtils';

export interface LayersPanelProps {
  /** Optional class name for the toggle button */
  toggleClassName?: string;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ toggleClassName }) => {
  const { api, state } = useTahta();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const shapes = state.shapes || [];
  const selectedIds = new Set(state.selectedIds || []);

  const filteredShapes = useMemo(() => {
    const list = [...shapes].reverse();
    if (!search.trim()) return list;
    
    const s = search.toLowerCase();
    return list.filter(el => {
      const typeMatch = (el.type as string)?.toLowerCase().includes(s);
      const textMatch = el.text?.toLowerCase().includes(s);
      return typeMatch || textMatch;
    });
  }, [shapes, search]);

  const handleSelect = (id: string, shape: any) => {
    api.setSelection([id]);
    
    // Zoom to shape logic
    // In a real app we'd need container dimensions. 
    // For now, we'll try to get them from the active canvas if possible, 
    // or just center with a default zoom jump.
    const canvas = document.querySelector('.whiteboard-canvas') as HTMLCanvasElement;
    if (canvas) {
      const newViewport = calculateCenteredViewport(
        [shape],
        canvas.clientWidth,
        canvas.clientHeight
      );
      api.setViewport(newViewport);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    api.deleteShape(id);
    api.commitState();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="w-3.5 h-3.5" />;
      case 'rectangle': return <Square className="w-3.5 h-3.5" />;
      case 'ellipse':
      case 'circle': return <Circle className="w-3.5 h-3.5" />;
      case 'diamond': return <Diamond className="w-3.5 h-3.5" />;
      case 'arrow': return <ArrowRight className="w-3.5 h-3.5" />;
      case 'line': return <Minus className="w-3.5 h-3.5" />;
      case 'image': return <ImageIcon className="w-3.5 h-3.5" />;
      case 'freedraw':
      case 'freehand': return <MousePointer2 className="w-3.5 h-3.5" />;
      default: return <Hash className="w-3.5 h-3.5" />;
    }
  };

  return (
    <>
      <div 
        className={`fixed right-6 top-6 bottom-24 w-[280px] bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[24px] shadow-2xl flex flex-col z-[900] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) origin-top-right ${!isOpen ? 'scale-50 opacity-0 pointer-events-none translate-x-4 -translate-y-4' : 'scale-100 opacity-100 translate-x-0 translate-y-0'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h3 className="text-[13px] font-bold text-slate-900 dark:text-white/90 tracking-tight">Layers</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40">
              {shapes.length}
            </span>
          </div>
          {/* Spacer for the integrated toggle button */}
          <div className="w-8 h-8" />
        </div>

        <div className="p-3">
          <div className="relative group/layersearch">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-white/20 group-focus-within/layersearch:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Filter objects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl pl-9 pr-3 py-2 text-[12px] text-slate-900 dark:text-white/90 placeholder:text-slate-400 dark:placeholder:text-white/10 focus:outline-none focus:bg-white dark:focus:bg-white/10 focus:border-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 custom-scrollbar">
          {filteredShapes.map((shape) => {
            const isSelected = selectedIds.has(shape.id);

            return (
              <div
                key={shape.id}
                onClick={() => handleSelect(shape.id, shape)}
                className={`group/layer-item relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/15'
                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-indigo-500 rounded-r-full" />
                )}
                <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/20">
                  {getIcon(shape.type as string)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate text-slate-700 dark:text-white/80">
                    {shape.text || ((shape.type as string).charAt(0).toUpperCase() + (shape.type as string).slice(1))}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-white/20 tracking-tight">
                    {shape.id.substring(0, 8)}
                  </p>
                </div>

                <div className="flex items-center opacity-0 group-hover/layer-item:opacity-100 transition-opacity pr-2">
                  <button 
                    onClick={(e) => handleDelete(e, shape.id)}
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 dark:text-white/20 transition-all rounded-lg"
                    title="Delete Object"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredShapes.length === 0 && shapes.length > 0 && (
            <div className="text-center py-8">
              <Layers className="w-8 h-8 text-slate-200 dark:text-white/5 mx-auto mb-2 opacity-50" />
              <p className="text-[11px] text-slate-400 dark:text-white/20 italic">No matching objects</p>
            </div>
          )}
        </div>
      </div>

      {/* Integrated Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-10 right-10 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-500 z-[901] ${
          isOpen 
            ? 'bg-transparent text-slate-400 dark:text-white/20 hover:bg-slate-100 dark:hover:bg-white/5' 
            : 'bg-white dark:bg-[#1a1a1a] shadow-xl border border-black/5 dark:border-white/10 text-slate-400 dark:text-white/40 hover:text-indigo-500 scale-125'
        } ${toggleClassName || ''}`}
        title={isOpen ? "Close Layers" : "Open Layers"}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
      </button>
    </>
  );
};
