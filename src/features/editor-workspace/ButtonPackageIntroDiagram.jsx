import { BUTTON_PACKAGES } from '../../constants';
import { getPackageTheme } from '../../logic/buttonStyling';
import { resolveThemePackageItems } from '../../logic/factories';

// Tema paketi önizleme diyagramı: seçilen paketin tüm butonlarını birlikte gösterir.
// Saf bir görsel bileşendir, davranış değişmedi.
function ButtonPackageIntroDiagram({ pkgId, config = {} }) {
  const pkg = BUTTON_PACKAGES.find((item) => item.id === pkgId) || BUTTON_PACKAGES[0];
  const theme = getPackageTheme(pkg.id);
  const accent = theme.accent || pkg.color;
  const rows = resolveThemePackageItems(config);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          borderRadius: 18,
          background: `linear-gradient(135deg,${accent}18,rgba(255,255,255,.96))`,
          border: `1px solid ${accent}33`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: theme.button,
              color: theme.text,
              fontSize: 20,
              fontWeight: 900,
              boxShadow: `0 10px 20px ${accent}22`,
            }}
          >
            {pkg.icon || '🎨'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 2 }}>
              Tema Paketi Önizlemesi
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: '#475569' }}>
              {pkg.name} · {pkg.desc}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            background: `${accent}14`,
            border: `1px solid ${accent}30`,
            borderRadius: 999,
            padding: '5px 9px',
          }}
        >
          {pkg.trigger} · {pkg.anim}
        </span>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg,#f8fafc,#eef4ff)',
          borderRadius: 24,
          padding: 14,
          boxShadow: 'inset 0 0 0 1px rgba(148,163,184,.24)',
          overflow: 'hidden',
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.55, color: '#475569', marginBottom: 10 }}>
          Seçtiğin tema paketi aşağıdaki tüm butonları birlikte günceller:
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 10,
          }}
        >
          {rows.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 16,
                background: '#ffffff',
                border: `1px solid ${accent}22`,
                boxShadow: '0 6px 18px rgba(15,23,42,.05)',
              }}
            >
              <div
                style={{
                  minHeight: 42,
                  borderRadius: theme.radius || 999,
                  background: theme.button,
                  color: theme.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  overflow: 'hidden',
                  boxShadow: `0 10px 24px ${accent}22`,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'rgba(255,255,255,.94)',
                    color: accent,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  {item.icon}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <div
                style={{
                  minWidth: 0,
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: `${accent}12`,
                  border: `1px solid ${accent}24`,
                  color: '#334155',
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ButtonPackageIntroDiagram;
