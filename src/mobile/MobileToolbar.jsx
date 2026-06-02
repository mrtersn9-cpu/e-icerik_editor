import { Layers, LayoutGrid, SlidersHorizontal } from 'lucide-react';

import { CANVAS_ADD_ACTIONS } from '../components/editor/canvasAddActions';

import styles from './MobileToolbar.module.css';

/*
 * Mobil alt komut çubuğu — Canva benzeri hızlı erişim.
 * Önce araçlar/panel/sahne açıcılar, sonra tek kaynaktan (CANVAS_ADD_ACTIONS) gelen
 * nesne ekleme eylemleri. Hiçbir motor mantığı içermez; mevcut komutları tetikler.
 */
export default function MobileToolbar({ canvasRef, onOpenRibbon, onOpenInspector, onOpenScenes }) {
  return (
    <div className={styles.bar}>
      {onOpenRibbon && (
        <button type="button" className={`${styles.btn} ${styles.accent}`} onClick={onOpenRibbon}>
          <LayoutGrid size={20} aria-hidden="true" />
          Araçlar
        </button>
      )}
      <button type="button" className={`${styles.btn} ${styles.accent}`} onClick={onOpenInspector}>
        <SlidersHorizontal size={20} aria-hidden="true" />
        Özellikler
      </button>
      <button type="button" className={`${styles.btn} ${styles.accent}`} onClick={onOpenScenes}>
        <Layers size={20} aria-hidden="true" />
        Sahneler
      </button>

      <span className={styles.divider} aria-hidden="true" />

      {CANVAS_ADD_ACTIONS.map(({ id, label, icon: Icon, run }) => (
        <button key={id} type="button" className={styles.btn} onClick={() => run(canvasRef)}>
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
