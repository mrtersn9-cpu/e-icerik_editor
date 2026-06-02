import {
  ChevronLeft,
  Clock,
  Download,
  ListChecks,
  MoreVertical,
  Package,
  Palette,
  Play,
  Redo2,
  Undo2,
  UserCog,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import WorkspaceStageCanvas from '../logic/StageCanvas';

import styles from './MobileEditorShell.module.css';
import MobileInspectorSheet from './MobileInspectorSheet';
import MobileToolbar from './MobileToolbar';

/*
 * Telefon/tablet editör kabuğu. Masaüstü düzeninden bağımsız ama AYNI state'i,
 * AYNI child bileşenleri (WorkspaceStageCanvas, ContextRightPanel, SlideStrip)
 * ve aynı handler'ları kullanır. Motor mantığı yoktur.
 *
 * Ağır/yeniden kullanılan paneller (slayt şeridi, sahne çekmecesi) parent'tan
 * hazır element olarak gelir; böylece onlarca yardımcı prop'u thread etmeyiz.
 */
export default function MobileEditorShell({
  deviceMode = 'phone',
  topBar = {},
  canvasProps = {},
  canvasRef,
  inspector = {},
  slideStripElement = null,
  ribbonElement = null,
  timelineElement = null,
}) {
  const isTablet = deviceMode === 'tablet';
  const [menuOpen, setMenuOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSnap, setInspectorSnap] = useState('half');
  const [scenesOpen, setScenesOpen] = useState(false);
  const [ribbonOpen, setRibbonOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const {
    currentProject,
    selActivity,
    undo,
    redo,
    canUndo = false,
    canRedo = false,
    onPreview,
    onAnswer,
    onDesign,
    onExport,
    onScormExport,
    onVersions,
    onBackToLibrary,
    onLogout,
  } = topBar;

  const selectedIds = canvasProps.selectedIds;
  const selectionSize = selectedIds?.size || 0;

  // nesne seçilince denetleyiciyi otomatik yarı-aç (Canva benzeri)
  const prevSelectionRef = useRef(0);
  useEffect(() => {
    if (selectionSize > 0 && prevSelectionRef.current === 0 && !inspectorOpen) {
      setInspectorSnap('half');
      setInspectorOpen(true);
    }
    prevSelectionRef.current = selectionSize;
  }, [selectionSize, inspectorOpen]);

  const menuItems = [
    { id: 'answer', label: 'Cevap', icon: ListChecks, onClick: onAnswer },
    timelineElement
      ? { id: 'timeline', label: 'Zaman Çizelgesi', icon: Clock, onClick: () => setTimelineOpen(true) }
      : null,
    { id: 'design', label: 'Tasarım', icon: Palette, onClick: onDesign },
    { id: 'versions', label: 'Sürümler', icon: ListChecks, onClick: onVersions },
    { id: 'export', label: 'Dışa Aktar (JSON)', icon: Download, onClick: onExport },
    onScormExport
      ? { id: 'scorm', label: 'SCORM Çıktısı Al', icon: Package, onClick: onScormExport }
      : null,
    { id: 'logout', label: 'Kullanıcı değiştir', icon: UserCog, onClick: onLogout, danger: true },
  ].filter(Boolean);

  return (
    <div className={styles.shell}>
      {/* ── üst bar ── */}
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={onBackToLibrary || onLogout}
          title="Kütüphaneye dön"
          aria-label="Kütüphaneye dön"
        >
          <ChevronLeft size={22} />
        </button>
        <img src="/logo-light.svg" alt="E-İçerik Studio" className={styles.topbarLogo} />
        <div className={styles.topbarTitle}>
          <strong>{selActivity?.name || currentProject?.name || 'Etkinlik'}</strong>
          <small>Düzenleme</small>
        </div>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={undo}
          disabled={!canUndo}
          title="Geri Al"
          aria-label="Geri Al"
        >
          <Undo2 size={19} />
        </button>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={redo}
          disabled={!canRedo}
          title="İleri Al"
          aria-label="İleri Al"
        >
          <Redo2 size={19} />
        </button>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={onPreview}
          title="Önizleme"
          aria-label="Önizleme"
        >
          <Play size={19} />
        </button>
        <button
          type="button"
          className={styles.topbarBtn}
          onClick={() => setMenuOpen(true)}
          title="Daha fazla"
          aria-label="Daha fazla"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {/* ── gövde ── */}
      <div className={`${styles.body} ${isTablet ? styles.bodyTablet : ''}`}>
        <div className={styles.stageArea}>
          <div className={styles.canvasWrap}>
            <WorkspaceStageCanvas
              ref={canvasRef}
              {...canvasProps}
              touchMode
              showChrome={false}
            />
          </div>
        </div>

        {/* ── alt komut çubuğu ── */}
        <div className={styles.bottomBar}>
          <MobileToolbar
            canvasRef={canvasRef}
            onOpenRibbon={ribbonElement ? () => setRibbonOpen(true) : undefined}
            onOpenInspector={() => {
              setInspectorSnap('half');
              setInspectorOpen(true);
            }}
            onOpenScenes={() => setScenesOpen(true)}
          />
        </div>
      </div>

      {/* ── üst bar menüsü ── */}
      {menuOpen && (
        <>
          <div className={styles.menuScrim} onClick={() => setMenuOpen(false)} role="presentation" />
          <div className={styles.menuSheet} role="menu">
            {menuItems
              .filter((item) => typeof item.onClick === 'function')
              .map(({ id, label, icon: Icon, onClick, danger }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${danger ? styles.danger : ''}`}
                  onClick={() => {
                    setMenuOpen(false);
                    onClick();
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </button>
              ))}
          </div>
        </>
      )}

      {/* ── denetleyici sheet ── */}
      <MobileInspectorSheet
        open={inspectorOpen}
        snap={inspectorSnap}
        onSnapChange={setInspectorSnap}
        onClose={() => setInspectorOpen(false)}
        controller={inspector.controller}
        inspectorProps={inspector.inspectorProps}
        registerBackDismissible={inspector.registerBackDismissible}
        isTablet={isTablet}
      />

      {/* ── araçlar (ribbon) alt sheet ── */}
      {ribbonOpen && ribbonElement && (
        <>
          <div className={styles.menuScrim} onClick={() => setRibbonOpen(false)} role="presentation" />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 201,
              maxHeight: '78vh',
              display: 'flex',
              flexDirection: 'column',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              background: '#ffffff',
              boxShadow: '0 -18px 50px rgba(15,23,42,.4)',
              overflow: 'hidden',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(15,23,42,.1)',
                color: '#1f2f4a',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
              }}
            >
              <span>Araçlar</span>
              <button
                type="button"
                onClick={() => setRibbonOpen(false)}
                aria-label="Kapat"
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid rgba(15,23,42,.18)',
                  borderRadius: 9,
                  background: 'transparent',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {ribbonElement}
            </div>
          </div>
        </>
      )}

      {/* ── zaman çizelgesi tam-ekran sheet ── */}
      {timelineOpen && timelineElement && (
        <>
          <div className={styles.menuScrim} onClick={() => setTimelineOpen(false)} role="presentation" />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 201,
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              background: '#0f172a',
              boxShadow: '0 -18px 50px rgba(15,23,42,.4)',
              overflow: 'hidden',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(148,163,184,.18)',
                color: '#e2e8f0',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
              }}
            >
              <span>Zaman Çizelgesi</span>
              <button
                type="button"
                onClick={() => setTimelineOpen(false)}
                aria-label="Kapat"
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid rgba(148,163,184,.3)',
                  borderRadius: 9,
                  background: 'transparent',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{timelineElement}</div>
          </div>
        </>
      )}

      {/* ── sahne çekmecesi (slayt navigatörü) ── */}
      {scenesOpen && slideStripElement && (
        <>
          <div className={styles.menuScrim} onClick={() => setScenesOpen(false)} role="presentation" />
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 201,
              width: 'min(340px, 88vw)',
              background: '#0f172a',
              boxShadow: '18px 0 50px rgba(15,23,42,.4)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(148,163,184,.18)',
                color: '#e2e8f0',
                fontSize: 12,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
              }}
            >
              <span>Sahneler</span>
              <button
                type="button"
                onClick={() => setScenesOpen(false)}
                aria-label="Kapat"
                style={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid rgba(148,163,184,.3)',
                  borderRadius: 9,
                  background: 'transparent',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: '#f6f8fb' }}>
              {slideStripElement}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
