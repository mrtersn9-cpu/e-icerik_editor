import { createPortal } from 'react-dom';

import { timelineTokens as t } from './timelineTokens';

function MenuButton({ children, disabled = false, onClick, tone = t.text }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        height: 28,
        border: 'none',
        borderRadius: 6,
        background: '#ffffff',
        color: disabled ? '#b6c2d2' : tone,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 10.5,
        fontWeight: 820,
        textAlign: 'left',
        padding: '0 9px',
      }}
    >
      {children}
    </button>
  );
}

export default function TimelineContextMenu({ controller }) {
  const menu = controller.contextMenu;
  if (!menu) return null;

  const item = controller.timeline.find((entry) => entry.id === menu.itemId);
  const object = controller.objects.find((entry) => entry.id === item?.objectId);
  const editable = !!item && object?.locked !== true;

  const run = (fn) => {
    controller.closeContextMenu();
    fn?.();
  };

  // Portal + yüksek z-index: sahnedeki layerBoost'lu nesnelerin (z-index ~100M)
  // altında kalmaması için menü document.body'ye taşınır.
  return createPortal(
    <div
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 2147483001,
        width: 210,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        background: '#ffffff',
        boxShadow: '0 18px 42px rgba(15,23,42,.20)',
        padding: 6,
        display: 'grid',
        gap: 3,
      }}
    >
      <MenuButton onClick={() => run(() => controller.setDetailsOpen(true))}>Klip Ayarlarını Aç</MenuButton>
      <MenuButton disabled={!editable} onClick={() => run(() => controller.alignActiveClip('start'))}>
        Klip Başını Playhead'e Hizala
      </MenuButton>
      <MenuButton disabled={!editable} onClick={() => run(() => controller.alignActiveClip('end'))}>
        Klip Sonunu Playhead'e Hizala
      </MenuButton>
      <MenuButton onClick={() => run(() => controller.alignActiveClip('playhead-to-start'))}>
        Playhead'i Klip Başına Al
      </MenuButton>
      <MenuButton onClick={() => run(() => controller.alignActiveClip('playhead-to-end'))}>
        Playhead'i Klip Sonuna Al
      </MenuButton>
      <MenuButton disabled={!object} onClick={() => run(() => controller.patchObject(object.id, { visible: object?.visible === false }))}>
        {object?.visible === false ? 'Nesneyi Göster' : 'Nesneyi Gizle'}
      </MenuButton>
      <MenuButton disabled={!object} onClick={() => run(() => controller.patchObject(object.id, { locked: !object?.locked }))}>
        {object?.locked ? 'Kilidi Aç' : 'Kilitle'}
      </MenuButton>
      <MenuButton disabled={!editable} onClick={() => run(() => controller.moveActiveTrack(-1))}>
        Satırı Yukarı Taşı
      </MenuButton>
      <MenuButton disabled={!editable} onClick={() => run(() => controller.moveActiveTrack(1))}>
        Satırı Aşağı Taşı
      </MenuButton>
      <MenuButton onClick={() => run(controller.addCuePoint)} tone={t.cue}>
        Playhead'e Cue Ekle
      </MenuButton>
    </div>,
    document.body
  );
}
