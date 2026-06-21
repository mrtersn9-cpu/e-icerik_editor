// Slide Master görsel editörü — master ön ayarlarını görsel thumbnail (arka plan + yerleşim
// placeholder'ları + tema rengi) ile gösterir; karta tıklayınca temayı uygular, "Yerleşim Ekle"
// butonuyla başlık/metin alanı nesnelerini sahneye ekler.

// Layout rolü → mini önizleme kutusu konumu (16:9 kapsayıcıda yüzde).
import { Modal } from './ui';

const ROLE_BOX = {
  title: { left: '8%', top: '12%', width: '84%', height: '20%' },
  subtitle: { left: '8%', top: '36%', width: '60%', height: '12%' },
  body: { left: '8%', top: '40%', width: '84%', height: '50%' },
  left: { left: '8%', top: '40%', width: '40%', height: '50%' },
  right: { left: '52%', top: '40%', width: '40%', height: '50%' },
  image: { left: '8%', top: '22%', width: '38%', height: '68%' },
};

function MasterThumbnail({ master }) {
  const accent = master.theme?.accentColor || '#3b82f6';
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 8,
        overflow: 'hidden',
        background: master.background || '#ffffff',
        border: '1px solid rgba(15,23,42,.12)',
      }}
    >
      {(master.layout || []).map((role, index) => {
        const box = ROLE_BOX[role];
        if (!box) return null;
        const isTitle = role === 'title';
        return (
          <div
            key={`${role}-${index}`}
            style={{
              position: 'absolute',
              ...box,
              borderRadius: 4,
              background: role === 'image' ? `${accent}33` : `${accent}22`,
              border: `1px solid ${accent}${isTitle ? 'aa' : '55'}`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function SlideMasterModal({ open, onClose, masters = [], currentId, onApply, onInsertLayout }) {
  if (!open) return null;

  return (
    <Modal
      title="Slide Master Editörü"
      subtitle="Karta tıkla: tema + arka planı uygula · “Yerleşim Ekle”: başlık/metin alanları"
      onClose={onClose}
      size="lg"
    >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {masters.map((master) => {
              const active = master.id === currentId;
              return (
                <div
                  key={master.id}
                  style={{
                    border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                    borderRadius: 12,
                    padding: 10,
                    background: active ? '#eff6ff' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onApply?.(master.id)}
                    title="Temayı ve arka planı uygula"
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                  >
                    <MasterThumbnail master={master} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{master.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {master.description || ''}
                      </div>
                    </div>
                    {(master.layout || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => onInsertLayout?.(master.id)}
                        title="Bu master'ın yerleşim nesnelerini sahneye ekle"
                        style={{
                          flexShrink: 0,
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: '1px solid #93c5fd',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Yerleşim Ekle
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
    </Modal>
  );
}
