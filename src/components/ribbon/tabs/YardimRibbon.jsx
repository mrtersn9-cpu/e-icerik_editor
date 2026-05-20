import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGroup,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

export default function YardimRibbon({ controller }) {
  const { commands } = controller;

  return (
    <>
      <RibbonGroup title="Yardım" width={156}>
        <RibbonRow>
          <RibbonPopoverButton label="Yardım Merkezi" icon="help" width={116} variant="large" tone="slate">
            <RibbonStack>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Yardım Merkezi</div>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.45 }}>
                Ribbon sekmelerini kullanarak sahne, nesne, geçiş, animasyon ve yayınlama işlemlerine ulaşabilirsin.
              </div>
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Başlangıç Rehberi" width={150}>
        <RibbonPopoverButton label="Başlangıç" icon="book" width={112} variant="large" tone="slate">
          <RibbonStack>
            <CompactRibbonButton label="Sahne Ekle" icon="new" onClick={commands.addSlide} width={130} />
            <CompactRibbonButton label="Nesne Ekle" icon="text" onClick={() => commands.setRibbonTab('insert')} width={130} />
            <CompactRibbonButton label="Önizle" icon="play" onClick={commands.openPreview} width={130} />
          </RibbonStack>
        </RibbonPopoverButton>
      </RibbonGroup>

      <RibbonGroup title="Klavye Kısayolları" width={142}>
        <RibbonPopoverButton label="Kısayollar" icon="keyboard" width={112} variant="large" tone="slate">
          <RibbonStack>
            {['Ctrl+Z: Geri al', 'Ctrl+Y: İleri al', 'Ctrl+C: Kopyala', 'Ctrl+V: Yapıştır', 'Del: Sil'].map((line) => (
              <div key={line} style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>
                {line}
              </div>
            ))}
          </RibbonStack>
        </RibbonPopoverButton>
      </RibbonGroup>

      <RibbonGroup title="Dokümantasyon" width={134}>
        <RibbonButton label="Doküman" icon="note" onClick={() => commands.showHelpToast('Dokümantasyon paneli yardım sekmesinde hazır.')} tone="slate" width={92} />
      </RibbonGroup>

      <RibbonGroup title="SSS" width={92}>
        <RibbonPopoverButton label="SSS" icon="question" width={66} variant="large" tone="slate">
          <RibbonStack>
            <div style={{ fontSize: 11, color: '#334155' }}>Sık kullanılan komutlar artık ilgili ribbon sekmelerinde gruplanır.</div>
            <div style={{ fontSize: 11, color: '#334155' }}>Sığmayan seçenekler popup menülerden seçilir.</div>
          </RibbonStack>
        </RibbonPopoverButton>
      </RibbonGroup>

      <RibbonGroup title="Erişilebilirlik Kontrolü" width={156}>
        <RibbonButton label="Kontrol Et" icon="accessibility" onClick={commands.openAccessibilitySettings} tone="purple" width={94} />
      </RibbonGroup>
    </>
  );
}
