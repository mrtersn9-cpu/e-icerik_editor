import { useState, useEffect, useMemo, useCallback } from 'react';

import {
  BUTTON_PACKAGES,
  BUTTON_PACKAGE_MOTION_PRESETS,
  DEFAULT_THEME_PACKAGE_ITEMS,
  GRADE_GROUPS,
} from '../../../constants';
import { restyleActivityButtonsForPackage, restyleActivityButtonMotion } from '../../../logic/activityRestyle';
import { getPackageTheme } from '../../../logic/buttonStyling';
import { resolveThemePackageItems } from '../../../logic/factories';

// Etkinlik metin/stil editörü. Daha önce EIcerikEditor.jsx içinde tanımlıydı;
// davranış birebir korunarak ayrı dosyaya taşındı. Yardımcı alt bileşen SubTab
// bu bileşenin içinde tanımlı olduğu için onunla birlikte taşınmıştır.
function ActivityTextEditor({
  activity,
  onUpdate,
  designPresets = [],
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  visibleSectionIds = [],
  preferredOpenSection = 'intro',
  sectionTitle = '',
}) {
  const [openSection, setOpenSection] = useState('intro');
  const [openSub, setOpenSub] = useState('text');
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [pkgGradeFilter, setPkgGradeFilter] = useState('all');
  const intro = useMemo(() => activity.introScreen || {}, [activity.introScreen]);
  const packageScreen = useMemo(
    () => activity.buttonPackageScreen || {},
    [activity.buttonPackageScreen]
  );
  const menuScreen = activity.menuScreen || {};
  const playScreen = activity.playScreen || {};
  const results = activity.resultScreens || {};
  const answerScreen = activity.answerScreen || {};
  const settings = activity.settings || {};
  const resolvedPackageTitle =
    !packageScreen.title || /buton paketi/i.test(packageScreen.title)
      ? 'Tema Paketi Tanıtımı'
      : packageScreen.title;
  const resolvedPackageBody =
    !packageScreen.body || /buton.*davran/i.test(packageScreen.body)
      ? 'Etkinlikte kullanacağın tema paketini ve buton davranışlarını önce incele.'
      : packageScreen.body;
  const packageItems = resolveThemePackageItems(packageScreen);
  const patch = useCallback((p) => onUpdate({ ...activity, ...p }), [activity, onUpdate]);
  const patchIntro = useCallback(
    (p) => patch({ introScreen: { ...intro, ...p } }),
    [intro, patch]
  );
  const patchPackage = useCallback(
    (p) => patch({ buttonPackageScreen: { ...packageScreen, ...p } }),
    [packageScreen, patch]
  );
  const patchPackageItem = (itemId, nextPatch) =>
    patchPackage({
      items: packageItems.map((item) => (item.id === itemId ? { ...item, ...nextPatch } : item)),
    });
  const patchMenu = (p) => patch({ menuScreen: { ...menuScreen, ...p } });
  const patchPlay = (p) => patch({ playScreen: { ...playScreen, ...p } });
  const patchResults = (p) => patch({ resultScreens: { ...results, ...p } });
  const patchAnswer = (p) => patch({ answerScreen: { ...answerScreen, ...p } });
  const patchSettings = (p) => patch({ settings: { ...settings, ...p } });

  const theme = getPackageTheme(activity.buttonPackageId);
  const normalizedVisibleSectionIds = Array.isArray(visibleSectionIds)
    ? visibleSectionIds.filter(Boolean)
    : [];
  const selectedPreset = designPresets.find((item) => item.id === selectedPresetId) || null;

  useEffect(() => {
    if (!preferredOpenSection) return;
    setOpenSection(preferredOpenSection);
    setOpenSub(preferredOpenSection === 'behavior' ? 'behavior' : 'text');
  }, [preferredOpenSection]);

  useEffect(() => {
    setPresetName(`${activity?.name || 'Yeni Tasarım'} Tasarımı`);
  }, [activity?.id, activity?.name]);

  useEffect(() => {
    if (!designPresets.length) {
      setSelectedPresetId('');
      return;
    }
    if (!designPresets.some((item) => item.id === selectedPresetId)) {
      setSelectedPresetId(designPresets[0].id);
    }
  }, [designPresets, selectedPresetId]);

  useEffect(() => {
    const currIntro = activity.introScreen || {};
    if (!currIntro.style?.background) {
      patchIntro({ style: { ...currIntro.style, background: theme.intro } });
    }
    const currPkg = activity.buttonPackageScreen || {};
    if (!currPkg.style?.background) {
      patchPackage({ style: { ...currPkg.style, background: theme.intro } });
    }
  }, [
    activity.buttonPackageId,
    activity.buttonPackageScreen,
    activity.introScreen,
    patchIntro,
    patchPackage,
    theme.intro,
  ]);

  const handleSaveCurrentPreset = () => {
    const finalName =
      String(presetName || '').trim() || `${activity?.name || 'Yeni Tasarım'} Tasarımı`;
    const savedId = onSavePreset?.(finalName, activity);
    if (savedId) setSelectedPresetId(savedId);
  };

  const handleApplySelectedPreset = () => {
    if (!selectedPreset) return;
    onApplyPreset?.(selectedPreset.id, activity?.id);
  };

  const handleDeleteSelectedPreset = () => {
    if (!selectedPreset) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`"${selectedPreset.name}" tasarımını silmek istiyor musun?`)
    )
      return;
    onDeletePreset?.(selectedPreset.id);
    setSelectedPresetId('');
  };

  const inputBase = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 5,
    border: '1px solid #333',
    background: '#0f0f20',
    color: '#E0E0E0',
    fontSize: 11,
    boxSizing: 'border-box',
    outline: 'none',
  };
  const colorInput = (value, onChange, label) => (
    <div style={{ flex: 1, minWidth: 60 }}>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="color"
          value={value || '#000000'}
          onChange={onChange}
          style={{
            width: 28,
            height: 24,
            border: '1px solid #333',
            borderRadius: 4,
            padding: 0,
            cursor: 'pointer',
            background: 'transparent',
          }}
        />
        <input
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder="#hex"
          style={{ ...inputBase, flex: 1 }}
        />
      </div>
    </div>
  );
  const numInput = (value, onChange, label, min = 0, max = 999) => (
    <div style={{ flex: 1, minWidth: 50 }}>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={onChange}
        min={min}
        max={max}
        style={inputBase}
      />
    </div>
  );
  const textInput = (value, onChange, label, placeholder = '', rows) => (
    <div>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      {rows ? (
        <textarea
          value={value || ''}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          style={{ ...inputBase, resize: 'vertical' }}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={onChange}
          placeholder={placeholder}
          style={inputBase}
        />
      )}
    </div>
  );
  const selectInput = (value, onChange, label, options = []) => (
    <div>
      <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
        {label}
      </label>
      <select value={value ?? options?.[0]?.value ?? ''} onChange={onChange} style={inputBase}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const buttonAlignOptions = [
    { value: 'left', label: 'Sol' },
    { value: 'center', label: 'Orta' },
    { value: 'right', label: 'Sağ' },
    { value: 'split', label: 'İki Yana' },
  ];
  const buttonDirectionOptions = [
    { value: 'row', label: 'Yatay' },
    { value: 'column', label: 'Alt Alta' },
  ];
  const guideActionOptions = [
    { value: 'package', label: 'Tema paketini aç' },
    { value: 'menu', label: 'Menüye git' },
    { value: 'play', label: 'Oyuna git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const packageBackActionOptions = [
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı baştan başlat' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const menuButtonActionOptions = [
    { value: 'toggle-menu', label: 'Açılır menüyü aç/kapat' },
    { value: 'package', label: 'Tema paketini aç' },
    { value: 'menu', label: 'Menü ekranına git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const checkButtonActionOptions = [
    { value: 'check', label: 'Cevabı kontrol et' },
    { value: 'result', label: 'Sonuç ekranını aç' },
    { value: 'answer', label: 'Doğru cevabı göster' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const utilityActionOptions = [
    { value: 'answer', label: 'Doğru cevabı göster' },
    { value: 'play', label: 'Oyun ekranına dön' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const completeActionOptions = [
    { value: 'complete', label: 'Tamamla / sonraki adıma geç' },
    { value: 'play', label: 'Oyun ekranına git' },
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];
  const homeActionOptions = [
    { value: 'intro', label: 'Karşılama ekranı' },
    { value: 'menu', label: 'Menü ekranı' },
    { value: 'package', label: 'Tema paketi ekranı' },
    { value: 'play', label: 'Oyun ekranı' },
    { value: 'restart', label: 'Akışı sıfırla' },
    { value: 'none', label: 'Hiçbir şey yapma' },
  ];

  function SubTab({ id, label, icon, current, onClick }) {
    return (
      <button
        onClick={() => onClick(id)}
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          border: `1px solid ${current === id ? '#7C4DFF44' : '#252540'}`,
          background: current === id ? '#7C4DFF18' : 'transparent',
          color: current === id ? '#B388FF' : '#78909C',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 11 }}>{icon}</span>
        {label}
      </button>
    );
  }

  const sections = [
    {
      id: 'intro',
      label: 'Etkinlik Tanıtımı',
      icon: '🎬',
      color: '#B388FF',
      desc: 'Öğrencinin etkinliğe girdiğinde gördüğü ilk ekran.',
      enabled: intro.enabled !== false,
      onToggle: (v) => patchIntro({ enabled: v }),
      textFields: [
        {
          l: 'Başlık',
          v: intro.title || '',
          onChange: (e) => patchIntro({ title: e.target.value }),
          placeholder: 'Etkinliğe Hoş Geldin',
        },
        {
          l: 'Açıklama',
          v: intro.body || '',
          onChange: (e) => patchIntro({ body: e.target.value }),
          rows: 3,
          placeholder: 'Hazır olduğunda başla ve soruyu tamamla.',
        },
        {
          l: 'Buton Yazısı',
          v: intro.buttonText || '',
          onChange: (e) => patchIntro({ buttonText: e.target.value }),
          placeholder: 'Başla',
        },
      ],
      styleTarget: intro,
      stylePatch: patchIntro,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'package',
      label: 'Tema Paketi Tanıtımı',
      icon: '🎯',
      color: '#22d3ee',
      desc: 'Hazır tema renkleri, ikonlar ve tanıtım ekranı ayarları.',
      enabled: settings.showButtonPackageIntro !== false && packageScreen.enabled !== false,
      onToggle: (v) => {
        // Tek patch: iki ardisik onUpdate bayat activity yaydigindan ilk yazim kayboluyordu.
        patch({
          settings: { ...settings, showButtonPackageIntro: v },
          buttonPackageScreen: { ...packageScreen, enabled: v },
        });
      },
      textFields: [
        {
          l: 'Başlık',
          v: resolvedPackageTitle,
          onChange: (e) => patchPackage({ title: e.target.value }),
          placeholder: 'Tema Paketi Tanıtımı',
        },
        {
          l: 'Açıklama',
          v: resolvedPackageBody,
          onChange: (e) => patchPackage({ body: e.target.value }),
          rows: 3,
          placeholder: 'Etkinlikte kullanacağın tema paketini ve butonları incele.',
        },
        {
          l: 'İleri Butonu',
          v: packageScreen.buttonText || '',
          onChange: (e) => patchPackage({ buttonText: e.target.value }),
          placeholder: 'Menüye Geç',
        },
        {
          l: 'Geri Butonu',
          v: packageScreen.backButtonText || '',
          onChange: (e) => patchPackage({ backButtonText: e.target.value }),
          placeholder: 'Geri Dön',
        },
        ...packageItems.flatMap((item) => {
          const defaultLabel =
            DEFAULT_THEME_PACKAGE_ITEMS.find((entry) => entry.id === item.id)?.label ||
            item.label ||
            item.id;
          return [
            {
              l: `${defaultLabel} İkonu`,
              v: item.icon || '',
              onChange: (e) => patchPackageItem(item.id, { icon: e.target.value }),
              placeholder: item.icon || '★',
            },
            {
              l: `${defaultLabel} Başlığı`,
              v: item.label || '',
              onChange: (e) => patchPackageItem(item.id, { label: e.target.value }),
              placeholder: defaultLabel,
            },
            {
              l: `${defaultLabel} Açıklaması`,
              v: item.desc || '',
              onChange: (e) => patchPackageItem(item.id, { desc: e.target.value }),
              rows: 2,
              placeholder: item.desc || 'Açıklama',
            },
          ];
        }),
      ],
      styleTarget: packageScreen,
      stylePatch: patchPackage,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'menu',
      label: 'Menü Ekranı',
      icon: '📋',
      color: '#f59e0b',
      desc: 'Kuralların ve açıklamaların gösterildiği menü ekranı.',
      enabled: settings.showMenuScreen !== false && menuScreen.enabled !== false,
      onToggle: (v) => {
        // Tek patch: kayip guncellemeyi onlemek icin settings + menuScreen birlikte.
        patch({
          settings: { ...settings, showMenuScreen: v },
          menuScreen: { ...menuScreen, enabled: v },
        });
      },
      textFields: [
        {
          l: 'Başlık',
          v: menuScreen.title || '',
          onChange: (e) => patchMenu({ title: e.target.value }),
          placeholder: 'Etkinlik Menüsü',
        },
        {
          l: 'Açıklama',
          v: menuScreen.body || '',
          onChange: (e) => patchMenu({ body: e.target.value }),
          rows: 3,
          placeholder: 'Kuralları gözden geçir ve etkinliği başlat.',
        },
        {
          l: 'Buton Yazısı',
          v: menuScreen.buttonText || '',
          onChange: (e) => patchMenu({ buttonText: e.target.value }),
          placeholder: 'Etkinliğe Geç',
        },
      ],
      styleTarget: menuScreen,
      stylePatch: patchMenu,
      themeScreen: 'intro',
      hasButton: true,
    },
    {
      id: 'play',
      label: 'Oyun / Sahne',
      icon: '▶',
      color: '#60a5fa',
      desc: 'Etkinlik sırasında gösterilecek başlık ve açıklama.',
      textFields: [
        {
          l: 'Başlık',
          v: playScreen.title || '',
          onChange: (e) => patchPlay({ title: e.target.value }),
          placeholder: 'Sahne başlığı',
        },
        {
          l: 'Açıklama',
          v: playScreen.body || '',
          onChange: (e) => patchPlay({ body: e.target.value }),
          rows: 2,
          placeholder: 'Sahne açıklaması',
        },
      ],
      styleTarget: playScreen,
      stylePatch: patchPlay,
      themeScreen: 'play',
      hasButton: false,
    },
    {
      id: 'success',
      label: 'Doğru Cevap',
      icon: '✅',
      color: '#4ade80',
      desc: 'Öğrenci doğru cevap verdiğinde gösterilen ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: results.successTitle || '',
          onChange: (e) => patchResults({ successTitle: e.target.value }),
          placeholder: 'Harika!',
        },
        {
          l: 'Mesaj',
          v: results.successBody || '',
          onChange: (e) => patchResults({ successBody: e.target.value }),
          rows: 2,
          placeholder: 'Doğru cevabı buldun.',
        },
        {
          l: 'Devam Butonu',
          v: results.continueText || '',
          onChange: (e) => patchResults({ continueText: e.target.value }),
          placeholder: 'Devam Et',
        },
      ],
      styleTarget: results,
      stylePatch: patchResults,
      themeScreen: 'success',
      hasButton: true,
    },
    {
      id: 'failure',
      label: 'Yanlış Cevap',
      icon: '❌',
      color: '#f87171',
      desc: 'Öğrenci yanlış cevap verdiğinde gösterilen ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: results.failureTitle || '',
          onChange: (e) => patchResults({ failureTitle: e.target.value }),
          placeholder: 'Tekrar Deneyelim',
        },
        {
          l: 'Mesaj',
          v: results.failureBody || '',
          onChange: (e) => patchResults({ failureBody: e.target.value }),
          rows: 2,
          placeholder: 'Doğru cevaba biraz daha yakınsın.',
        },
        {
          l: 'Tekrar Dene Butonu',
          v: results.retryText || '',
          onChange: (e) => patchResults({ retryText: e.target.value }),
          placeholder: 'Tekrar Dene',
        },
      ],
      styleTarget: results,
      stylePatch: patchResults,
      themeScreen: 'failure',
      hasButton: true,
    },
    {
      id: 'answer',
      label: 'Cevap Ekranı',
      icon: '★',
      color: '#fbbf24',
      desc: 'Doğru cevap gösterildiğinde kullanılan ekran.',
      textFields: [
        {
          l: 'Başlık',
          v: answerScreen.title || '',
          onChange: (e) => patchAnswer({ title: e.target.value }),
          placeholder: 'Doğru Cevap',
        },
        {
          l: 'Açıklama',
          v: answerScreen.body || '',
          onChange: (e) => patchAnswer({ body: e.target.value }),
          rows: 2,
          placeholder: 'Sistem doğru cevabı gösteriyor.',
        },
        {
          l: 'Buton Yazısı',
          v: answerScreen.buttonText || '',
          onChange: (e) => patchAnswer({ buttonText: e.target.value }),
          placeholder: 'Yeniden Başlat',
        },
      ],
      styleTarget: answerScreen,
      stylePatch: patchAnswer,
      themeScreen: 'failure',
      hasButton: true,
    },
  ];

  const renderStyleEditor = (s) => {
    const st = s.styleTarget?.style || {};
    const patchStyle = (p) => s.stylePatch({ style: { ...st, ...p } });
    const defaultBg = theme[s.themeScreen] || theme.intro;
    const defaultText = theme.text;
    const defaultBtnBg = theme.button;
    const defaultBtnColor = theme.text;
    const defaultBtnBorder = theme.border;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          EKRAN ARKA PLANI
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {colorInput(
            st.background || '',
            (e) => patchStyle({ background: e.target.value }),
            'Arka Plan'
          )}
          {colorInput(
            st.textColor || '',
            (e) => patchStyle({ textColor: e.target.value }),
            'Metin Rengi'
          )}
        </div>
        <div style={{ fontSize: 11, color: '#546E7A' }}>
          Boş bırakılırsa tema varsayılanı kullanılır: {defaultBg.slice(0, 40)}...
        </div>

        <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          BAŞLIK STİLİ
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {numInput(
            st.titleFontSize,
            (e) => patchStyle({ titleFontSize: +e.target.value || 0 }),
            'Font Boyutu',
            10,
            120
          )}
          {numInput(
            st.titleFontWeight,
            (e) => patchStyle({ titleFontWeight: +e.target.value || 0 }),
            'Kalınlık',
            100,
            900
          )}
        </div>

        {s.hasButton && (
          <>
            <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
              BUTON GÖRÜNÜMLERİ
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {colorInput(
                st.buttonBackground || '',
                (e) => patchStyle({ buttonBackground: e.target.value }),
                'Buton Arkaplan'
              )}
              {colorInput(
                st.buttonColor || '',
                (e) => patchStyle({ buttonColor: e.target.value }),
                'Buton Yazı'
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {colorInput(
                st.buttonBorderColor || '',
                (e) => patchStyle({ buttonBorderColor: e.target.value }),
                'Buton Çerçeve'
              )}
              {numInput(
                st.buttonBorderRadius ?? '',
                (e) => patchStyle({ buttonBorderRadius: +e.target.value || 0 }),
                'Köşe Yvl.',
                0,
                999
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {numInput(
                st.buttonFontSize,
                (e) => patchStyle({ buttonFontSize: +e.target.value || 0 }),
                'Buton Font',
                8,
                60
              )}
              {numInput(
                st.buttonPaddingX,
                (e) => patchStyle({ buttonPaddingX: +e.target.value || 0 }),
                'Yatay Pad',
                0,
                100
              )}
              {numInput(
                st.buttonPaddingY,
                (e) => patchStyle({ buttonPaddingY: +e.target.value || 0 }),
                'Dikey Pad',
                0,
                100
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selectInput(
                st.buttonAlign || 'center',
                (e) => patchStyle({ buttonAlign: e.target.value }),
                'Buton Konumu',
                buttonAlignOptions
              )}
              {selectInput(
                st.buttonDirection || 'row',
                (e) => patchStyle({ buttonDirection: e.target.value }),
                'Buton Dizilimi',
                buttonDirectionOptions
              )}
              {numInput(
                st.buttonGap ?? 12,
                (e) => patchStyle({ buttonGap: +e.target.value || 0 }),
                'Buton Aralığı',
                0,
                60
              )}
            </div>
            <div style={{ fontSize: 11, color: '#546E7A' }}>
              Boş = tema varsayılanı ({defaultBtnBorder})
            </div>

            {/* Buton önizleme */}
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: '#0a0a1a',
                minHeight: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  padding: `${st.buttonPaddingY || 13}px ${st.buttonPaddingX || 28}px`,
                  borderRadius: st.buttonBorderRadius ?? 999,
                  border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
                  background: st.buttonBackground || defaultBtnBg,
                  color: st.buttonColor || defaultBtnColor,
                  fontSize: st.buttonFontSize || 14,
                  fontWeight: 800,
                  textAlign: 'center',
                  boxShadow: `0 8px 32px ${st.buttonBorderColor || defaultBtnBorder}44`,
                }}
              >
                {s.textFields.find((f) => f.l.includes('Buton'))?.v || 'Buton Önizleme'}
              </div>
            </div>
          </>
        )}

        <div style={{ width: '100%', height: 1, background: '#252540', margin: '4px 0' }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 2 }}>
          EKRAN GENEL
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {numInput(
            st.borderRadius ?? '',
            (e) => patchStyle({ borderRadius: +e.target.value || 0 }),
            'Panel Köşe',
            0,
            60
          )}
          {numInput(
            st.padding ?? '',
            (e) => patchStyle({ padding: +e.target.value || 0 }),
            'İç Boşluk',
            0,
            100
          )}
        </div>

        {/* Ekran Önizleme */}
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: '#0a0a1a',
            marginTop: 4,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: st.background || defaultBg,
              borderRadius: st.borderRadius || 16,
              padding: st.padding || 16,
              color: st.textColor || defaultText,
              minHeight: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <div
              style={{ fontSize: st.titleFontSize || 18, fontWeight: st.titleFontWeight || 800 }}
            >
              {s.textFields[0]?.v || 'Başlık Önizleme'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {s.textFields[1]?.v || 'Açıklama önizleme'}
            </div>
            {s.hasButton && (
              <div
                style={{
                  padding: `${st.buttonPaddingY || 13}px ${st.buttonPaddingX || 28}px`,
                  borderRadius: st.buttonBorderRadius ?? 999,
                  background: st.buttonBackground || defaultBtnBg,
                  color: st.buttonColor || defaultBtnColor,
                  fontSize: st.buttonFontSize || 14,
                  fontWeight: 800,
                  border: `1px solid ${st.buttonBorderColor || defaultBtnBorder}44`,
                  boxShadow: `0 8px 16px ${st.buttonBorderColor || defaultBtnBorder}44`,
                }}
              >
                {s.textFields.find((f) => f.l.includes('Buton'))?.v || 'Buton'}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => s.stylePatch({ style: {} })}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #ef4444',
            background: '#ef444418',
            color: '#f87171',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          Stilleri Sıfırla
        </button>
      </div>
    );
  };

  const renderSectionTextContent = (s) => {
    if (s.id !== 'package') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#78909C', marginBottom: 2 }}>{s.desc}</div>
          {s.textFields.map((f) => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: '#78909C', marginBottom: 2 }}>{s.desc}</div>
        <div
          style={{
            background: '#0a1020',
            border: '1px solid #23314f',
            borderRadius: 10,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#67e8f9' }}>TANITIM ALANI</div>
          {s.textFields
            .slice(0, 4)
            .map((f) => textInput(f.v, f.onChange, f.l, f.placeholder, f.rows))}
        </div>
        <div
          style={{
            background: '#0a1020',
            border: '1px solid #23314f',
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', marginBottom: 8 }}>
            TEMA KARTLARI
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 8,
            }}
          >
            {packageItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon || '✦'}</span>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>
                    {item.label || 'Kart'}
                  </div>
                </div>
                {textInput(
                  item.icon || '',
                  (e) => patchPackageItem(item.id, { icon: e.target.value }),
                  'İkon',
                  '★'
                )}
                {textInput(
                  item.label || '',
                  (e) => patchPackageItem(item.id, { label: e.target.value }),
                  'Başlık',
                  'Kart başlığı'
                )}
                {textInput(
                  item.desc || '',
                  (e) => patchPackageItem(item.id, { desc: e.target.value }),
                  'Açıklama',
                  'Kart açıklaması',
                  2
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const filteredSections = normalizedVisibleSectionIds.length
    ? sections.filter((section) => normalizedVisibleSectionIds.includes(section.id))
    : sections;
  const showBehaviorPanel =
    !normalizedVisibleSectionIds.length || normalizedVisibleSectionIds.includes('behavior');

  const renderBehavior = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          background: '#0a1020',
          border: '1px solid #24324d',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>TEMEL DAVRANIŞLAR</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Puanlama, deneme ve cevap görünürlüğü ayarları.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
            gap: 6,
          }}
        >
          <div style={{ minWidth: 80 }}>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Tamamlanma
            </label>
            <select
              value={settings.completionMode || 'required'}
              onChange={(e) => patchSettings({ completionMode: e.target.value })}
              style={inputBase}
            >
              <option value="required">Zorunlu</option>
              <option value="optional">İsteğe Bağlı</option>
            </select>
          </div>
          {numInput(
            settings.scorePoints ?? 10,
            (e) => patchSettings({ scorePoints: +e.target.value || 0 }),
            'Puan',
            0,
            1000
          )}
          {numInput(
            settings.maxAttempts ?? 0,
            (e) => patchSettings({ maxAttempts: Math.max(0, +e.target.value || 0) }),
            'Maks Deneme',
            0,
            100
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 6,
          }}
        >
          {[
            { key: 'shuffleOptions', label: 'Seçenekleri karıştır', color: '#a78bfa' },
            { key: 'showFeedback', label: 'Sonuç göster', color: '#60a5fa' },
            { key: 'allowRetry', label: 'Tekrar deneme izni', color: '#4ade80' },
            { key: 'showAnswerLayer', label: 'Cevap katmanı göster', color: '#fbbf24' },
          ].map((opt) => (
            <label
              key={opt.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#B0BEC5',
                cursor: 'pointer',
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(15,23,42,.55)',
                border: '1px solid #1f2a44',
              }}
            >
              <input
                type="checkbox"
                checked={!!settings[opt.key]}
                onChange={(e) => patchSettings({ [opt.key]: e.target.checked })}
                style={{ accentColor: opt.color }}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {textInput(
          settings.answerButtonText || '',
          (e) => patchSettings({ answerButtonText: e.target.value }),
          'Cevap Göster Butonu',
          'Cevabı Gör'
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd' }}>SORU RAPORLAMA</div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#B0BEC5',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={settings.questionGrading !== 'survey'}
              onChange={(e) =>
                patchSettings({ questionGrading: e.target.checked ? 'graded' : 'survey' })
              }
              style={{ accentColor: '#f59e0b' }}
            />
            Puanlı (Graded) — LMS'e puan gönder
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#B0BEC5',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!settings.reportPerQuestion}
              onChange={(e) => patchSettings({ reportPerQuestion: e.target.checked })}
              style={{ accentColor: '#22d3ee' }}
            />
            Her soru için ayrı LMS raporu (cmi.interactions)
          </label>
          {settings.reportPerQuestion && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {numInput(
                settings.pointsPerQuestion ?? 10,
                (e) => patchSettings({ pointsPerQuestion: +e.target.value || 0 }),
                'Soru Başı Puan',
                0,
                1000
              )}
              <div style={{ minWidth: 80 }}>
                <label
                  style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}
                >
                  Raporlama Tipi
                </label>
                <select
                  value={settings.lmsInteractionType || 'choice'}
                  onChange={(e) => patchSettings({ lmsInteractionType: e.target.value })}
                  style={inputBase}
                >
                  <option value="choice">Choice</option>
                  <option value="true-false">True-False</option>
                  <option value="fill-in">Fill-In</option>
                  <option value="matching">Matching</option>
                  <option value="sequencing">Sequencing</option>
                  <option value="numeric">Numeric</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #3b2b5a',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd' }}>AKIŞ YÖNLERİ</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Ekranlar arasında hangi adımın açılacağını seç.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 6,
          }}
        >
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Karşılama sonrası
            </label>
            <select
              value={settings.introNextPhase || 'auto'}
              onChange={(e) => patchSettings({ introNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="auto">Otomatik</option>
              <option value="package">Tema Paketi</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Tema sonrası
            </label>
            <select
              value={settings.packageNextPhase || 'auto'}
              onChange={(e) => patchSettings({ packageNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="auto">Otomatik</option>
              <option value="intro">Karşılama</option>
              <option value="menu">Menü</option>
              <option value="play">Oyun</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Menü sonrası
            </label>
            <select
              value={settings.menuNextPhase || 'play'}
              onChange={(e) => patchSettings({ menuNextPhase: e.target.value })}
              style={inputBase}
            >
              <option value="intro">Karşılama</option>
              <option value="package">Tema Paketi</option>
              <option value="play">Oyun</option>
            </select>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #234046',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5eead4' }}>BUTON YAZILARI</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Önizlemede görünen tüm buton metinlerini buradan değiştir.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 6,
          }}
        >
          {textInput(
            settings.guideButtonText || '',
            (e) => patchSettings({ guideButtonText: e.target.value }),
            'Tanıtım Butonu',
            'Tanıtım'
          )}
          {textInput(
            settings.menuButtonText || '',
            (e) => patchSettings({ menuButtonText: e.target.value }),
            'Menü Butonu',
            '☰ MENÜ'
          )}
          {textInput(
            settings.checkButtonText || '',
            (e) => patchSettings({ checkButtonText: e.target.value }),
            'Kontrol Butonu',
            'Kontrol Et'
          )}
          {textInput(
            settings.solutionButtonText || '',
            (e) => patchSettings({ solutionButtonText: e.target.value }),
            'Çözüm Butonu',
            'Çözümü Göster'
          )}
          {textInput(
            settings.restartFlowText || '',
            (e) => patchSettings({ restartFlowText: e.target.value }),
            'Yeniden Başlat',
            'Yeniden Başlat'
          )}
          {textInput(
            settings.completeButtonText || '',
            (e) => patchSettings({ completeButtonText: e.target.value }),
            'Tamamlama Butonu',
            'Tamamla'
          )}
          {textInput(
            settings.homeButtonText || '',
            (e) => patchSettings({ homeButtonText: e.target.value }),
            'Ana Sayfa',
            'Ana Sayfa'
          )}
          {textInput(
            settings.soundOnText || '',
            (e) => patchSettings({ soundOnText: e.target.value }),
            'Ses Aç Metni',
            'Sesi Aç'
          )}
          {textInput(
            settings.soundOffText || '',
            (e) => patchSettings({ soundOffText: e.target.value }),
            'Ses Kapat Metni',
            'Sesi Kapat'
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #4c2f4e',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f9a8d4' }}>BUTON GÖREVLERİ</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Butona basılınca hangi ekranın veya görevin açılacağını seç.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 6,
          }}
        >
          {selectInput(
            settings.guideButtonAction || 'package',
            (e) => patchSettings({ guideButtonAction: e.target.value }),
            'Tanıtım / Kılavuz',
            guideActionOptions
          )}
          {selectInput(
            settings.packageBackAction || 'intro',
            (e) => patchSettings({ packageBackAction: e.target.value }),
            'Tema Geri Butonu',
            packageBackActionOptions
          )}
          {selectInput(
            settings.menuButtonAction || 'toggle-menu',
            (e) => patchSettings({ menuButtonAction: e.target.value }),
            'Oyun Menü Butonu',
            menuButtonActionOptions
          )}
          {selectInput(
            settings.checkButtonAction || 'check',
            (e) => patchSettings({ checkButtonAction: e.target.value }),
            'Kontrol Butonu',
            checkButtonActionOptions
          )}
          {selectInput(
            settings.solutionButtonAction || 'answer',
            (e) => patchSettings({ solutionButtonAction: e.target.value }),
            'Çözüm Butonu',
            utilityActionOptions
          )}
          {selectInput(
            settings.restartButtonAction || 'restart',
            (e) => patchSettings({ restartButtonAction: e.target.value }),
            'Yeniden Başlat',
            packageBackActionOptions
          )}
          {selectInput(
            settings.completeButtonAction || 'complete',
            (e) => patchSettings({ completeButtonAction: e.target.value }),
            'Tamamla Butonu',
            completeActionOptions
          )}
          {selectInput(
            settings.answerButtonAction || 'restart',
            (e) => patchSettings({ answerButtonAction: e.target.value }),
            'Cevap Ekranı Butonu',
            utilityActionOptions
          )}
          {selectInput(
            settings.homeButtonAction || 'intro',
            (e) => patchSettings({ homeButtonAction: e.target.value }),
            'Ana Sayfa Menüsü',
            homeActionOptions
          )}
        </div>
      </div>

      <div
        style={{
          background: '#0a1020',
          border: '1px solid #223a58',
          borderRadius: 10,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>TEMA PAKETLERİ</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Butonların renk ve genel görünüm kalıpları.
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#bfdbfe',
              background: 'rgba(59,130,246,.14)',
              border: '1px solid rgba(96,165,250,.3)',
              borderRadius: 999,
              padding: '3px 8px',
            }}
          >
            {BUTTON_PACKAGES.length} hazır kalıp
          </span>
        </div>
        {/* Sınıf grubu filtre sekmesi */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'Tümü', icon: '📚', color: '#94a3b8' }, ...GRADE_GROUPS].map(
            (g) => {
              const isActive = pkgGradeFilter === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setPkgGradeFilter(g.id)}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: `1px solid ${isActive ? g.color || '#60a5fa' : '#2b3655'}`,
                    background: isActive ? `${g.color || '#60a5fa'}22` : 'transparent',
                    color: isActive ? g.color || '#60a5fa' : '#64748b',
                    fontSize: 11,
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {g.icon} {g.label}
                </button>
              );
            }
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 8,
            maxHeight: 320,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {(pkgGradeFilter === 'all'
            ? BUTTON_PACKAGES
            : BUTTON_PACKAGES.filter((pkg) => pkg.gradeGroup === pkgGradeFilter)
          ).map((pkg) => {
            const pkgTheme = getPackageTheme(pkg.id);
            const isActive = activity.buttonPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => {
                  const defaultProfileId =
                    pkg.animationProfileId || activity.buttonAnimationProfileId || 'calmLift';
                  onUpdate(
                    restyleActivityButtonsForPackage(
                      { ...activity, buttonAnimationProfileId: defaultProfileId },
                      pkg.id
                    )
                  );
                }}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: `1px solid ${isActive ? pkg.color : '#2b3655'}`,
                  background: isActive
                    ? `linear-gradient(135deg, ${pkg.color}30, rgba(15,23,42,.92))`
                    : 'linear-gradient(135deg,#111125,#0b1120)',
                  color: '#e2e8f0',
                  boxShadow: isActive ? `0 12px 24px ${pkg.color}22` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{pkg.icon || '✦'}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: isActive ? '#ffffff' : pkg.color,
                      background: isActive ? 'rgba(255,255,255,.18)' : `${pkg.color}18`,
                      borderRadius: 999,
                      padding: '3px 6px',
                    }}
                  >
                    {pkg.trigger}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    marginTop: 8,
                    color: isActive ? '#ffffff' : '#f8fafc',
                  }}
                >
                  {pkg.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    lineHeight: 1.45,
                    color: isActive ? 'rgba(255,255,255,.82)' : '#94a3b8',
                    marginTop: 4,
                  }}
                >
                  {pkg.desc || `${pkg.trigger} · ${pkg.anim}`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      background: pkgTheme.button,
                      color: pkgTheme.text,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    ▶ Başlat
                  </span>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: `1px solid ${pkgTheme.border}66`,
                      color: pkgTheme.border,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ✓ Kontrol
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #263854',
            borderRadius: 10,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>BUTON ANİMASYONU</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Etkinlikteki tüm butonlar aynı animasyonu kullanır.
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
              gap: 6,
            }}
          >
            {Object.entries(BUTTON_PACKAGE_MOTION_PRESETS).map(([profileId, motion]) => {
              const labels = {
                calmLift: 'Sakin Yükselme',
                focusLift: 'Net Odak',
                softBreath: 'Hafif Nefes',
                steadyPress: 'Kararlı Basış',
                horizontalFlow: 'Yatay Akış',
              };
              const isActive =
                (activity.buttonAnimationProfileId ||
                  BUTTON_PACKAGES.find((p) => p.id === activity.buttonPackageId)
                    ?.animationProfileId ||
                  'calmLift') === profileId;
              return (
                <button
                  key={profileId}
                  onClick={() => onUpdate(restyleActivityButtonMotion(activity, profileId))}
                  style={{
                    padding: '8px 9px',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? '#60a5fa' : '#2b3655'}`,
                    background: isActive
                      ? 'linear-gradient(135deg,#1e3a8a,#0f172a)'
                      : 'linear-gradient(135deg,#111827,#0b1120)',
                    color: isActive ? '#eff6ff' : '#cbd5e1',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900 }}>
                    {labels[profileId] || profileId}
                  </div>
                  <div
                    style={{ fontSize: 10, color: isActive ? '#bfdbfe' : '#64748b', marginTop: 3 }}
                  >
                    {motion.duration}ms · {Number(motion.hoverScale || 1).toFixed(3)}x
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#546E7A' }}>
          Seçili tema: {BUTTON_PACKAGES.find((p) => p.id === activity.buttonPackageId)?.name || '?'}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        paddingRight: 6,
        scrollbarGutter: 'stable',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 2,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B388FF', marginBottom: 2 }}>
            EKRAN DÜZENLEYİCİ
          </div>
          <div style={{ fontSize: 11, color: '#78909C', lineHeight: 1.4 }}>
            {sectionTitle
              ? `${sectionTitle} alanını düzenliyorsun. Alt bölümden ilgili ayarları açıp değiştirebilirsin.`
              : 'Tüm ekranların metinlerini, butonlarını ve görünümlerini düzenle.'}
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof window === 'undefined') return;
            const url = `${window.location.pathname}${window.location.search}#text-studio`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #7C4DFF44',
            background: '#7C4DFF18',
            color: '#B388FF',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Yeni Sekmede Aç
        </button>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg,#111827,#0f172a)',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>
              TASARIM KÜTÜPHANESİ
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Bu alandaki metin + görünüm ayarlarını proje içinde kaydet ve başka etkinliklere
              uygula.
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#bfdbfe',
              background: 'rgba(59,130,246,.14)',
              border: '1px solid rgba(96,165,250,.3)',
              borderRadius: 999,
              padding: '4px 8px',
            }}
          >
            {designPresets.length} kayıtlı tasarım
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 8 }}>
          {textInput(
            presetName,
            (e) => setPresetName(e.target.value),
            'Tasarım Adı',
            'Örn. Kurumsal Mavi'
          )}
          <div>
            <label style={{ fontSize: 11, color: '#78909C', display: 'block', marginBottom: 2 }}>
              Kayıtlı Tasarımlar
            </label>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              style={inputBase}
            >
              <option value="">Tasarım seç...</option>
              {designPresets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={handleSaveCurrentPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #22c55e',
              background: 'rgba(34,197,94,.12)',
              color: '#86efac',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Tasarımı Kaydet
          </button>
          <button
            onClick={handleApplySelectedPreset}
            disabled={!selectedPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #60a5fa',
              background: selectedPreset ? 'rgba(59,130,246,.12)' : 'rgba(51,65,85,.5)',
              color: selectedPreset ? '#bfdbfe' : '#64748b',
              fontSize: 11,
              fontWeight: 800,
              cursor: selectedPreset ? 'pointer' : 'default',
              opacity: selectedPreset ? 1 : 0.7,
            }}
          >
            Seçileni Uygula
          </button>
          <button
            onClick={handleDeleteSelectedPreset}
            disabled={!selectedPreset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #ef4444',
              background: selectedPreset ? 'rgba(239,68,68,.12)' : 'rgba(51,65,85,.5)',
              color: selectedPreset ? '#fca5a5' : '#64748b',
              fontSize: 11,
              fontWeight: 800,
              cursor: selectedPreset ? 'pointer' : 'default',
              opacity: selectedPreset ? 1 : 0.7,
            }}
          >
            Tasarımı Sil
          </button>
        </div>

        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
          {selectedPreset
            ? `Seçili şablon: ${selectedPreset.name} · Son güncelleme ${new Date(selectedPreset.updatedAt || selectedPreset.createdAt).toLocaleString('tr-TR')}`
            : 'Kaydettiğin tasarımlar burada listelenir; aynı tasarımı farklı etkinliklerde tek tıkla çağırabilirsin.'}
        </div>
      </div>

      {filteredSections.map((s) => {
        const isOpen = openSection === s.id;
        return (
          <div
            key={s.id}
            style={{
              background: isOpen ? '#0d0d1f' : '#111125',
              border: `1px solid ${isOpen ? s.color + '44' : '#252540'}`,
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'all .2s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                background: isOpen ? `${s.color}0a` : 'transparent',
              }}
              onClick={() => {
                setOpenSection(isOpen ? null : s.id);
                setOpenSub('text');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</div>
                  {!isOpen && (
                    <div style={{ fontSize: 11, color: '#78909C', marginTop: 1 }}>{s.desc}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.onToggle && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: '#78909C',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => s.onToggle(e.target.checked)}
                      style={{ accentColor: s.color }}
                    />
                    Aktif
                  </label>
                )}
                <span
                  style={{
                    color: '#546E7A',
                    fontSize: 12,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform .2s',
                  }}
                >
                  ▼
                </span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: '4px 12px 12px' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <SubTab
                    id="text"
                    label="Metinler"
                    icon="T"
                    current={openSub}
                    onClick={setOpenSub}
                  />
                  <SubTab
                    id="style"
                    label="Görünüm"
                    icon="🎨"
                    current={openSub}
                    onClick={setOpenSub}
                  />
                  {s.id === 'intro' && (
                    <SubTab
                      id="behavior"
                      label="Davranış"
                      icon="⚙"
                      current={openSub}
                      onClick={setOpenSub}
                    />
                  )}
                </div>

                <div
                  style={{
                    maxHeight:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior'
                        ? 'min(62vh, 760px)'
                        : 'none',
                    overflowY:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior'
                        ? 'auto'
                        : 'visible',
                    paddingRight:
                      ['package', 'behavior'].includes(s.id) || openSub === 'behavior' ? 6 : 0,
                    scrollbarGutter: 'stable',
                    overscrollBehavior: 'contain',
                  }}
                >
                  {openSub === 'text' && renderSectionTextContent(s)}

                  {openSub === 'style' && renderStyleEditor(s)}
                  {openSub === 'behavior' && s.id === 'intro' && renderBehavior()}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showBehaviorPanel && (
        <div
          style={{
            background: '#111125',
            border: '1px solid #252540',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => {
              setOpenSection(openSection === 'behavior' ? null : 'behavior');
              setOpenSub('behavior');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚙</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Genel Ayarlar</div>
                {openSection !== 'behavior' && (
                  <div style={{ fontSize: 11, color: '#78909C', marginTop: 1 }}>
                    Puan, deneme, buton yazıları ve görev seçenekleri.
                  </div>
                )}
              </div>
            </div>
            <span
              style={{
                color: '#546E7A',
                fontSize: 12,
                transform: openSection === 'behavior' ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform .2s',
              }}
            >
              ▼
            </span>
          </div>
          {openSection === 'behavior' && (
            <div
              style={{
                padding: '4px 12px 12px',
                maxHeight: 'min(62vh, 760px)',
                overflowY: 'auto',
                paddingRight: 6,
                scrollbarGutter: 'stable',
                overscrollBehavior: 'contain',
              }}
            >
              {renderBehavior()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActivityTextEditor;
