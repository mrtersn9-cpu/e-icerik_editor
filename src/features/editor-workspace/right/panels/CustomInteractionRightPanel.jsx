import CustomInteractionInspector from '../../../../activity-types/custom-interaction/CustomInteractionInspector';

import {
  ButtonGrid,
  EmptyHint,
  MetricGrid,
  PanelCard,
  PanelShell,
} from './PanelPrimitives';

export default function CustomInteractionRightPanel({ controller }) {
  const activity = controller?.activity || {};
  const variables = controller?.present?.variables || [];

  const statusItems = [
    { label: 'Widget runtime', value: 'V0 aktif', tone: '#22c55e' },
    { label: 'Komut/event sistemi', value: 'V0 aktif', tone: '#22c55e' },
    { label: 'ZIP ile yükleme', value: 'Pasif', tone: '#94a3b8' },
    { label: 'SCORM widget paketleme', value: 'Henüz aktif değil', tone: '#94a3b8' },
  ];

  const canRenderInspector =
    activity &&
    typeof controller.onUpdateActivity === 'function';

  return (
    <PanelShell
      title="Özel Etkileşim Hazırlık Modu"
      subtitle="Widget, simülasyon ve ZIP tabanlı etkileşim hazırlığı."
    >
      <PanelCard title="1. Bilgilendirme" collapsible defaultOpen>
        <EmptyHint>
          Widget Runtime V0 aktif. Built-in zar ve kuş animasyonu widget'ları
          önizlemede çalışır. ZIP yükleme ve SCORM widget paketleme sonraki
          fazlarda aktif olacaktır.
        </EmptyHint>
      </PanelCard>

      <PanelCard title="2. Durumlar" collapsible defaultOpen>
        <MetricGrid columns={1} items={statusItems} />
        {variables.find((v) => v.id === 'diceValue') && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#0c4a6e' }}>
            <strong>diceValue:</strong>{' '}
            {String(variables.find((v) => v.id === 'diceValue')?.value ?? 0)}
          </div>
        )}
      </PanelCard>

      <PanelCard title="3. Etkinlik kontrolleri" collapsible defaultOpen={false}>
        <ButtonGrid
          columns={1}
          actions={[
            {
              label: 'Kaydet',
              onClick: controller.commands?.saveProject,
            },
            {
              label: 'Önizleme',
              disabled: false,
              title: 'Önizleme penceresinde widgetlari test edin.',
              onClick: controller.commands?.previewActivity,
            },
            {
              label: 'SCORM ZIP',
              disabled: true,
              title: 'Özel etkileşim runtime henüz aktif değil.',
            },
            {
              label: 'Cevap Merkezi',
              disabled: true,
              title: 'Özel etkileşim runtime henüz aktif değil.',
            },
          ]}
        />
      </PanelCard>

      {canRenderInspector && (
        <PanelCard title="4. Özel etkileşim verisi" collapsible defaultOpen={false}>
          <CustomInteractionInspector
            activity={activity}
            onUpdate={controller.onUpdateActivity}
            variables={variables}
          />
        </PanelCard>
      )}
    </PanelShell>
  );
}
