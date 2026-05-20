import { DRAG_DROP_MODES } from '../../constants';
import { getCorrectDragMatches } from '../../logic/activityHelpers';
import {
  areDragDropScopesCompatible,
  getDragDropSettings,
  normalizeDragDropMatchValue,
} from '../../logic/dragDrop';
import { Btn } from '../ui';

export default function DragDropConfigPanel({ activity, onUpdate, showMatchEditor = true }) {
  const objects = activity.objects || [];
  const draggables = objects.filter((o) => o.type === 'draggable');
  const dropzones = objects.filter((o) => o.type === 'dropzone');
  const mode = activity.dragDropMode || 'single';
  const matches = activity.dragDropMatches || {};
  const dragDropSettings = getDragDropSettings(activity);

  const setMode = (m) => onUpdate({ ...activity, dragDropMode: m, dragDropMatches: {} });
  const setMatch = (dragId, dropId) =>
    onUpdate({ ...activity, dragDropMatches: { ...matches, [dragId]: dropId } });
  const setMultiMatch = (dragId, dropId, checked) => {
    const current = normalizeDragDropMatchValue(matches[dragId]);
    const next = checked ? [...current, dropId] : current.filter((item) => item !== dropId);
    onUpdate({ ...activity, dragDropMatches: { ...matches, [dragId]: [...new Set(next)] } });
  };
  const patchObj = (id, p) =>
    onUpdate({ ...activity, objects: objects.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  const patchSettings = (patchValue) =>
    onUpdate({ ...activity, dragDropSettings: { ...dragDropSettings, ...patchValue } });

  const isGroupMode = mode === 'group' || mode === 'multi-group';
  const resolvedMatches = getCorrectDragMatches(activity);
  const resolvedCount = draggables.filter(
    (d) => normalizeDragDropMatchValue(resolvedMatches[d.id]).length
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #1e293b',
          background: '#0f172a',
          color: '#cbd5e1',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#38bdf8',
            marginBottom: 5,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          Nereden Yonetilir
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.65 }}>
          Genel drag-drop kurallari bu sekmeden, secili tek bir surukle veya birak alaninin boyut ve
          konumu ise sagdaki <strong>Nesne</strong> panelinden duzenlenir.
        </div>
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #dbeafe',
          background: 'linear-gradient(180deg,#f8fbff,#ffffff)',
          color: '#475569',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#1d4ed8',
            marginBottom: 6,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          Nasil Kullanilir
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          1. Ayni soruya ait surukle ve birak alanlarina ayni <strong>Soru Grubu</strong> adini ver.
          <br />
          2. Birak alaninin kac oge alacagini <strong>Kapasite</strong> ile belirle.
          <br />
          3. Ayni oge birden fazla yere gidecekse <strong>Coklu hedef</strong> sec.
          <br />
          4. En alttaki <strong>Dogru Eslesme Formu</strong> bolumunden dogru cevaplari sec.
        </div>
      </div>

      {/* Mod Seçimi */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#FF9800',
            marginBottom: 8,
            letterSpacing: 1,
          }}
        >
          SÜRÜKLE-BIRAK MODU
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {DRAG_DROP_MODES.map((m) => (
            <div
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                border: `1px solid ${mode === m.id ? '#FF9800' : '#252540'}`,
                background: mode === m.id ? '#FF980022' : '#111125',
                transition: 'all .15s',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: mode === m.id ? '#FF9800' : '#B0BEC5',
                  marginBottom: 2,
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 8,
            fontSize: 11,
            color: '#94a3b8',
          }}
        >
          <span>{draggables.length} surukle</span>
          <span>{dropzones.length} birak alani</span>
          <span>{resolvedCount} dogru eslesme</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 8 }}>
          DAVRANIŞLAR
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #252540',
              background: '#111125',
              cursor: 'pointer',
              fontSize: 11,
              color: '#B0BEC5',
            }}
          >
            <input
              type="checkbox"
              checked={dragDropSettings.isolateScopes !== false}
              onChange={(e) => patchSettings({ isolateScopes: e.target.checked })}
              style={{ accentColor: '#38bdf8' }}
            />
            Soru grubu izolasyonu
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #252540',
              background: '#111125',
              cursor: 'pointer',
              fontSize: 11,
              color: '#B0BEC5',
            }}
          >
            <input
              type="checkbox"
              checked={!!dragDropSettings.allowCrossScope}
              onChange={(e) => patchSettings({ allowCrossScope: e.target.checked })}
              style={{ accentColor: '#f59e0b' }}
            />
            Grup disina izin ver
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #252540',
              background: '#111125',
              cursor: 'pointer',
              fontSize: 11,
              color: '#B0BEC5',
            }}
          >
            <input
              type="checkbox"
              checked={!!dragDropSettings.allowMultipleItemsPerDrop}
              onChange={(e) => patchSettings({ allowMultipleItemsPerDrop: e.target.checked })}
              style={{ accentColor: '#22c55e' }}
            />
            Bir alan çoklu öge alsın
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #252540',
              background: '#111125',
              cursor: 'pointer',
              fontSize: 11,
              color: '#B0BEC5',
            }}
          >
            <input
              type="checkbox"
              checked={!!dragDropSettings.allowMultipleTargetsPerDrag}
              onChange={(e) => patchSettings({ allowMultipleTargetsPerDrag: e.target.checked })}
              style={{ accentColor: '#a855f7' }}
            />
            Aynı öge çoklu hedefe gitsin
          </label>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
          Soru grubu alani sayesinde ayni sayfada sinirsiz sayida bagimsiz drag-drop soru blogu
          kurabilirsin. Ayni soru grubundaki ogeler kendi aralarinda calisir.
        </div>
      </div>

      {/* Grup modu: grup etiketleri */}
      {isGroupMode && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 8 }}>
            GRUP ETİKETLERİ
          </div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 8, lineHeight: 1.5 }}>
            Sürüklenebilir ve bırakma alanlarına aynı grup etiketini yazın. Önizlemede eşleşme
            otomatik yapılır.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draggables.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  background: '#0d0d1a',
                  borderRadius: 6,
                  padding: '6px 8px',
                  border: '1px solid #252540',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: d.style?.borderColor || '#00BCD4',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: '#B0BEC5',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label || `Sürükle ${i + 1}`}
                </span>
                <input
                  value={d.group || ''}
                  onChange={(e) => patchObj(d.id, { group: e.target.value })}
                  placeholder="grup"
                  style={{
                    width: 70,
                    padding: '3px 6px',
                    borderRadius: 4,
                    border: '1px solid #00BCD4',
                    background: '#1a1a30',
                    color: '#00BCD4',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            {dropzones.map((dz, i) => (
              <div
                key={dz.id}
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  background: '#0d0d1a',
                  borderRadius: 6,
                  padding: '6px 8px',
                  border: '1px solid #252540',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: '#FF9800',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: '#B0BEC5',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dz.label || `Bırak ${i + 1}`}
                </span>
                <input
                  value={dz.group || ''}
                  onChange={(e) => patchObj(dz.id, { group: e.target.value })}
                  placeholder="grup"
                  style={{
                    width: 70,
                    padding: '3px 6px',
                    borderRadius: 4,
                    border: '1px solid #FF9800',
                    background: '#1a1a30',
                    color: '#FF9800',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {(draggables.length > 0 || dropzones.length > 0) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 8 }}>
            SORU BLOKLARI VE KAPASİTE
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
              gap: 6,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #dbeafe',
                background: '#f8fbff',
                fontSize: 11,
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#1d4ed8' }}>Soru Grubu:</strong> Ayni soruya ait olanlara
              ayni isim yaz.
            </div>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: 11,
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#0f172a' }}>Grup:</strong> Grup modunda hangi ogenin hangi
              alanla eslesecegini belirler.
            </div>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #dcfce7',
                background: '#f0fdf4',
                fontSize: 11,
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#15803d' }}>Kapasite:</strong> Bir birak alani kac oge alsin.{' '}
              <strong>1</strong> tek oge, <strong>0</strong> sinirsiz.
            </div>
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #f3e8ff',
                background: '#faf5ff',
                fontSize: 11,
                color: '#475569',
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: '#7e22ce' }}>Coklu hedef:</strong> Ayni suruklenen oge birden
              fazla alana gidebilir.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draggables.map((drag, index) => (
              <div
                key={drag.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 84px',
                  gap: 6,
                  alignItems: 'center',
                  background: '#0d0d1a',
                  borderRadius: 8,
                  padding: '8px 10px',
                  border: '1px solid #252540',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#B0BEC5',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {drag.label || `Surukle ${index + 1}`}
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 6,
                      fontSize: 11,
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        !!(
                          drag.allowMultipleTargets || dragDropSettings.allowMultipleTargetsPerDrag
                        )
                      }
                      onChange={(e) =>
                        patchObj(drag.id, { allowMultipleTargets: e.target.checked })
                      }
                      style={{ accentColor: '#a855f7' }}
                    />
                    Coklu hedef
                  </label>
                </div>
                <input
                  value={drag.scope || ''}
                  onChange={(e) => patchObj(drag.id, { scope: e.target.value })}
                  placeholder="Soru grubu"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#111827',
                    color: '#e2e8f0',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
                <input
                  value={drag.group || ''}
                  onChange={(e) => patchObj(drag.id, { group: e.target.value })}
                  placeholder="grup"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#111827',
                    color: '#e2e8f0',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            {dropzones.map((drop, index) => (
              <div
                key={drop.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 84px 68px',
                  gap: 6,
                  alignItems: 'center',
                  background: '#0d0d1a',
                  borderRadius: 8,
                  padding: '8px 10px',
                  border: '1px solid #252540',
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    fontSize: 11,
                    color: '#B0BEC5',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {drop.label || `Birak ${index + 1}`}
                </div>
                <input
                  value={drop.scope || ''}
                  onChange={(e) => patchObj(drop.id, { scope: e.target.value })}
                  placeholder="Soru grubu"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#111827',
                    color: '#e2e8f0',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
                <input
                  value={drop.group || ''}
                  onChange={(e) => patchObj(drop.id, { group: e.target.value })}
                  placeholder="grup"
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#111827',
                    color: '#e2e8f0',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
                <input
                  type="number"
                  min={0}
                  value={drop.capacity || 0}
                  onChange={(e) =>
                    patchObj(drop.id, { capacity: Math.max(0, +e.target.value || 0) })
                  }
                  placeholder="kap."
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 5,
                    border: '1px solid #334155',
                    background: '#111827',
                    color: '#e2e8f0',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tekli / Çoklu Tekli: eşleşme tablosu */}
      {showMatchEditor && !isGroupMode && draggables.length > 0 && dropzones.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#78909C', marginBottom: 8 }}>
            DOĞRU EŞLEŞMELERİ AYARLA
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <Btn
              onClick={() => onUpdate({ ...activity, dragDropMatches: {} })}
              color="#607D8B"
              small
            >
              Temizle
            </Btn>
          </div>
          <div
            style={{
              background: '#0d0d1a',
              border: '1px solid #252540',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 20px 1fr',
                padding: '6px 10px',
                background: '#111125',
                borderBottom: '1px solid #252540',
              }}
            >
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>SÜRÜKLE</div>
              <div />
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700 }}>BIRAK</div>
            </div>
            {draggables.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 20px 1fr',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderBottom: i < draggables.length - 1 ? '1px solid #1a1a30' : 'none',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#00BCD4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label || `Sürükle ${i + 1}`}
                </div>
                <div style={{ textAlign: 'center', color: '#555', fontSize: 12 }}>→</div>
                {d.allowMultipleTargets || dragDropSettings.allowMultipleTargetsPerDrag ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {dropzones
                      .filter((drop) => areDragDropScopesCompatible(activity, d, drop))
                      .map((dz) => (
                        <label
                          key={dz.id}
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
                            checked={normalizeDragDropMatchValue(matches[d.id]).includes(dz.id)}
                            onChange={(e) => setMultiMatch(d.id, dz.id, e.target.checked)}
                            style={{ accentColor: '#a855f7' }}
                          />
                          <span>{dz.label || dz.id.slice(-4)}</span>
                        </label>
                      ))}
                  </div>
                ) : (
                  <select
                    value={normalizeDragDropMatchValue(matches[d.id])[0] || ''}
                    onChange={(e) => setMatch(d.id, e.target.value)}
                    style={{
                      padding: '4px 6px',
                      borderRadius: 5,
                      border: `1px solid ${normalizeDragDropMatchValue(matches[d.id]).length ? '#FF9800' : '#333'}`,
                      background: '#1a1a30',
                      color: normalizeDragDropMatchValue(matches[d.id]).length ? '#FF9800' : '#666',
                      fontSize: 11,
                      outline: 'none',
                      width: '100%',
                    }}
                  >
                    <option value="">— Seçin —</option>
                    {dropzones
                      .filter((drop) => areDragDropScopesCompatible(activity, d, drop))
                      .map((dz) => (
                        <option key={dz.id} value={dz.id}>
                          {dz.label || dz.id.slice(-4)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 6, lineHeight: 1.5 }}>
            {mode === 'multi-single'
              ? 'Birden fazla öge aynı bırakma alanını seçebilir.'
              : 'Her sürükleme ögesi farklı bir alana atanmalı.'}
          </div>
        </div>
      )}

      {draggables.length === 0 && (
        <div style={{ fontSize: 11, color: '#444', padding: '8px 0', textAlign: 'center' }}>
          Canvas'a sürüklenebilir öge ekleyin
        </div>
      )}
      {!isGroupMode && dropzones.length === 0 && draggables.length > 0 && (
        <div style={{ fontSize: 11, color: '#444', padding: '8px 0', textAlign: 'center' }}>
          Canvas'a bırakma alanı ekleyin
        </div>
      )}
    </div>
  );
}
