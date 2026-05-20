import { ActionButton, MetricGrid, PanelCard, PanelShell } from './PanelPrimitives';

export default function HomeRightPanel({ controller }) {
  const activity = controller.activity || {};
  const slides = controller.slides || [];
  const objects = controller.objects || [];
  const triggers = activity.triggers || [];
  const timeline = activity.timeline || [];

  return (
    <PanelShell
      title="Etkinlik Kontrol Merkezi"
      subtitle="Sahne, nesne, cevap ve etkileşim özetleri."
    >
      <PanelCard title="Genel Özet">
        <MetricGrid
          items={[
            { label: 'Slide', value: slides.length, tone: '#2563eb' },
            { label: 'Nesne', value: objects.length, tone: '#16a34a' },
            { label: 'Trigger', value: triggers.length, tone: '#f97316' },
            { label: 'Animasyon', value: timeline.length, tone: '#7c3aed' },
          ]}
        />
      </PanelCard>

      <PanelCard title="Hızlı İşlemler">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          <ActionButton onClick={controller.commands.saveProject}>Kaydet</ActionButton>
          <ActionButton onClick={controller.commands.openPreview}>Önizleme</ActionButton>
          <ActionButton onClick={controller.onOpenAnswerCenter}>Cevap Merkezi</ActionButton>
          <ActionButton onClick={controller.commands.resetLayout} tone="#475569">
            Düzeni Sıfırla
          </ActionButton>
        </div>
      </PanelCard>

      <PanelCard title="Seçim Bağlamı">
        <div style={{ color: '#334155', fontSize: 11, lineHeight: 1.55 }}>
          {controller.selectedObject ? (
            <>
              <strong>{controller.selectedObject.label || controller.selectedObject.type}</strong>
              <br />
              {controller.activeLayerName} içinde düzenleniyor.
            </>
          ) : (
            <>Nesne seçilmedi. Biçim sekmesi seçili nesne ayarlarını açar.</>
          )}
        </div>
      </PanelCard>
    </PanelShell>
  );
}
