/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';

import { getPackageTheme } from '../../logic/buttonStyling';
import ActivityTextEditor from '../editor-workspace/text/ActivityTextEditor';

// Metin Stüdyosu çalışma alanı. Daha önce EIcerikEditor.jsx içinde tanımlıydı;
// davranış birebir korunarak ayrı dosyaya taşındı. İçindeki ActivityTextEditor'ı
// ayrılan modülden import eder.
function TextStudioWorkspace({
  activity,
  activities = [],
  variables = [],
  onUpdate,
  onClose,
  designPresets = [],
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onOpenNewTab,
}) {
  const theme = getPackageTheme(activity?.buttonPackageId);
  const [studioViewportWidth, setStudioViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1600
  );
  const [activeStudioSectionId, setActiveStudioSectionId] = useState('intro');
  const studioSections = [
    {
      id: 'intro',
      icon: '①',
      title: 'Karşılama',
      desc: 'Başlık, açıklama ve başlangıç butonu',
      editorSections: ['intro'],
      defaultSection: 'intro',
    },
    {
      id: 'package',
      icon: '②',
      title: 'Tema Paketi',
      desc: 'Hazır kalıplar, kart içerikleri ve tanıtım ekranı',
      editorSections: ['package'],
      defaultSection: 'package',
    },
    {
      id: 'menu',
      icon: '③',
      title: 'Menü Ekranı',
      desc: 'Kurallar, yönlendirme metinleri ve CTA alanı',
      editorSections: ['menu'],
      defaultSection: 'menu',
    },
    {
      id: 'play',
      icon: '④',
      title: 'Oyun',
      desc: 'Sahne görünümü, durum çubuğu ve aksiyonlar',
      editorSections: ['play'],
      defaultSection: 'play',
    },
    {
      id: 'result',
      icon: '⑤',
      title: 'Sonuç',
      desc: 'Başarı, hata ve cevap ekranlarını birlikte düzenle',
      editorSections: ['success', 'failure', 'answer'],
      defaultSection: 'success',
    },
    {
      id: 'settings',
      icon: '⚙',
      title: 'Genel Ayarlar',
      desc: 'Puan, akış, buton yazıları ve görev seçenekleri',
      editorSections: ['behavior'],
      defaultSection: 'behavior',
    },
  ];
  const activeStudioSection =
    studioSections.find((section) => section.id === activeStudioSectionId) || studioSections[0];

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setStudioViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!activity) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top left,#1d4ed8 0%,#0f172a 42%,#020617 100%)',
          padding: 24,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 'min(620px, 100%)',
            borderRadius: 28,
            background: 'rgba(255,255,255,.96)',
            border: '1px solid rgba(191,219,254,.45)',
            boxShadow: '0 30px 80px rgba(15,23,42,.35)',
            padding: 26,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Metin Stüdyosu</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Önce ana editörde bir etkinlik seç, sonra stüdyo otomatik açılacak.
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Ana Editöre Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background:
          'radial-gradient(circle at top left,#dbeafe 0%,#eef4ff 34%,#f8fbff 66%,#eef2ff 100%)',
        padding: 16,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0,1fr)',
          gap: 16,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: 16,
            borderRadius: 24,
            background: 'rgba(255,255,255,.92)',
            border: `1px solid ${theme.border}40`,
            boxShadow: '0 24px 60px rgba(15,23,42,.10)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg,#2563eb,#7c3aed 65%,#ec4899)',
                color: '#fff',
                fontSize: 20,
                fontWeight: 900,
                boxShadow: '0 14px 28px rgba(99,102,241,.28)',
              }}
            >
              ✦
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  Metin Stüdyosu
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#4338ca',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  Canva düzeni
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#0f766e',
                    background: '#ecfeff',
                    border: '1px solid #99f6e4',
                    borderRadius: 999,
                    padding: '4px 8px',
                  }}
                >
                  Canlı senkron
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activity.name || 'Etkinlik'} · üstten ekranı seç, solda düzenle ve sağda anlık
                görünümü izle
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {onOpenNewTab && (
              <button
                onClick={onOpenNewTab}
                style={{
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: '1px solid #e9d5ff',
                  background: '#faf5ff',
                  color: '#7c3aed',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ↗ Yeni Sekmede Aç
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 12px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Önizlemeyi Yenile
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '9px 12px',
                borderRadius: 12,
                border: '1px solid #bfdbfe',
                background: 'linear-gradient(180deg,#eff6ff,#ffffff)',
                color: '#1d4ed8',
                fontSize: 11,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              ← Ana Editöre Dön
            </button>
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <section
            style={{
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 24,
              overflow: 'hidden',
              background: 'rgba(255,255,255,.94)',
              border: `1px solid ${theme.border}30`,
              boxShadow: '0 24px 60px rgba(15,23,42,.10)',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(226,232,240,.95)',
                background: 'linear-gradient(180deg,#ffffff,#f8fbff)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                    Özellik Paneli
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Metin, buton, görünüm ve davranış ayarları artık daha geniş ve tek akışta.
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#0f766e',
                      background: '#ecfeff',
                      border: '1px solid #99f6e4',
                      borderRadius: 999,
                      padding: '4px 8px',
                    }}
                  >
                    Otomatik kayıt
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 999,
                      padding: '4px 8px',
                    }}
                  >
                    Alt maddeler için daha ferah görünüm
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  paddingBottom: 4,
                  marginTop: 12,
                  scrollbarGutter: 'stable',
                }}
              >
                {studioSections.map((section) => {
                  const isActive = activeStudioSection.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveStudioSectionId(section.id)}
                      title={section.desc}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 11px',
                        borderRadius: 999,
                        background: isActive ? '#2563eb' : '#eff6ff',
                        border: `1px solid ${isActive ? '#1d4ed8' : '#bfdbfe'}`,
                        color: isActive ? '#ffffff' : '#1d4ed8',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        flexShrink: 0,
                        boxShadow: isActive ? '0 10px 24px rgba(37,99,235,.22)' : 'none',
                      }}
                    >
                      <span>{section.icon}</span>
                      <span>{section.title}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f172a' }}>{activeStudioSection.title}:</strong>{' '}
                {activeStudioSection.desc}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                padding: 14,
                background: 'linear-gradient(180deg,#0f172a,#111827 42%,#0b1120 100%)',
                scrollbarGutter: 'stable',
              }}
            >
              <ActivityTextEditor
                activity={activity}
                onUpdate={onUpdate}
                designPresets={designPresets}
                onSavePreset={onSavePreset}
                onApplyPreset={onApplyPreset}
                onDeletePreset={onDeletePreset}
                visibleSectionIds={activeStudioSection.editorSections}
                preferredOpenSection={activeStudioSection.defaultSection}
                sectionTitle={activeStudioSection.title}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TextStudioWorkspace;
