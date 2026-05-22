import {
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from '../../logic/activityTemplateGenerators';

const actions = [
  {
    id: SCENE_TEMPLATE_LAUNCH_PAGE_ID,
    title: 'Etkinlik Giriş Sayfası Oluştur',
    desc: 'İki ana geçiş butonlu giriş sayfasını doğru triggerlarıyla üretir.',
    tone: '#2563eb',
  },
  {
    id: SCENE_TEMPLATE_BUTTON_INTRO_ID,
    title: 'Etkinlik Tanıtım Sayfası Oluştur',
    desc: 'Hazır butonları ve görevlerini tanıtan dolu tanıtım sayfasını oluşturur.',
    tone: '#7c3aed',
  },
  {
    id: 'answer-scene-set',
    title: 'Cevap Sahne Seti Oluştur',
    desc: 'Uygulama sahnesine menu, açıklama, doğru/yanlış ve cevap layer setini kurar.',
    tone: '#16a34a',
  },
];

function ActionCard({ action, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid #dbe6f3',
        borderRadius: 9,
        background: '#ffffff',
        color: '#0f172a',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '28px minmax(0,1fr)',
        gap: 9,
        padding: 10,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `${action.tone}14`,
          border: `1px solid ${action.tone}40`,
          color: action.tone,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 950,
        }}
      >
        +
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: action.tone,
            fontSize: 11,
            fontWeight: 950,
            marginBottom: 3,
          }}
        >
          {action.title}
        </span>
        <span style={{ display: 'block', color: '#64748b', fontSize: 10.5, fontWeight: 700, lineHeight: 1.35 }}>
          {action.desc}
        </span>
      </span>
    </button>
  );
}

export default function DesignToolsDialog({ open, onClose, onGenerateAnswerSet, onGenerateTemplate }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9400,
        background: 'rgba(15,23,42,.28)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '54px 18px 18px',
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Tasarım üretim araçları"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: 360,
          maxWidth: 'calc(100vw - 36px)',
          borderRadius: 12,
          border: '1px solid #cfe0f3',
          background: '#fbfdff',
          boxShadow: '0 24px 58px rgba(15,23,42,.22)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            minHeight: 42,
            borderBottom: '1px solid #dbe6f3',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 12px',
          }}
        >
          <div>
            <div style={{ color: '#0f5bff', fontSize: 12, fontWeight: 950, textTransform: 'uppercase' }}>
              Tasarım Araçları
            </div>
            <div style={{ color: '#64748b', fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>
              Eski üretim komutları yeni stile bağlandı.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: '1px solid #dbe6f3',
              background: '#ffffff',
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: 'grid', gap: 8, padding: 10 }}>
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onClick={() => {
                if (action.id === 'answer-scene-set') onGenerateAnswerSet?.();
                else onGenerateTemplate?.(action.id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
