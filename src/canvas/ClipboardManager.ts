import type { ICanvasAPI, ShapeType } from '../core/types';
import { screenToWorld } from '../geometry/Geometry';
import { UI_CONSTANTS } from '../core/constants';
import { createId } from '../core/Utils';

export function handleImageFile(api: ICanvasAPI, canvas: HTMLCanvasElement, file: File, clientX: number, clientY: number) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const imageSrc = e.target?.result as string;
    if (!imageSrc) return;
    
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const state = api.getState();
      const rect = canvas.getBoundingClientRect();
      const screen = { x: clientX - rect.left, y: clientY - rect.top };
      const world = screenToWorld(screen, state.viewport);
      
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const maxDim = UI_CONSTANTS.MAX_IMAGE_DIMENSION;
      if (w > maxDim || h > maxDim) {
         const ratio = Math.min(maxDim / w, maxDim / h);
         w *= ratio;
         h *= ratio;
      }

      const id = createId();
      api.addShape({
        id,
        type: 'image' as ShapeType,
        x: world.x - w / 2,
        y: world.y - h / 2,
        width: w,
        height: h,
        imageSrc
      });
      api.setSelection([id]);
      api.commitState();
    };
  };
  reader.readAsDataURL(file);
}

export function setupClipboard(api: ICanvasAPI, canvas: HTMLCanvasElement): (() => void)[] {
  const onCopy = (e: ClipboardEvent) => {
    const state = api.getState();
    if (state.selectedIds.length === 0) return;
    
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;

    const selectedShapes = state.shapes.filter(s => state.selectedIds.includes(s.id));
    const payload = JSON.stringify({ type: 'tuval/clipboard', shapes: selectedShapes });
    e.clipboardData?.setData('text/plain', payload);
    e.preventDefault();
  };

  const onPaste = (e: ClipboardEvent) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) return;

    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      handleImageFile(api, canvas, e.clipboardData.files[0], window.innerWidth / 2, window.innerHeight / 2);
      e.preventDefault();
      return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    
    try {
      const data = JSON.parse(text);
      if (data.type === 'tuval/clipboard' && Array.isArray(data.shapes)) {
        const newShapes = data.shapes;
        const oldToNewId = new Map<string, string>();
        const oldToNewGroupId = new Map<string, string>();
        
        newShapes.forEach((s: any) => {
           const newId = createId();
           oldToNewId.set(s.id, newId);
           s.id = newId;
           s.x += 20;
           s.y += 20;
           
           s.locked = false;
           
           if (s.groupId) {
             if (!oldToNewGroupId.has(s.groupId)) {
               oldToNewGroupId.set(s.groupId, createId());
             }
           }
        });

        newShapes.forEach((s: any) => {
           if (s.groupId) s.groupId = oldToNewGroupId.get(s.groupId);
           if (s.startBinding && oldToNewId.has(s.startBinding.elementId)) s.startBinding.elementId = oldToNewId.get(s.startBinding.elementId);
           else s.startBinding = undefined;
           
           if (s.endBinding && oldToNewId.has(s.endBinding.elementId)) s.endBinding.elementId = oldToNewId.get(s.endBinding.elementId);
           else s.endBinding = undefined;

           api.addShape(s);
        });
        
        api.setSelection(newShapes.map((s: any) => s.id));
        api.commitState();
        e.preventDefault();
      }
    } catch (err) {
      // Not a tuval json
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleImageFile(api, canvas, e.dataTransfer.files[0], e.clientX, e.clientY);
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  window.addEventListener('copy', onCopy);
  window.addEventListener('paste', onPaste);
  window.addEventListener('drop', onDrop);
  window.addEventListener('dragover', onDragOver);

  return [
    () => window.removeEventListener('copy', onCopy),
    () => window.removeEventListener('paste', onPaste),
    () => window.removeEventListener('drop', onDrop),
    () => window.removeEventListener('dragover', onDragOver),
  ];
}
