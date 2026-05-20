import AnimasyonRibbon from './tabs/AnimasyonRibbon';
import BicimRibbon from './tabs/BicimRibbon';
import EkleRibbon from './tabs/EkleRibbon';
import GecislerRibbon from './tabs/GecislerRibbon';
import GirisRibbon from './tabs/GirisRibbon';
import GorunumRibbon from './tabs/GorunumRibbon';
import SahneRibbon from './tabs/SahneRibbon';
import TasarimRibbon from './tabs/TasarimRibbon';
import YardimRibbon from './tabs/YardimRibbon';
import YayinlaRibbon from './tabs/YayinlaRibbon';

const ribbonTabs = [
  { id: 'home', label: 'Giriş', Component: GirisRibbon },
  { id: 'insert', label: 'Ekle', Component: EkleRibbon },
  { id: 'scene', label: 'Sahne', Component: SahneRibbon },
  { id: 'design', label: 'Tasarım', Component: TasarimRibbon },
  { id: 'transitions', label: 'Geçişler', Component: GecislerRibbon },
  { id: 'animation', label: 'Animasyon', Component: AnimasyonRibbon },
  { id: 'view', label: 'Görünüm', Component: GorunumRibbon },
  { id: 'publish', label: 'Yayınla', Component: YayinlaRibbon },
  { id: 'help', label: 'Yardım', Component: YardimRibbon },
];

const contextualTabs = [{ id: 'object-format', label: 'Biçim', Component: BicimRibbon }];

export default function TopRibbon({ controller, fullscreen = false }) {
  if (!controller) return null;

  const tabs = controller.hasObjectSelection
    ? [...ribbonTabs, ...contextualTabs]
    : ribbonTabs;
  const activeTab = tabs.some((tab) => tab.id === controller.activeTab)
    ? controller.activeTab
    : 'home';
  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.Component || GirisRibbon;
  const ribbonHeight = fullscreen ? 120 : 120;

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderBottom: '1px solid #d7e0eb',
        height: ribbonHeight,
        minHeight: ribbonHeight,
        maxHeight: ribbonHeight,
        overflow: 'visible',
        zIndex: 10,
        boxShadow: '0 1px 0 rgba(15,23,42,.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 32,
          minHeight: 32,
          maxHeight: 32,
          padding: '0 16px',
          background: '#ffffff',
          borderBottom: '1px solid #d8e1ee',
          gap: 6,
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        {ribbonTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => controller.commands.setRibbonTab(tab.id)}
              style={{
                height: 31,
                minWidth: 62,
                padding: '0 11px',
                border: 'none',
                borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
                background: 'transparent',
                color: active ? '#0f5bff' : '#1f2f4a',
                fontSize: 12,
                fontWeight: active ? 850 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: '28px',
              }}
            >
              {tab.label}
            </button>
          );
        })}
        {controller.hasObjectSelection && (
          <>
            <div style={{ width: 1, height: 18, background: '#cbd5e1', margin: '0 6px 7px' }} />
            {contextualTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => controller.commands.setRibbonTab(tab.id)}
                  style={{
                    height: 31,
                    minWidth: 62,
                    padding: '0 11px',
                    border: 'none',
                    borderBottom: active ? '3px solid #7c3aed' : '3px solid transparent',
                    background: 'transparent',
                    color: active ? '#6d28d9' : '#475569',
                    fontSize: 12,
                    fontWeight: active ? 850 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    lineHeight: '28px',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </>
        )}
      </div>

      <div
        style={{
          height: 88,
          minHeight: 88,
          maxHeight: 88,
          display: 'flex',
          alignItems: 'stretch',
          overflow: 'visible',
          padding: '0',
          background: '#ffffff',
          borderBottomLeftRadius: 6,
          borderBottomRightRadius: 6,
        }}
      >
        <div
          style={{
            width: '100%',
            minWidth: 0,
            height: 88,
            display: 'flex',
            alignItems: 'stretch',
            overflow: 'visible',
            flexWrap: 'nowrap',
          }}
        >
          <ActiveComponent controller={controller} />
        </div>
      </div>
    </div>
  );
}
