import { ButtonGrid, PanelCard, PanelShell } from './PanelPrimitives';

export default function InsertRightPanel({ controller }) {
  const commands = controller.commands || {};
  return (
    <PanelShell title="Ekleme Önerileri" subtitle="Butonlar gerçek nesne veya medya oluşturur.">
      <PanelCard title="Temel Nesneler">
        <ButtonGrid
          actions={[
            { label: 'Metin', onClick: () => commands.insertText?.('body') },
            { label: 'Başlık', onClick: () => commands.insertText?.('heading') },
            { label: 'Resim', onClick: commands.insertImage },
            { label: 'SVG Zemin', onClick: commands.loadSvgBackground },
            { label: 'Şekil', onClick: () => commands.insertShape?.('roundedRect') },
            { label: 'İkon', onClick: commands.insertIcon },
          ]}
        />
      </PanelCard>

      <PanelCard title="Medya ve Etkileşim">
        <ButtonGrid
          actions={[
            { label: 'Ses', onClick: commands.insertAudio },
            { label: 'Video', onClick: commands.insertVideo },
            { label: 'Web', onClick: () => commands.insertObject?.('embed') },
            { label: 'Buton', onClick: () => commands.insertButtonPreset?.('btn-blue') },
            { label: 'Hotspot', onClick: () => commands.insertObject?.('hotspot') },
            { label: 'Sürükle-Bırak', onClick: () => commands.insertObject?.('draggable') },
          ]}
        />
      </PanelCard>

      <PanelCard title="Hazır Bileşenler">
        <ButtonGrid
          actions={[
            { label: 'Bilgi Kutusu', onClick: () => commands.insertComponent?.('info-box') },
            { label: 'Uyarı Kutusu', onClick: () => commands.insertComponent?.('warning-box') },
            { label: 'Kart', onClick: () => commands.insertComponent?.('card') },
            { label: 'Etiket', onClick: commands.insertLabel },
          ]}
        />
      </PanelCard>
    </PanelShell>
  );
}
