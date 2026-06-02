import { Copy, FileText, LayoutPanelTop, Trash2 } from 'lucide-react';

import { CANVAS_ADD_ACTIONS } from '../../components/editor/canvasAddActions';

import styles from './EditorToolRail.module.css';

/**
 * Editör sol/sağ araç rayı. "Ekle" grubu tek kaynaktan (CANVAS_ADD_ACTIONS) gelir;
 * "Akış" sekme geçişleri, "Düzen" seçim işlemleri buraya özeldir.
 */
const FLOW_TOOLS = [
  { id: 'stage', icon: LayoutPanelTop, label: 'Sahne', title: 'Sahne sekmesi', run: (_ref, setTab) => setTab('sahne') },
  { id: 'texts', icon: FileText, label: 'Metin Stüdyosu', title: 'Metin stüdyosunu aç', run: (_ref, setTab) => setTab('metinler') },
];

const EDIT_TOOLS = [
  { id: 'copy', icon: Copy, label: 'Kopyala', title: 'Seçimi kopyala', run: (ref) => ref?.current?.duplicateSelected?.() },
  { id: 'delete', icon: Trash2, label: 'Sil', title: 'Seçimi sil', run: (ref) => ref?.current?.deleteSelected?.() },
];

export default function EditorToolRail({
  selActivity,
  canvasRef,
  selectedIds,
  setActiveTab,
  mobile = false,
  uiMode = 'advanced',
}) {
  const hasSelection = selectedIds.size > 0 || !!selActivity?.selectedObjectId;

  const addTools = CANVAS_ADD_ACTIONS.map((action) => ({
    id: action.id,
    icon: action.icon,
    label: action.label,
    title: `${action.label} ekle`,
    run: (ref) => action.run(ref),
  }));

  const groups = [
    { label: 'Akış', tools: FLOW_TOOLS, kind: 'flow' },
    { label: 'Ekle', tools: addTools, kind: 'add' },
    uiMode === 'advanced' ? { label: 'Düzen', tools: EDIT_TOOLS, kind: 'edit' } : null,
  ].filter((group) => group && group.tools.length);

  return (
    <aside className={`${styles.rail} ${mobile ? styles.mobile : ''}`}>
      {groups.map((group) => (
        <div className={styles.group} key={group.label}>
          {!mobile && <span className={styles.groupLabel}>{group.label}</span>}
          {group.tools.map((tool) => {
            const Icon = tool.icon;
            const disabled = !selActivity || (group.kind === 'edit' && !hasSelection);
            return (
              <button
                key={tool.id}
                type="button"
                className={styles.tool}
                title={tool.title}
                onClick={() => tool.run(canvasRef, setActiveTab)}
                disabled={disabled}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
