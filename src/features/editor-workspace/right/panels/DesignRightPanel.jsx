import { useMemo, useState } from 'react';

import FontPicker from '../../../../components/ribbon/FontPicker';
import {
  ANSWER_LAYER_STYLE_PRESETS,
  BUTTON_PACKAGE_MOTION_PRESETS,
  GRADE_GROUPS,
} from '../../../../constants';
import { generateAnswerObjectsForActivity } from '../../../../logic/activityObjectGenerators';
import {
  ensureAnswerSceneLayerSet,
  ensureSceneTemplateSlide,
  SCENE_TEMPLATE_BUTTON_INTRO_ID,
  SCENE_TEMPLATE_LAUNCH_PAGE_ID,
} from '../../../../logic/activityTemplateGenerators';
import {
  applyContentLanguageToActivity,
  getActivityContentLanguage,
} from '../../../../logic/contentLanguage';
import { applyGeneratedThemeToActivity } from '../../../../logic/themeApplication';

import {
  ActionButton,
  ButtonGrid,
  ColorInput,
  EmptyHint,
  FieldLabel,
  NativeSelect,
  NumberInput,
  PanelCard,
  PanelShell,
  PanelTabs,
  PreviewTile,
  TextInput,
  TileGrid,
  inspectorChrome,
} from './PanelPrimitives';

const tabs = [
  { id: 'styles', label: 'Stiller' },
  { id: 'themes', label: 'Tema' },
  { id: 'buttons', label: 'Buton Setleri' },
  { id: 'answers', label: 'Cevap' },
];

const motionLabels = {
  calmLift: 'Sakin Yükselme',
  focusLift: 'Net Odak',
  softBreath: 'Hafif Nefes',
  steadyPress: 'Kararlı Basış',
  horizontalFlow: 'Yatay Akış',
};

const gradeFilters = [{ id: 'all', label: 'Tümü', color: '#64748b' }, ...GRADE_GROUPS];
const buttonFontWeights = [
  { value: '', label: 'Temaya bırak' },
  { value: '500', label: '500 Orta' },
  { value: '600', label: '600 Yarı kalın' },
  { value: '700', label: '700 Kalın' },
  { value: '800', label: '800 Ekstra' },
  { value: '900', label: '900 Siyah' },
  { value: '950', label: '950 Yoğun' },
];

const contentLanguageHints = {
  tr: 'Hazır butonlar, tanıtım ekranları, menü metinleri ve otomatik cevap katmanları seçilen dile göre üretilir.',
  en: 'Ready buttons, intro screens, menu texts and automatic answer layers are generated in the selected language.',
  de: 'Fertige Buttons, Introseiten, Menütexte und automatische Antwort-Layer werden in der ausgewählten Sprache erzeugt.',
};

function extractHexColors(...values) {
  return values
    .flatMap((value) => String(value || '').match(/#[0-9a-f]{6}/gi) || [])
    .slice(0, 3);
}

function answerPresetColors(preset) {
  const colors = extractHexColors(
    preset?.accentGradient,
    preset?.successGradient,
    preset?.neutralGradient,
    preset?.surfaceBorder
  );
  return colors.length ? colors : ['#2563eb', '#60a5fa', '#eff6ff'];
}

function ThemePreview({ preset }) {
  const colors = answerPresetColors(preset);
  const accent = preset?.accentGradient || colors[0] || inspectorChrome.blue;
  const success = preset?.successGradient || colors[1] || '#22c55e';
  const danger = preset?.dangerGradient || '#ef4444';
  const surface = preset?.surface || '#ffffff';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: '28px auto',
        gap: 5,
      }}
    >
      <div
        style={{
          border: `1px solid ${preset?.surfaceBorder || '#dbeafe'}`,
          borderRadius: 6,
          background: surface,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.72)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
          padding: 4,
        }}
      >
        <span style={{ borderRadius: 5, background: accent }} />
        <span style={{ borderRadius: 5, background: success }} />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[colors[0], colors[1], colors[2], danger].filter(Boolean).map((color) => (
          <span
            key={color}
            style={{
              width: 15,
              height: 15,
              borderRadius: 5,
              background: color,
              border: '1px solid rgba(15,23,42,.12)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ReadyButtonPreview({ preset, themeColor }) {
  const toneMap = {
    danger: '#ef4444',
    info: '#06b6d4',
    neutral: '#334155',
    primary: '#2563eb',
    success: '#16a34a',
    warning: '#f59e0b',
  };
  const tone =
    preset?.tone === 'theme'
      ? themeColor || inspectorChrome.blue
      : toneMap[preset?.tone] || inspectorChrome.blue;
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: tone,
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 950,
          flex: '0 0 auto',
        }}
      >
        {preset?.icon || '?'}
      </span>
      <span
        style={{
          minWidth: 0,
          height: 22,
          borderRadius: 7,
          background: `${tone}12`,
          border: `1px solid ${tone}40`,
          color: tone,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 7px',
          fontSize: 9,
          fontWeight: 900,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {preset?.label || 'Buton'}
      </span>
    </div>
  );
}

function FilterChips({ items, onChange, value }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map((item) => {
        const active = value === item.id;
        const tone = item.color || inspectorChrome.blue;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              height: 24,
              borderRadius: 999,
              border: `1px solid ${active ? tone : inspectorChrome.border}`,
              background: active ? `${tone}14` : '#ffffff',
              color: active ? tone : inspectorChrome.muted,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: active ? 900 : 760,
              padding: '0 8px',
              maxWidth: 92,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DesignRightPanel({ controller, inspectorProps }) {
  const [activeTab, setActiveTab] = useState('styles');
  const [themeGradeFilter, setThemeGradeFilter] = useState('all');
  const [presetName, setPresetName] = useState('1 Seti');
  const [selectedLayerPresetId, setSelectedLayerPresetId] = useState(
    inspectorProps?.layerPresets?.[0]?.id || ''
  );
  const activity = controller.activity || {};
  const commands = controller.commands || {};
  const galleries = controller.galleries || {};
  const layerPresets = inspectorProps?.layerPresets || [];
  const buttonPackages = useMemo(() => galleries.buttonPackages || [], [galleries.buttonPackages]);
  const readyButtons = useMemo(() => galleries.readyButtons || [], [galleries.readyButtons]);
  const filteredThemePresets = useMemo(
    () =>
      themeGradeFilter === 'all'
        ? ANSWER_LAYER_STYLE_PRESETS
        : ANSWER_LAYER_STYLE_PRESETS.filter((preset) => preset.gradeGroup === themeGradeFilter),
    [themeGradeFilter]
  );
  const rawCurrentAnswerPresetId =
    activity.answerLayerStylePresetId ||
    inspectorProps?.bookDefaultStylePresetId ||
    ANSWER_LAYER_STYLE_PRESETS[0]?.id ||
    '';
  const currentAnswerPresetId = ANSWER_LAYER_STYLE_PRESETS.some(
    (item) => item.id === rawCurrentAnswerPresetId
  )
    ? rawCurrentAnswerPresetId
    : ANSWER_LAYER_STYLE_PRESETS[0]?.id || '';
  const currentAnswerPreset =
    ANSWER_LAYER_STYLE_PRESETS.find((item) => item.id === currentAnswerPresetId) ||
    ANSWER_LAYER_STYLE_PRESETS[0];
  const activeMotionProfile =
    activity.buttonAnimationProfileId ||
    buttonPackages.find((item) => item.id === activity.buttonPackageId)?.animationProfileId ||
    'calmLift';
  const contentLanguageOptions =
    galleries.contentLanguages || [
      { value: 'tr', label: 'Türkçe' },
      { value: 'en', label: 'English' },
      { value: 'de', label: 'Deutsch' },
    ];
  const currentContentLanguage =
    controller.currentContentLanguage || getActivityContentLanguage(activity);
  const contentLanguageHint =
    contentLanguageHints[currentContentLanguage] || contentLanguageHints.tr;
  const hasReadyButtonFontOverride =
    !!activity.readyButtonFontFamily ||
    !!activity.readyButtonFontSize ||
    !!activity.readyButtonFontWeight;

  const patchActivity = (patch) => commands.patchActivity?.(patch);

  const applyContentLanguage = (lang) => {
    if (!activity) return;
    controller.onUpdateActivity?.(applyContentLanguageToActivity(activity, lang));
  };

  const applyThemePreset = (presetId) => {
    if (!activity) return;
    inspectorProps?.onSetBookDefaultStylePreset?.(presetId);
    controller.onUpdateActivity?.(applyGeneratedThemeToActivity(activity, presetId));
  };

  // Tüm hazır butonların yazı sistemini ayarla; boş = temadan gelen varsayılan.
  // Tek kaynak controller komutu (ribbon ile ortak); eski projeler için yerel fallback.
  const applyReadyButtonTypography = (patch = {}) => {
    if (!activity) return;
    if (commands.applyReadyButtonTypography) {
      commands.applyReadyButtonTypography(patch);
      return;
    }
    const nextActivity = { ...activity };
    if (Object.prototype.hasOwnProperty.call(patch, 'textColor')) {
      nextActivity.readyButtonTextColor = patch.textColor || '';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'fontFamily')) {
      nextActivity.readyButtonFontFamily = patch.fontFamily || '';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'fontSize')) {
      const value = Number(patch.fontSize);
      nextActivity.readyButtonFontSize = Number.isFinite(value) && value > 0 ? Math.round(value) : '';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'fontWeight')) {
      const value = Number(patch.fontWeight);
      nextActivity.readyButtonFontWeight =
        Number.isFinite(value) && value > 0 ? Math.round(value / 50) * 50 : '';
    }
    controller.onUpdateActivity?.(applyGeneratedThemeToActivity(nextActivity, currentAnswerPresetId));
  };

  const applyReadyButtonTextColor = (color) => {
    applyReadyButtonTypography({ textColor: color || '' });
  };

  const generateAnswerObjects = () => {
    if (!activity) return;
    controller.onUpdateActivity?.({ ...activity, objects: generateAnswerObjectsForActivity(activity) });
  };

  const generateAnswerSceneSet = () => {
    if (!activity) return;
    controller.onUpdateActivity?.(ensureAnswerSceneLayerSet(activity));
  };

  const generateSceneTemplateSlide = (templateId) => {
    if (!activity) return;
    controller.onUpdateActivity?.(
      ensureSceneTemplateSlide(activity, templateId, { forceRebuildGenerated: true })
    );
  };

  return (
    <PanelShell title="Stiller" subtitle="Tema, buton ve cevap katmanı görünümü.">
      <PanelTabs active={activeTab} onChange={setActiveTab} tabs={tabs} />

      {activeTab === 'styles' && (
        <>
          <PanelCard title="1. Hızlı stil kartları" collapsible>
            <TileGrid
              actions={[
                {
                  label: 'Kart Stili',
                  description: 'Yumuşak gölgeli kart tasarımı',
                  icon: '▤',
                  onClick: () => commands.setRibbonTab?.('object-format'),
                },
                {
                  label: 'Panel Stili',
                  description: 'Hafif arka planlı panel tasarımı',
                  icon: '▣',
                  onClick: () => commands.setRibbonTab?.('object-format'),
                },
                {
                  label: 'İçerik Kutusu',
                  description: 'İçerik alanları için stil',
                  icon: '▥',
                  onClick: () => commands.insertComponent?.('info-box'),
                },
                {
                  label: 'Vurgu Stili',
                  description: 'Öne çıkan alanlar için stil',
                  icon: '!',
                  tone: '#7c3aed',
                  onClick: () => commands.insertComponent?.('warning-box'),
                },
              ]}
            />
          </PanelCard>

          <PanelCard title="2. Renk ve temel görünüm" collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <FieldLabel>
                  Arka plan
                  <ColorInput
                    value={activity.backgroundColor || '#ffffff'}
                    onChange={(value) => patchActivity({ backgroundColor: value })}
                  />
                </FieldLabel>
                <FieldLabel>
                  Tema
                  <NativeSelect
                    value={currentAnswerPresetId}
                    options={ANSWER_LAYER_STYLE_PRESETS.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    onChange={applyThemePreset}
                  />
                </FieldLabel>
              </div>
              <ButtonGrid
                actions={[
                  { label: 'Nesne Biçimi', onClick: () => commands.setRibbonTab?.('object-format') },
                  { label: 'Sahne Şablonu', onClick: () => commands.setRibbonTab?.('scene') },
                ]}
              />
            </div>
          </PanelCard>

          <PanelCard title="3. Master ve buton şablonları" collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <ButtonGrid
                actions={[
                  {
                    label: 'Master Editörü',
                    onClick: () => commands.openMasterEditor?.(),
                    tone: '#2563eb',
                  },
                  {
                    label: 'Düzeni Uygula',
                    onClick: () => commands.applyMasterLayoutObjects?.(),
                    disabled: !activity?.slideMasterId,
                  },
                  ...(galleries.buttonStyles || []).map((style) => ({
                    label: style.label,
                    onClick: () => commands.insertButtonPreset?.(style.id),
                  })),
                ]}
              />
              <EmptyHint>
                Master, tüm sahnelerin ortak zemin/düzenini belirler; buton şablonları sahneye
                hazır stilli buton ekler.
              </EmptyHint>
            </div>
          </PanelCard>

          <PanelCard title="4. Otomatik içerik dili" collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <FieldLabel>
                Üretim dili
                <NativeSelect
                  value={currentContentLanguage}
                  options={contentLanguageOptions}
                  onChange={applyContentLanguage}
                />
              </FieldLabel>
              <EmptyHint>{contentLanguageHint}</EmptyHint>
            </div>
          </PanelCard>

          <PanelCard title="5. Hazır sahne üretimi" collapsible>
            <ButtonGrid
              actions={[
                {
                  label: 'Etkinlik Girişi Oluştur',
                  onClick: () => generateSceneTemplateSlide(SCENE_TEMPLATE_LAUNCH_PAGE_ID),
                  tone: '#2563eb',
                },
                {
                  label: 'Etkinlik Tanıtımı Oluştur',
                  onClick: () => generateSceneTemplateSlide(SCENE_TEMPLATE_BUTTON_INTRO_ID),
                  tone: '#7c3aed',
                },
                {
                  label: 'Cevap Sahne Seti Oluştur',
                  onClick: generateAnswerSceneSet,
                  tone: '#16a34a',
                },
              ]}
            />
          </PanelCard>
        </>
      )}

      {activeTab === 'themes' && (
        <>
          <PanelCard title={`Canlı eğitsel temalar (${filteredThemePresets.length}/${ANSWER_LAYER_STYLE_PRESETS.length})`} collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <FilterChips items={gradeFilters} value={themeGradeFilter} onChange={setThemeGradeFilter} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
                {filteredThemePresets.map((preset) => (
                  <PreviewTile
                    key={preset.id}
                    label={preset.name}
                    active={currentAnswerPresetId === preset.id}
                    onClick={() => applyThemePreset(preset.id)}
                    tone={answerPresetColors(preset)[0] || inspectorChrome.blue}
                  >
                    <ThemePreview preset={preset} />
                    <div style={{ color: '#64748b', fontSize: 9.5, fontWeight: 760, marginTop: 5 }}>
                      {preset.desc || 'Giriş, tanıtım, buton ve cevap alanları'}
                    </div>
                  </PreviewTile>
                ))}
              </div>
            </div>
          </PanelCard>
          <PanelCard title="Tema kapsamı" collapsible>
            <EmptyHint>
              Seçilen tema giriş ekranı, tanıtım ekranı, hazır butonlar, menü/layer butonları ve
              cevap nesnelerine birlikte uygulanır.
            </EmptyHint>
          </PanelCard>
        </>
      )}

      {activeTab === 'buttons' && (
        <>
          <PanelCard title="Buton yazısı" collapsible allowOverflow>
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Hızlı renkler: doğrudan uygular — color input'un "değer değişmedi"
                  tuzağına (boşken beyaz görünüp beyaz seçilememesi) takılmaz. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {[
                  ['#ffffff', 'Beyaz'],
                  ['#0f172a', 'Siyah'],
                  ['#fde047', 'Sarı'],
                  ['#2563eb', 'Mavi'],
                  ['#16a34a', 'Yeşil'],
                  ['#ef4444', 'Kırmızı'],
                ].map(([color, name]) => {
                  const isActive =
                    String(activity.readyButtonTextColor || '').toLowerCase() === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyReadyButtonTextColor(color)}
                      title={`Buton yazı rengi: ${name}`}
                      aria-label={`Buton yazı rengi: ${name}`}
                      aria-pressed={isActive}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: '1px solid #cbd5e1',
                        outline: isActive ? '2px solid #2563eb' : 'none',
                        outlineOffset: 1,
                        background: color,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Boş durum sentinel'i #fefefe: beyazla çakışmaz → picker'dan beyaz
                    seçimi de onChange tetikler. */}
                <div style={{ width: 40, flexShrink: 0 }}>
                  <ColorInput
                    ariaLabel="Buton yazı rengi (özel)"
                    value={activity.readyButtonTextColor || '#fefefe'}
                    onChange={(value) => applyReadyButtonTextColor(value)}
                  />
                </div>
                <span style={{ fontSize: 11, color: '#64748b', flex: 1, minWidth: 0 }}>
                  {activity.readyButtonTextColor || 'Temadan (varsayılan)'}
                </span>
                {activity.readyButtonTextColor ? (
                  <button
                    type="button"
                    onClick={() => applyReadyButtonTextColor('')}
                    aria-label="Buton yazı rengini temaya bırak"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#2563eb',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Temaya bırak
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                <FieldLabel>
                  Toplu font ailesi
                  <FontPicker
                    value={activity.readyButtonFontFamily || ''}
                    onChange={(font) => applyReadyButtonTypography({ fontFamily: font })}
                    emptyLabel="Temaya bırak"
                    width="100%"
                  />
                </FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 7 }}>
                  <FieldLabel>
                    Toplu punto
                    <NumberInput
                      value={activity.readyButtonFontSize || 15}
                      min={10}
                      max={32}
                      step={1}
                      title="Hazır buton punto değeri"
                      onChange={(value) => applyReadyButtonTypography({ fontSize: value })}
                    />
                  </FieldLabel>
                  <FieldLabel>
                    Toplu kalınlık
                    <NativeSelect
                      value={String(activity.readyButtonFontWeight || '')}
                      options={buttonFontWeights}
                      onChange={(value) => applyReadyButtonTypography({ fontWeight: value })}
                    />
                  </FieldLabel>
                </div>
                {hasReadyButtonFontOverride ? (
                  <button
                    type="button"
                    onClick={() =>
                      applyReadyButtonTypography({
                        fontFamily: '',
                        fontSize: '',
                        fontWeight: '',
                      })
                    }
                    aria-label="Buton font ayarlarını temaya bırak"
                    style={{
                      justifySelf: 'start',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#2563eb',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Fontu temaya bırak
                  </button>
                ) : null}
              </div>
            </div>
          </PanelCard>
          <PanelCard title={`Hazır butonlar (${readyButtons.length})`} collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
                {readyButtons.map((preset) => (
                  <PreviewTile
                    key={preset.id}
                    label={preset.label}
                    onClick={() => commands.insertReadyButton?.(preset.id)}
                    tone={
                      preset.tone === 'success'
                        ? '#16a34a'
                        : preset.tone === 'danger'
                          ? '#ef4444'
                          : preset.tone === 'theme'
                            ? answerPresetColors(currentAnswerPreset)[0] || inspectorChrome.blue
                            : inspectorChrome.blue
                    }
                  >
                    <ReadyButtonPreview
                      preset={preset}
                      themeColor={answerPresetColors(currentAnswerPreset)[0]}
                    />
                    <div style={{ color: '#64748b', fontSize: 9.5, fontWeight: 760, marginTop: 5 }}>
                      {preset.runtimeAction || preset.trigger?.action || 'Hazır görev butonu'}
                    </div>
                  </PreviewTile>
                ))}
              </div>
            </div>
          </PanelCard>
          <PanelCard title="Buton animasyonu" collapsible>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
              {Object.entries(BUTTON_PACKAGE_MOTION_PRESETS).map(([profileId, motion]) => (
                <PreviewTile
                  key={profileId}
                  label={motionLabels[profileId] || profileId}
                  active={activeMotionProfile === profileId}
                  onClick={() => commands.applyButtonMotion?.(profileId)}
                  tone={inspectorChrome.blue}
                >
                  {/* Hover'da profilin gerçek değerleriyle (scale/lift/süre) hareket eden mini demo */}
                  <div
                    onMouseEnter={(event) => {
                      const el = event.currentTarget;
                      el.style.transition = `transform ${Math.max(120, Number(motion.duration) || 180)}ms ${motion.easing || 'ease-out'}`;
                      el.style.transform = `translateY(-${Math.max(0, Number(motion.liftY) || 0)}px) scale(${Math.max(1, Number(motion.hoverScale) || 1.02)})`;
                      if (motion.hoverShadow) el.style.boxShadow = motion.hoverShadow;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.transform = 'none';
                      event.currentTarget.style.boxShadow = 'none';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '5px 0',
                      borderRadius: 7,
                      background: inspectorChrome.blue,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    Aa
                  </div>
                  <div style={{ color: '#64748b', fontSize: 9.5, fontWeight: 780 }}>
                    {motion.duration}ms · {Number(motion.hoverScale || 1).toFixed(3)}x
                  </div>
                </PreviewTile>
              ))}
            </div>
          </PanelCard>
        </>
      )}

      {activeTab === 'answers' && (
        <>
          <PanelCard title="Aktif cevap teması" collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <PreviewTile
                label={currentAnswerPreset?.name || 'Tema seçilmedi'}
                active
                onClick={() => setActiveTab('themes')}
                tone={answerPresetColors(currentAnswerPreset)[0] || inspectorChrome.blue}
              >
                <ThemePreview preset={currentAnswerPreset} />
                <div style={{ color: '#64748b', fontSize: 9.5, fontWeight: 760, marginTop: 5 }}>
                  Tema değişimi için Tema sekmesini kullan.
                </div>
              </PreviewTile>
            </div>
          </PanelCard>

          <PanelCard title="Stili uygula / preset kaydet" collapsible>
            <div style={{ display: 'grid', gap: 7 }}>
              <ButtonGrid
                actions={[
                  { label: 'Temayı Yenile', onClick: () => applyThemePreset(currentAnswerPresetId) },
                  {
                    label: 'Varsayılan Yap',
                    onClick: () => inspectorProps?.onSetBookDefaultStylePreset?.(currentAnswerPresetId),
                    disabled: !inspectorProps?.onSetBookDefaultStylePreset,
                  },
                ]}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <TextInput value={presetName} onChange={setPresetName} />
                <ActionButton
                  onClick={() => {
                    const savedId = inspectorProps?.onSaveLayerPreset?.(presetName, activity);
                    if (savedId) setSelectedLayerPresetId(savedId);
                  }}
                  disabled={!inspectorProps?.onSaveLayerPreset}
                >
                  Kaydet
                </ActionButton>
              </div>
              {layerPresets.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                  <NativeSelect
                    value={selectedLayerPresetId || layerPresets[0]?.id || ''}
                    options={layerPresets.map((item) => ({ value: item.id, label: item.name }))}
                    onChange={setSelectedLayerPresetId}
                  />
                  <ActionButton
                    onClick={() =>
                      inspectorProps?.onApplyLayerPreset?.(selectedLayerPresetId || layerPresets[0]?.id, activity.id)
                    }
                    disabled={!inspectorProps?.onApplyLayerPreset}
                  >
                    Uygula
                  </ActionButton>
                </div>
              ) : (
                <EmptyHint>Kayıtlı layer seti yok.</EmptyHint>
              )}
              <ButtonGrid
                actions={[
                  { label: 'Cevap Nesnelerini Üret', onClick: generateAnswerObjects },
                  { label: 'Cevap Sahne Seti Oluştur', onClick: generateAnswerSceneSet, tone: '#16a34a' },
                  { label: 'Cevap Merkezi', onClick: controller.onOpenAnswerCenter },
                ]}
              />
            </div>
          </PanelCard>
        </>
      )}
    </PanelShell>
  );
}
