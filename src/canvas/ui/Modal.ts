/** Instance-owned modal used by the existing canvas UI. */

const activeModals = new WeakMap<HTMLElement, () => void>();

interface ModalOptions {
  owner: HTMLElement;
  title: string;
  content: HTMLElement;
  onConfirm?: () => void | boolean;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
}

function button(className: string, label: string, style: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.className = className;
  element.style.cssText = style;
  element.textContent = label;
  return element;
}

function openModal(options: ModalOptions): HTMLDivElement {
  closeModal(options.owner);
  const lifecycle = new AbortController();
  let focusFrame: number | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'tahta-shell';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;z-index:999999;
    font-family:"Outfit",system-ui,sans-serif;`;

  const dialog = document.createElement('div');
  dialog.className = 'tahta-modal';
  dialog.style.cssText = `background:var(--dialog-bg);border:1px solid var(--dialog-border);border-radius:12px;
    padding:20px;width:${options.width ?? '380px'};max-height:80vh;overflow-y:auto;color:var(--dialog-text);
    box-shadow:var(--dialog-shadow);`;

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;';
  const heading = document.createElement('h3');
  heading.style.cssText = 'margin:0;font-size:16px;color:var(--dialog-text);font-weight:700;';
  heading.textContent = options.title;
  const closeButton = button('modal-close-btn', '✕', 'background:none;border:none;color:var(--dialog-label);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;');
  header.append(heading, closeButton);
  dialog.appendChild(header);

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.appendChild(options.content);
  dialog.appendChild(content);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:20px;';
  const cancelButton = button('modal-cancel-btn', options.cancelLabel ?? 'Cancel', 'background:var(--dialog-input-bg);border:1px solid var(--dialog-input-border);border-radius:8px;padding:8px 16px;color:var(--dialog-text);font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;');
  const confirmButton = button('modal-confirm-btn', options.confirmLabel ?? 'Save', 'background:#6366f1;border:1px solid #6366f1;border-radius:8px;padding:8px 16px;color:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;');
  footer.append(cancelButton, confirmButton);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  if (options.owner.querySelector('.tahta-shell')?.classList.contains('dark')) overlay.classList.add('dark');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    lifecycle.abort();
    if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    overlay.remove();
    activeModals.delete(options.owner);
  };
  const cancel = () => { options.onCancel?.(); close(); };
  activeModals.set(options.owner, close);

  overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) cancel(); }, { signal: lifecycle.signal });
  closeButton.addEventListener('click', cancel, { signal: lifecycle.signal });
  cancelButton.addEventListener('click', cancel, { signal: lifecycle.signal });
  confirmButton.addEventListener('click', () => {
    if (options.onConfirm?.() === false) return;
    close();
  }, { signal: lifecycle.signal });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') cancel(); }, { signal: lifecycle.signal });
  focusFrame = requestAnimationFrame(() => dialog.querySelector<HTMLElement>('input, button')?.focus());

  return dialog;
}

export function closeModal(owner: HTMLElement): void {
  activeModals.get(owner)?.();
}

export function confirmModal(opts: {
  owner: HTMLElement;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const message = document.createElement('p');
    message.style.cssText = 'margin:0;color:var(--dialog-text);font-size:14px;line-height:1.5;';
    message.textContent = opts.message;
    const dialog = openModal({
      owner: opts.owner,
      title: opts.title,
      content: message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      width: opts.width ?? '340px',
      onConfirm: () => { resolved = true; resolve(true); },
      onCancel: () => { if (!resolved) resolve(false); },
    });
    if (opts.danger) {
      const confirmButton = dialog.querySelector<HTMLElement>('.modal-confirm-btn');
      if (confirmButton) {
        confirmButton.style.background = '#ef4444';
        confirmButton.style.borderColor = '#ef4444';
      }
    }
  });
}
