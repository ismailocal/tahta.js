import { Template } from './templates';

const USER_TEMPLATES_KEY = 'tahta_user_templates';

export class UserTemplateManager {
  private static templates: Record<string, Template> = {};

  static load(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(USER_TEMPLATES_KEY);
      if (stored) {
        this.templates = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[UserTemplateManager] Failed to load from localStorage:', e);
    }
  }

  static save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(this.templates));
    } catch (e) {
      console.warn('[UserTemplateManager] Failed to save to localStorage:', e);
    }
  }

  static addTemplate(name: string, template: Template): string {
    const id = `user-template-${Date.now()}`;
    this.templates[id] = { ...template, label: name };
    this.save();
    return id;
  }

  static getTemplates(): Record<string, Template> {
    return this.templates;
  }

  static deleteTemplate(id: string): void {
    delete this.templates[id];
    this.save();
  }
}

// Initial load
UserTemplateManager.load();
