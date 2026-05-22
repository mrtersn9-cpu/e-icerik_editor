import { ButtonGrid, PanelCard, PanelShell, TileGrid } from './PanelPrimitives';

export default function InsertRightPanel({ controller }) {
  const commands = controller.commands || {};
  const readyButtons = controller.galleries?.readyButtons || [];
  return (
    <PanelShell title="Ekleme Önerileri" subtitle="Butonlar gerçek nesne veya medya oluşturur.">
      <PanelCard title="1. Metin öğeleri" collapsible>
        <TileGrid
          actions={[
            {
              label: 'Metin',
              description: 'Gövde metin kutusu',
              icon: 'T',
              onClick: () => commands.insertText?.('body'),
            },
            {
              label: 'Başlık',
              description: 'Büyük başlık alanı',
              icon: 'H',
              onClick: () => commands.insertText?.('heading'),
            },
            {
              label: 'Etiket',
              description: 'Kısa vurgu etiketi',
              icon: 'L',
              onClick: commands.insertLabel,
            },
            {
              label: 'İkon',
              description: 'Metin tabanlı simge',
              icon: '★',
              onClick: commands.insertIcon,
            },
          ]}
        />
      </PanelCard>

      <PanelCard title="2. Medya öğeleri" collapsible>
        <TileGrid
          actions={[
            { label: 'Resim', description: 'Yerel görsel ekle', icon: 'I', onClick: commands.insertImage },
            { label: 'SVG Zemin', description: 'Sahne arka planı', icon: 'S', onClick: commands.loadSvgBackground },
            { label: 'Ses', description: 'Audio dosyası', icon: '♪', onClick: commands.insertAudio },
            { label: 'Video', description: 'Video dosyası', icon: '▶', onClick: commands.insertVideo },
            { label: 'Web', description: 'Embed alanı', icon: 'W', onClick: () => commands.insertObject?.('embed') },
            { label: 'Şekil', description: 'Yuvarlatılmış şekil', icon: '□', onClick: () => commands.insertShape?.('roundedRect') },
          ]}
        />
      </PanelCard>

      <PanelCard title="3. Etkileşim öğeleri" collapsible>
        <ButtonGrid
          actions={[
            { label: 'Buton', onClick: () => commands.insertButtonPreset?.('btn-blue') },
            { label: 'Hotspot', onClick: () => commands.insertObject?.('hotspot') },
            { label: 'Sürükle', onClick: () => commands.insertObject?.('draggable') },
            { label: 'Dropzone', onClick: () => commands.insertObject?.('dropzone') },
            { label: 'Soru', onClick: commands.openAnswerCenter },
          ]}
        />
      </PanelCard>

      <PanelCard title="4. Hazır görev butonları" collapsible>
        <ButtonGrid
          actions={readyButtons.map((button) => ({
            label: `${button.icon || ''} ${button.label}`.trim(),
            onClick: () => commands.insertReadyButton?.(button.id),
          }))}
        />
      </PanelCard>

      <PanelCard title="5. Hazır şablonlar" collapsible>
        <TileGrid
          actions={[
            {
              label: 'Bilgi Kutusu',
              description: 'Açıklama bloğu',
              icon: 'i',
              onClick: () => commands.insertComponent?.('info-box'),
            },
            {
              label: 'Uyarı Kutusu',
              description: 'Dikkat bloğu',
              icon: '!',
              tone: '#f59e0b',
              onClick: () => commands.insertComponent?.('warning-box'),
            },
            { label: 'Kart', description: 'Başlıklı içerik', icon: '▤', onClick: () => commands.insertComponent?.('card') },
            {
              label: 'Akordeon',
              description: 'Açılır başlık',
              icon: '▾',
              onClick: () => commands.insertComponent?.('accordion'),
            },
          ]}
        />
      </PanelCard>
    </PanelShell>
  );
}
