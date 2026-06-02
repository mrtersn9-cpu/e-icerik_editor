import SelectionEditor from './SelectionEditor';

export default function MixedActivityEditor({ activity, onUpdate, getCorrectDragMatches }) {
  const objects = activity.objects || [];
  const draggables = objects.filter((o) => o.type === 'draggable');
  const dropzones = objects.filter((o) => o.type === 'dropzone');
  const options = activity.mcOptions || [];
  const correctOptions = options.filter((option) => option.isCorrect).length;
  const resolvedMatches = getCorrectDragMatches(activity);
  const resolvedCount = draggables.filter((item) => resolvedMatches[item.id]).length;
  const shellCard = {
    background: '#ffffff',
    border: '1px solid #d7e0eb',
    borderRadius: 18,
    padding: 14,
    boxShadow: '0 12px 24px rgba(15,23,42,.06)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...shellCard, background: 'linear-gradient(180deg,#eff6ff,#ffffff)' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#2563eb',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          Karma Etkinlik Akışı
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Seçim ve sürükle-bırak aynı panelde
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7, marginBottom: 12 }}>
          Bu türde öğrenci hem seçenek işaretler hem de nesneleri doğru alanlara bırakır. Önce soru
          yapısını, sonra drag-drop eşleşmelerini tamamlayabilirsin.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
            gap: 8,
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 14,
              background: '#ffffff',
              border: '1px solid #dbeafe',
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Seçenek</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{options.length}</div>
            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>
              {correctOptions} doğru
            </div>
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 14,
              background: '#ffffff',
              border: '1px solid #ccfbf1',
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Sürükle</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              {draggables.length}
            </div>
            <div style={{ fontSize: 11, color: '#0891b2', marginTop: 4 }}>hareketli öğe</div>
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 14,
              background: '#ffffff',
              border: '1px solid #ffedd5',
            }}
          >
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Bırakma Alanı</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              {dropzones.length}
            </div>
            <div style={{ fontSize: 11, color: '#ea580c', marginTop: 4 }}>
              {resolvedCount} eşleşme hazır
            </div>
          </div>
        </div>
      </div>

      <div style={shellCard}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#00BCD4',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 10,
          }}
        >
          1. Soru ve Secenekler
        </div>
        <SelectionEditor activity={activity} onUpdate={onUpdate} />
      </div>

      <div
        style={{
          ...shellCard,
          background: 'linear-gradient(180deg,#fff7ed,#ffffff)',
          border: '1px solid #fed7aa',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#c2410c',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          2. Sürükle-Bırak Kurgusu
        </div>
        <div style={{ fontSize: 11, color: '#7c2d12', lineHeight: 1.7 }}>
          Drag-drop ayarları artık üst panel yerine sağdaki <strong>Cevap</strong> sekmesinde
          yönetiliyor. Bu sayede soru, eşleşme ve cevap mantığı aynı yerde toplanır.
        </div>
      </div>
    </div>
  );
}
