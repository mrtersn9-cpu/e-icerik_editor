import { useState, useMemo } from 'react';
import AnswerPanel from './sections/AnswerPanel';
import LayerPanel from './sections/LayerPanel';

function GirisModule(props) {
  const { selActivity, activeTab } = props;

  const TABS = useMemo(() => {
    const isAnswerable = [
      'selection',
      'drag-drop',
      'matching',
      'sequence',
      'text-entry',
      'numeric',
      'fill-blank',
      'survey',
      'mixed',
    ].includes(selActivity?.type);

    return [
      { id: 'katmanlar', label: 'Katmanlar', icon: '📚' },
      { id: 'cevap', label: 'Cevap', icon: '✅', disabled: !isAnswerable },
      { id: 'etkilesim', label: 'Etkileşimler', icon: '✨' },
      { id: 'genel', label: 'Genel', icon: '⚙️' },
    ];
  }, [selActivity?.type]);

  const [activeSubTab, setActiveSubTab] = useState(() =>
    activeTab === 'soru' ? 'cevap' : 'katmanlar'
  );

  const ActivePanel = useMemo(() => {
    if (activeSubTab === 'cevap') return AnswerPanel;
    if (activeSubTab === 'katmanlar') return LayerPanel;
    return null;
  }, [activeSubTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#111827',
          padding: '4px 0',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        Etkinlik Kontrol Merkezi
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              disabled={tab.disabled}
              title={tab.label}
              style={{
                padding: '5px 9px',
                borderRadius: 999,
                border: `1px solid ${isActive ? '#a78bfa' : '#d1d5db'}`,
                background: isActive ? '#f5f3ff' : '#ffffff',
                color: isActive ? '#7c3aed' : tab.disabled ? '#9ca3af' : '#374151',
                fontSize: 11,
                fontWeight: 700,
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          background: '#f8fafc',
          borderRadius: 12,
          border: '1px solid #f1f5f9',
          padding: 12,
        }}
      >
        {ActivePanel ? (
          <ActivePanel {...props} />
        ) : (
          <div style={{ fontSize: 12, color: '#64748b' }}>Bu bölüm yapım aşamasındadır.</div>
        )}
      </div>
    </div>
  );
}

export default GirisModule;