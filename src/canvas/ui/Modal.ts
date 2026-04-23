/**
 * Reusable modal dialog component for tahta.js.
 * Uses the existing dialog CSS variables from styles.css.
 */

let activeModal: HTMLElement | null = null;

interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  onConfirm?: () => void | boolean;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
}

export function openModal(options: ModalOptions): HTMLDivElement {
  closeModal();

  const {
    title,
    content,
    onConfirm,
    onCancel,
    confirmLabel = 'Save',
    cancelLabel = 'Cancel',
    width = '380px',
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'tahta-shell';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;z-index:999999;
    font-family:"Outfit",system-ui,sans-serif;`;

  const dialog = document.createElement('div');
  dialog.className = 'tahta-modal';
  dialog.style.cssText = `background:var(--dialog-bg);border:1px solid var(--dialog-border);border-radius:12px;
    padding:20px;width:${width};max-height:80vh;overflow-y:auto;color:var(--dialog-text);
    box-shadow:var(--dialog-shadow);`;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;`;
  header.innerHTML = `
    <h3 style="margin:0;font-size:16px;color:var(--dialog-text);font-weight:700;">${title}</h3>
    <button class="modal-close-btn" style="background:none;border:none;color:var(--dialog-label);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;">✕</button>
  `;
  dialog.appendChild(header);

  // Content
  const contentEl = document.createElement('div');
  contentEl.className = 'modal-content';
  if (typeof content === 'string') {
    contentEl.innerHTML = content;
  } else {
    contentEl.appendChild(content);
  }
  dialog.appendChild(contentEl);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `display:flex;justify-content:flex-end;gap:8px;margin-top:20px;`;
  footer.innerHTML = `
    <button class="modal-cancel-btn" style="background:var(--dialog-input-bg);border:1px solid var(--dialog-input-border);border-radius:8px;padding:8px 16px;color:var(--dialog-text);font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;">${cancelLabel}</button>
    <button class="modal-confirm-btn" style="background:#6366f1;border:1px solid #6366f1;border-radius:8px;padding:8px 16px;color:#fff;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;">${confirmLabel}</button>
  `;
  dialog.appendChild(footer);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  activeModal = overlay;

  // Sync theme
  const mainShell = document.querySelector('.tahta-shell');
  if (mainShell?.classList.contains('dark')) overlay.classList.add('dark');

  // Close logic
  function close() {
    overlay.remove();
    activeModal = null;
  }

  overlay.addEventListener('mousedown', e => {
    if (e.target === overlay) {
      onCancel?.();
      close();
    }
  });

  dialog.querySelector('.modal-close-btn')?.addEventListener('click', () => {
    onCancel?.();
    close();
  });

  dialog.querySelector('.modal-cancel-btn')?.addEventListener('click', () => {
    onCancel?.();
    close();
  });

  dialog.querySelector('.modal-confirm-btn')?.addEventListener('click', () => {
    if (onConfirm) {
      const result = onConfirm();
      if (result === false) return; // Prevent close if onConfirm returns false
    }
    close();
  });

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      onCancel?.();
      close();
      document.removeEventListener('keydown', onKey);
    }
  });

  // Focus first input if any
  requestAnimationFrame(() => {
    const firstInput = dialog.querySelector('input') as HTMLInputElement;
    if (firstInput) firstInput.focus();
  });

  return dialog;
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

/**
 * Convenience: open a prompt-style modal with a single text input.
 * Returns a Promise that resolves with the entered value or null if cancelled.
 */
export function promptModal(opts: {
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    const inputId = 'modal-prompt-input';
    const labelHtml = opts.label ? `<label style="display:block;font-size:12px;color:var(--dialog-label);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.025em;">${opts.label}</label>` : '';
    const content = `
      <div>
        ${labelHtml}
        <input id="${inputId}" type="text" value="${opts.defaultValue || ''}" placeholder="${opts.placeholder || ''}"
          style="width:100%;box-sizing:border-box;background:var(--dialog-input-bg);border:1px solid var(--dialog-input-border);
          border-radius:8px;padding:8px 12px;color:var(--dialog-text);font-size:13px;outline:none;transition:border-color 0.2s;" />
      </div>
    `;

    let resolved = false;

    openModal({
      title: opts.title,
      content,
      confirmLabel: opts.confirmLabel || 'Save',
      cancelLabel: opts.cancelLabel || 'Cancel',
      width: opts.width || '380px',
      onConfirm: () => {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (input && input.value.trim()) {
          resolved = true;
          resolve(input.value.trim());
        }
        return false; // Prevent close if empty
      },
      onCancel: () => {
        if (!resolved) resolve(null);
      },
    });

    // Allow Enter key to submit
    requestAnimationFrame(() => {
      const input = document.getElementById(inputId) as HTMLInputElement;
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = input.value.trim();
            if (val) {
              resolved = true;
              resolve(val);
              closeModal();
            }
          }
        });
      }
    });
  });
}

/**
 * Convenience: open an alert-style modal with a message.
 */
export function alertModal(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  width?: string;
}): Promise<void> {
  return new Promise((resolve) => {
    openModal({
      title: opts.title,
      content: `<p style="margin:0;color:var(--dialog-text);font-size:14px;line-height:1.5;">${opts.message}</p>`,
      confirmLabel: opts.confirmLabel || 'OK',
      cancelLabel: undefined as any,
      width: opts.width || '340px',
      onConfirm: () => {
        resolve();
      },
      onCancel: () => {
        resolve();
      },
    });

    // Hide cancel button for alert
    requestAnimationFrame(() => {
      const cancelBtn = document.querySelector('.modal-cancel-btn') as HTMLElement;
      if (cancelBtn) cancelBtn.style.display = 'none';
    });
  });
}

/**
 * Convenience: open a confirm-style modal with Yes/No buttons.
 * Returns a Promise that resolves with true if confirmed, false if cancelled.
 */
export function confirmModal(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  width?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    openModal({
      title: opts.title,
      content: `<p style="margin:0;color:var(--dialog-text);font-size:14px;line-height:1.5;">${opts.message}</p>`,
      confirmLabel: opts.confirmLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      width: opts.width || '340px',
      onConfirm: () => {
        resolved = true;
        resolve(true);
      },
      onCancel: () => {
        if (!resolved) resolve(false);
      },
    });

    // Style confirm button as danger if requested
    if (opts.danger) {
      requestAnimationFrame(() => {
        const confirmBtn = document.querySelector('.modal-confirm-btn') as HTMLElement;
        if (confirmBtn) {
          confirmBtn.style.background = '#ef4444';
          confirmBtn.style.borderColor = '#ef4444';
        }
      });
    }
  });
}
