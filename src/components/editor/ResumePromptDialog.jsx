/**
 * "Kaldığınız Yer Açıldı" oturum-devam (session resume) sorusu dialog'u.
 * Kullanıcı son düzenlediği konuma otomatik gelince çıkar; buradan devam mı,
 * yayınevi kısmına dönüş mü seçtirir. EIcerikEditor render'ından birebir taşındı
 * (yalnızca presentational). Görünürlük kontrolü (pendingResume) çağıranda kalır.
 *
 * Props: resume ({ projectName?, bookName?, activityName? }), onCancel
 * ("Yayınevi Kısmı"), onConfirm ("Devam Et").
 *
 * @returns {JSX.Element}
 */
export default function ResumePromptDialog({ resume, onCancel, onConfirm }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-choice-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(15,23,42,.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          padding: 24,
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 'bold',
            }}
          >
              ↻
          </div>
          <div>
            <h3
              id="resume-choice-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              Kaldığınız Yer Açıldı
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Son düzenlediğiniz konuma otomatik geldik.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#f8fafc',
            borderRadius: 10,
            padding: 16,
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {resume.projectName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Proje:</span>
              <span style={{ color: '#0f172a', fontWeight: 900 }}>{resume.projectName}</span>
            </div>
          )}
          {resume.bookName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Kitap:</span>
              <span style={{ color: '#0f172a', fontWeight: 900 }}>{resume.bookName}</span>
            </div>
          )}
          {resume.activityName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>Etkinlik:</span>
              <span style={{ color: '#0f172a', fontWeight: 900 }}>{resume.activityName}</span>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#475569' }}>
          Buradan devam etmek ister misiniz, yoksa yayınevi kısmına mı dönmek istersiniz?
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Yayınevi Kısmı
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
            }}
          >
            Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
