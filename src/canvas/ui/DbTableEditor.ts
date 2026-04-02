import type { ICanvasAPI } from '../../core/types';
import type { DbTableData, DbColumn } from '../../plugins/DbTablePlugin';
import type { DbViewData } from '../../plugins/DbViewPlugin';
import type { DbEnumData } from '../../plugins/DbEnumPlugin';

let activeEditor: HTMLElement | null = null;

export function openDbTableEditor(shapeId: string, api: ICanvasAPI, _canvas: HTMLCanvasElement) {
  closeDbTableEditor();

  const state = api.getState();
  const shape = state.shapes.find(s => s.id === shapeId);
  if (!shape) return;

  if (shape.type === 'db-table') openTableEditor(shapeId, shape.data as unknown as DbTableData, api);
  else if (shape.type === 'db-view') openViewEditor(shapeId, shape.data as unknown as DbViewData, api);
  else if (shape.type === 'db-enum') openEnumEditor(shapeId, shape.data as unknown as DbEnumData, api);
}

// ─── shared helpers ────────────────────────────────────────────────────────

function makeOverlay(): { overlay: HTMLDivElement; dialog: HTMLDivElement } {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;z-index:9999;
    font-family:"Inter",system-ui,sans-serif;`;
  const dialog = document.createElement('div');
  dialog.style.cssText = `background:#1e1e2e;border:1px solid #3d3d5c;border-radius:10px;
    padding:20px;width:420px;max-height:80vh;overflow-y:auto;color:#e2e8f0;
    box-shadow:0 20px 60px rgba(0,0,0,0.6);`;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  activeEditor = overlay;
  return { overlay, dialog };
}

function attachClose(overlay: HTMLDivElement, close: () => void) {
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
}

const inputStyle = `width:100%;box-sizing:border-box;background:#2d2d4e;border:1px solid #4b4b6b;
  border-radius:6px;padding:7px 10px;color:#f1f5f9;font-size:13px;outline:none;`;
const labelStyle = `display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;`;
const sectionStyle = `margin-bottom:14px;`;

// ─── Table editor ──────────────────────────────────────────────────────────

function openTableEditor(shapeId: string, rawData: DbTableData | undefined, api: ICanvasAPI) {
  const data = rawData || { tableName: 'Table', columns: [] };
  const columns: DbColumn[] = data.columns.map(c => ({ ...c }));
  let tableName = data.tableName;

  const { overlay, dialog } = makeOverlay();

  function render() {
    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:15px;color:#f1f5f9;">Tabloyu Düzenle</h3>
        <button id="dbe-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 4px;">✕</button>
      </div>
      <div style="${sectionStyle}"><label style="${labelStyle}">Tablo Adı</label>
        <input id="dbe-name" value="${tableName}" style="${inputStyle}" /></div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Sütunlar</div>
      <div id="dbe-cols">
        ${columns.map((col, i) => `
          <div style="display:grid;grid-template-columns:1fr 90px 28px 28px 28px;gap:6px;align-items:center;margin-bottom:6px;">
            <input class="dbe-col-name" data-i="${i}" value="${col.name}" placeholder="ad"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;padding:5px 8px;color:#f1f5f9;font-size:12px;outline:none;" />
            <input class="dbe-col-type" data-i="${i}" value="${col.type}" placeholder="INT"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;padding:5px 8px;color:#f1f5f9;font-size:12px;outline:none;" />
            <button class="dbe-pk" data-i="${i}" title="Primary Key"
              style="background:${col.pk ? '#92400e' : '#2d2d4e'};border:1px solid #4b4b6b;border-radius:5px;color:${col.pk ? '#fbbf24' : '#64748b'};font-size:10px;font-weight:bold;cursor:pointer;padding:0;height:28px;">PK</button>
            <button class="dbe-fk" data-i="${i}" title="Foreign Key"
              style="background:${col.fk ? '#4c1d95' : '#2d2d4e'};border:1px solid #4b4b6b;border-radius:5px;color:${col.fk ? '#a78bfa' : '#64748b'};font-size:10px;font-weight:bold;cursor:pointer;padding:0;height:28px;">FK</button>
            <button class="dbe-del" data-i="${i}"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;color:#ef4444;font-size:14px;cursor:pointer;padding:0;height:28px;">×</button>
          </div>`).join('')}
      </div>
      <button id="dbe-add" style="width:100%;background:#2d2d4e;border:1px dashed #4b4b6b;border-radius:6px;padding:7px;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:4px;margin-bottom:16px;">+ Sütun Ekle</button>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="dbe-cancel" style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:6px;padding:7px 16px;color:#94a3b8;font-size:13px;cursor:pointer;">İptal</button>
        <button id="dbe-save" style="background:#3b82f6;border:none;border-radius:6px;padding:7px 16px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Kaydet</button>
      </div>`;

    (dialog.querySelector('#dbe-close') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-cancel') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-name') as HTMLInputElement).oninput = e => { tableName = (e.target as HTMLInputElement).value; };
    dialog.querySelectorAll<HTMLInputElement>('.dbe-col-name').forEach(el => { el.oninput = () => { columns[+el.dataset.i!].name = el.value; }; });
    dialog.querySelectorAll<HTMLInputElement>('.dbe-col-type').forEach(el => { el.oninput = () => { columns[+el.dataset.i!].type = el.value; }; });
    dialog.querySelectorAll<HTMLButtonElement>('.dbe-pk').forEach(btn => { btn.onclick = () => { const i = +btn.dataset.i!; columns[i].pk = !columns[i].pk; if (columns[i].pk) columns[i].fk = false; render(); }; });
    dialog.querySelectorAll<HTMLButtonElement>('.dbe-fk').forEach(btn => { btn.onclick = () => { const i = +btn.dataset.i!; columns[i].fk = !columns[i].fk; if (columns[i].fk) columns[i].pk = false; render(); }; });
    dialog.querySelectorAll<HTMLButtonElement>('.dbe-del').forEach(btn => { btn.onclick = () => { columns.splice(+btn.dataset.i!, 1); render(); }; });
    (dialog.querySelector('#dbe-add') as HTMLElement).onclick = () => { columns.push({ name: '', type: 'VARCHAR' }); render(); setTimeout(() => { const els = dialog.querySelectorAll<HTMLInputElement>('.dbe-col-name'); els[els.length - 1]?.focus(); }, 0); };
    (dialog.querySelector('#dbe-save') as HTMLElement).onclick = () => { api.updateShape(shapeId, { data: { tableName, columns } as unknown as Record<string, unknown> }); api.commitState(); close(); };
  }

  function close() { overlay.remove(); activeEditor = null; }
  attachClose(overlay, close);
  render();
  setTimeout(() => (dialog.querySelector('#dbe-name') as HTMLInputElement)?.focus(), 50);
}

// ─── View editor ──────────────────────────────────────────────────────────

function openViewEditor(shapeId: string, rawData: DbViewData | undefined, api: ICanvasAPI) {
  const data = rawData || { viewName: 'View', columns: [] };
  const columns: { name: string; type: string }[] = data.columns.map(c => ({ ...c }));
  let viewName = data.viewName;

  const { overlay, dialog } = makeOverlay();

  function render() {
    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:15px;color:#f1f5f9;">View Düzenle</h3>
        <button id="dbe-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 4px;">✕</button>
      </div>
      <div style="${sectionStyle}"><label style="${labelStyle}">View Adı</label>
        <input id="dbe-name" value="${viewName}" style="${inputStyle}" /></div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Sütunlar</div>
      <div id="dbe-cols">
        ${columns.map((col, i) => `
          <div style="display:grid;grid-template-columns:1fr 90px 28px;gap:6px;align-items:center;margin-bottom:6px;">
            <input class="dbe-col-name" data-i="${i}" value="${col.name}" placeholder="ad"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;padding:5px 8px;color:#f1f5f9;font-size:12px;outline:none;" />
            <input class="dbe-col-type" data-i="${i}" value="${col.type}" placeholder="VARCHAR"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;padding:5px 8px;color:#f1f5f9;font-size:12px;outline:none;" />
            <button class="dbe-del" data-i="${i}"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;color:#ef4444;font-size:14px;cursor:pointer;padding:0;height:28px;">×</button>
          </div>`).join('')}
      </div>
      <button id="dbe-add" style="width:100%;background:#2d2d4e;border:1px dashed #4b4b6b;border-radius:6px;padding:7px;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:4px;margin-bottom:16px;">+ Sütun Ekle</button>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="dbe-cancel" style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:6px;padding:7px 16px;color:#94a3b8;font-size:13px;cursor:pointer;">İptal</button>
        <button id="dbe-save" style="background:#3b82f6;border:none;border-radius:6px;padding:7px 16px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Kaydet</button>
      </div>`;

    (dialog.querySelector('#dbe-close') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-cancel') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-name') as HTMLInputElement).oninput = e => { viewName = (e.target as HTMLInputElement).value; };
    dialog.querySelectorAll<HTMLInputElement>('.dbe-col-name').forEach(el => { el.oninput = () => { columns[+el.dataset.i!].name = el.value; }; });
    dialog.querySelectorAll<HTMLInputElement>('.dbe-col-type').forEach(el => { el.oninput = () => { columns[+el.dataset.i!].type = el.value; }; });
    dialog.querySelectorAll<HTMLButtonElement>('.dbe-del').forEach(btn => { btn.onclick = () => { columns.splice(+btn.dataset.i!, 1); render(); }; });
    (dialog.querySelector('#dbe-add') as HTMLElement).onclick = () => { columns.push({ name: '', type: 'VARCHAR' }); render(); setTimeout(() => { const els = dialog.querySelectorAll<HTMLInputElement>('.dbe-col-name'); els[els.length - 1]?.focus(); }, 0); };
    (dialog.querySelector('#dbe-save') as HTMLElement).onclick = () => { api.updateShape(shapeId, { data: { viewName, columns } as unknown as Record<string, unknown> }); api.commitState(); close(); };
  }

  function close() { overlay.remove(); activeEditor = null; }
  attachClose(overlay, close);
  render();
  setTimeout(() => (dialog.querySelector('#dbe-name') as HTMLInputElement)?.focus(), 50);
}

// ─── Enum editor ──────────────────────────────────────────────────────────

function openEnumEditor(shapeId: string, rawData: DbEnumData | undefined, api: ICanvasAPI) {
  const data = rawData || { enumName: 'Enum', values: [] };
  const values: string[] = [...data.values];
  let enumName = data.enumName;

  const { overlay, dialog } = makeOverlay();

  function render() {
    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:15px;color:#f1f5f9;">Enum Düzenle</h3>
        <button id="dbe-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:0 4px;">✕</button>
      </div>
      <div style="${sectionStyle}"><label style="${labelStyle}">Enum Adı</label>
        <input id="dbe-name" value="${enumName}" style="${inputStyle}" /></div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Değerler</div>
      <div id="dbe-vals">
        ${values.map((val, i) => `
          <div style="display:grid;grid-template-columns:1fr 28px;gap:6px;align-items:center;margin-bottom:6px;">
            <input class="dbe-val" data-i="${i}" value="${val}" placeholder="DEĞER"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;padding:5px 8px;color:#f1f5f9;font-size:12px;outline:none;" />
            <button class="dbe-del" data-i="${i}"
              style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:5px;color:#ef4444;font-size:14px;cursor:pointer;padding:0;height:28px;">×</button>
          </div>`).join('')}
      </div>
      <button id="dbe-add" style="width:100%;background:#2d2d4e;border:1px dashed #4b4b6b;border-radius:6px;padding:7px;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:4px;margin-bottom:16px;">+ Değer Ekle</button>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="dbe-cancel" style="background:#2d2d4e;border:1px solid #4b4b6b;border-radius:6px;padding:7px 16px;color:#94a3b8;font-size:13px;cursor:pointer;">İptal</button>
        <button id="dbe-save" style="background:#3b82f6;border:none;border-radius:6px;padding:7px 16px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Kaydet</button>
      </div>`;

    (dialog.querySelector('#dbe-close') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-cancel') as HTMLElement).onclick = close;
    (dialog.querySelector('#dbe-name') as HTMLInputElement).oninput = e => { enumName = (e.target as HTMLInputElement).value; };
    dialog.querySelectorAll<HTMLInputElement>('.dbe-val').forEach(el => { el.oninput = () => { values[+el.dataset.i!] = el.value; }; });
    dialog.querySelectorAll<HTMLButtonElement>('.dbe-del').forEach(btn => { btn.onclick = () => { values.splice(+btn.dataset.i!, 1); render(); }; });
    (dialog.querySelector('#dbe-add') as HTMLElement).onclick = () => { values.push(''); render(); setTimeout(() => { const els = dialog.querySelectorAll<HTMLInputElement>('.dbe-val'); els[els.length - 1]?.focus(); }, 0); };
    (dialog.querySelector('#dbe-save') as HTMLElement).onclick = () => { api.updateShape(shapeId, { data: { enumName, values } as unknown as Record<string, unknown> }); api.commitState(); close(); };
  }

  function close() { overlay.remove(); activeEditor = null; }
  attachClose(overlay, close);
  render();
  setTimeout(() => (dialog.querySelector('#dbe-name') as HTMLInputElement)?.focus(), 50);
}

export function closeDbTableEditor() {
  activeEditor?.remove();
  activeEditor = null;
}
