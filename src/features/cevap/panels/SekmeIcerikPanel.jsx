import { useRef } from 'react';

import { fileToDataUrl } from '../../../api/apiClient';
import { uid } from '../../../utils/editorHelpers';
import { patchActivity } from '../cevapActions';
import { CevapCard, Field, PanelGrid, SelectInput, SmallButton, TextArea, TextInput, ToggleRow } from '../components/CevapControls';

import { DenemeVeKisitlarCard, ErisilebilirlikCard, EtkinlikTuruCard, IpucuCard } from './OrtakCevapKartlari';

const LAYOUT_OPTIONS = [
  { value: 'tabs', label: 'Sekmeler' },
  { value: 'accordion', label: 'Akordeon' },
  { value: 'process', label: 'Süreç (adım adım)' },
  { value: 'timeline', label: 'Zaman Çizelgesi' },
];

const LAYOUT_HINT = {
  tabs: 'Yatay sekmeler; her sekme bir içerik paneli gösterir.',
  accordion: 'Üst üste açılır-kapanır başlıklar.',
  process: 'Numaralı adımlar; ileri/geri gezinme.',
  timeline: 'Dikey kilometre taşları; tüm olaylar sırayla listelenir.',
};

export default function SekmeIcerikPanel({ activity, onUpdate }) {
  const items = activity.contentItems || [];
  const fileRefs = useRef({});
  const patch = (p) => patchActivity(activity, onUpdate, p);
  const patchItem = (id, p) => patch({ contentItems: items.map((it) => (it.id === id ? { ...it, ...p } : it)) });
  const layout = activity.contentLayout || 'tabs';

  const addItem = () => {
    patch({ contentItems: [...items, { id: uid(), title: `Başlık ${items.length + 1}`, body: '', image: '' }] });
  };
  const removeItem = (id) => patch({ contentItems: items.filter((it) => it.id !== id) });
  const moveItem = (index, dir) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ contentItems: next });
  };
  const uploadImage = (id, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    fileToDataUrl(file).then((data) => patchItem(id, { image: data })).catch(() => {});
  };

  return (
    <PanelGrid>
      <EtkinlikTuruCard
        activity={activity}
        onUpdate={onUpdate}
        description="Bilgi içeriğini sekme, akordeon, süreç ya da zaman çizelgesi olarak gezdir (puansız etkileşim)."
      />
      <CevapCard number="2" title="Düzen">
        <Field label="Görünüm" hint={LAYOUT_HINT[layout]}>
          <SelectInput value={layout} onChange={(value) => patch({ contentLayout: value })} options={LAYOUT_OPTIONS} />
        </Field>
        <ToggleRow
          label="Tamamlamak için tüm bölümler görüntülensin"
          checked={!!activity.contentRequireAll}
          onChange={(checked) => patch({ contentRequireAll: checked })}
          hint="Açıkça hatırlatma gösterilir; içerik puansızdır."
        />
      </CevapCard>
      <CevapCard number="3" title={`İçerik Öğeleri (${items.length})`} wide>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>Öğe #{i + 1}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SmallButton variant="secondary" disabled={i === 0} onClick={() => moveItem(i, -1)} ariaLabel="Yukarı taşı">↑</SmallButton>
                  <SmallButton variant="secondary" disabled={i === items.length - 1} onClick={() => moveItem(i, 1)} ariaLabel="Aşağı taşı">↓</SmallButton>
                  <SmallButton variant="danger" onClick={() => removeItem(it.id)}>Sil</SmallButton>
                </div>
              </div>
              <Field label="Başlık"><TextInput value={it.title || ''} onChange={(v) => patchItem(it.id, { title: v })} /></Field>
              <Field label="İçerik metni"><TextArea value={it.body || ''} onChange={(v) => patchItem(it.id, { body: v })} rows={3} /></Field>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <SmallButton
                  variant="primary"
                  onClick={() => { fileRefs.current[it.id]?.click(); }}
                >
                  {it.image ? 'Görseli Değiştir' : 'Görsel Ekle (opsiyonel)'}
                </SmallButton>
                {it.image && <SmallButton variant="danger" onClick={() => patchItem(it.id, { image: '' })}>Görseli Kaldır</SmallButton>}
                <input
                  ref={(el) => { fileRefs.current[it.id] = el; }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage(it.id, e)}
                  style={{ display: 'none' }}
                />
                {it.image && <img src={it.image} alt="" style={{ height: 40, borderRadius: 6, border: '1px solid #e2e8f0' }} />}
              </div>
            </div>
          ))}
          <SmallButton variant="primary" onClick={addItem}>+ İçerik Öğesi Ekle</SmallButton>
          {!items.length && <div style={{ fontSize: 12, color: '#64748b' }}>Henüz öğe yok. En az bir öğe ekleyin.</div>}
        </div>
      </CevapCard>
      <IpucuCard number="4" activity={activity} onUpdate={onUpdate} />
      <DenemeVeKisitlarCard number="5" activity={activity} onUpdate={onUpdate} />
      <ErisilebilirlikCard number="6" activity={activity} onUpdate={onUpdate} />
    </PanelGrid>
  );
}
