const CUSTOM_INTERACTION_SECTIONS = [
  {
    id: 'activity',
    title: 'Etkinlik',
    desc: 'Özel etkileşimin adı, şablonu ve genel durumu.',
  },
  {
    id: 'widgets',
    title: 'Widgetlar',
    desc: 'Etkileşim içinde kullanılacak görsel ve işlevsel parçalar.',
  },
  {
    id: 'settings',
    title: 'Ayarlar',
    desc: 'Boyut, davranış ve paket düzeyi seçenekler.',
  },
  {
    id: 'events',
    title: 'Olaylar',
    desc: 'Kullanıcı etkileşimi veya zamanlama olayları.',
  },
  {
    id: 'commands',
    title: 'Komutlar',
    desc: 'Olaylar çalıştığında tetiklenecek komut hazırlığı.',
  },
  {
    id: 'variables',
    title: 'Değişkenler',
    desc: 'Etkileşim içi durum ve hesaplama değişkenleri.',
  },
  {
    id: 'triggers',
    title: 'Tetikleyiciler',
    desc: 'Editör tetikleyici sistemiyle bağlanacak akışlar.',
  },
  {
    id: 'test',
    title: 'Test',
    desc: 'Önizleme ve doğrulama araçları için ayrılan alan.',
  },
];

function countForSection(sectionId, customInteraction = {}, globalVariables = [], activity = {}) {
  if (sectionId === 'widgets') return customInteraction.widgets?.length || 0;
  if (sectionId === 'events') return customInteraction.events?.length || 0;
  if (sectionId === 'commands') return customInteraction.commands?.length || 0;
  if (sectionId === 'variables') {
    return (customInteraction.variables?.length || 0) + (globalVariables?.length || 0);
  }
  if (sectionId === 'triggers') {
    return (customInteraction.triggers?.length || 0) + (activity.triggers?.length || 0);
  }
  return null;
}

export default function CustomInteractionInspector({
  activity,
  onUpdate = () => {},
  variables = [],
}) {
  const customInteraction = activity?.customInteraction || {};
  const templateName = customInteraction.templateName || 'Boş Özel Etkileşim';
  const runtimeReady = customInteraction.settings?.runtimeReady === true;

  const patchCustomInteraction = (patch) => {
    if (!activity) return;
    onUpdate({
      ...activity,
      customInteraction: {
        ...customInteraction,
        ...patch,
      },
    });
  };

  return (
    <div className="eic-custom-inspector">
      <div className="eic-custom-inspector-hero">
        <div>
          <div className="eic-custom-inspector-kicker">Özel Etkileşim</div>
          <h3>{activity?.name || 'Yeni özel etkileşim'}</h3>
          <p>{templateName}</p>
        </div>
        <span>{runtimeReady ? 'V0 aktif' : 'Hazırlık'}</span>
      </div>

      <label className="eic-custom-inspector-field">
        <span>Şablon Adı</span>
        <input
          value={templateName}
          onChange={(event) => patchCustomInteraction({ templateName: event.target.value })}
          placeholder="Özel etkileşim şablonu"
        />
      </label>

      <div className="eic-custom-inspector-grid">
        {CUSTOM_INTERACTION_SECTIONS.map((section) => {
          const count = countForSection(section.id, customInteraction, variables, activity);
          return (
            <section key={section.id} className="eic-custom-inspector-card">
              <div className="eic-custom-inspector-card-head">
                <strong>{section.title}</strong>
                {count !== null && <span>{count}</span>}
              </div>
              <p>{section.desc}</p>
            </section>
          );
        })}
      </div>

      <div className="eic-custom-inspector-note">
        V0 yerleşik widget çalışma zamanı etkindir. ZIP yükleme ve SCORM içine widget asset
        paketleme sonraki faz kapsamındadır.
      </div>
    </div>
  );
}
