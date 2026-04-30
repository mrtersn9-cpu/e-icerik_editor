// ─── Accessibility ────────────────────────────────────────────────────────────

export const ACCESSIBILITY_DEFAULTS = {
  altText: '',
  ariaLabel: '',
  ariaDescribedBy: '',
  ariaHidden: false,
  tabIndex: 0,
  role: 'presentation',
  focusable: true,
  screenReaderOnly: false,
  lang: 'tr',
};

export const ARIA_ROLE_OPTIONS = [
  { value: 'presentation', label: 'Presentation (varsayilan)' },
  { value: 'img', label: 'Image' },
  { value: 'button', label: 'Button' },
  { value: 'link', label: 'Link' },
  { value: 'heading', label: 'Heading' },
  { value: 'region', label: 'Region' },
  { value: 'alert', label: 'Alert' },
  { value: 'dialog', label: 'Dialog' },
  { value: 'tab', label: 'Tab' },
  { value: 'tabpanel', label: 'Tab Panel' },
  { value: 'listitem', label: 'List Item' },
  { value: 'none', label: 'None (dekoratif)' },
];

export const WCAG_LEVEL_OPTIONS = [
  { value: 'A', label: 'WCAG 2.1 A (minimum)' },
  { value: 'AA', label: 'WCAG 2.1 AA (kurumsal)' },
  { value: 'AAA', label: 'WCAG 2.1 AAA (en ust)' },
];
