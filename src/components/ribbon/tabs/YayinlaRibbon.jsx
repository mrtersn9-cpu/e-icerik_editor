import {
  CompactRibbonButton,
  RibbonButton,
  RibbonColorInput,
  RibbonGroup,
  RibbonNumberInput,
  RibbonRow,
  RibbonSelect,
  RibbonStack,
} from '../RibbonPrimitives';

export default function YayinlaRibbon({ controller }) {
  const { commands, lms, galleries } = controller;

  return (
    <>
      <RibbonGroup title="Paket Standardı" width={138}>
        <RibbonStack>
          <div
            style={{
              height: 24,
              border: '1px solid #cbd7e6',
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 10,
              fontWeight: 900,
              color: '#0f172a',
              background: '#f8fafc',
            }}
          >
            SCORM 1.2
          </div>
          <span style={{ fontSize: 9, color: '#64748b' }}>Tek paket standardı</span>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Paket Bilgisi" width={218}>
        <RibbonStack>
          <input
            value={lms.packageName || ''}
            onChange={(event) => commands.patchLms({ packageName: event.target.value })}
            placeholder="Paket adı"
            style={{ height: 24, border: '1px solid #cbd7e6', borderRadius: 5, fontSize: 10, padding: '0 6px' }}
          />
          <RibbonRow>
            <input
              value={lms.packageCode || ''}
              onChange={(event) => commands.patchLms({ packageCode: event.target.value })}
              placeholder="Kod"
              style={{ width: 78, height: 24, border: '1px solid #cbd7e6', borderRadius: 5, fontSize: 10, padding: '0 6px' }}
            />
            <input
              value={lms.version || '1.0.0'}
              onChange={(event) => commands.patchLms({ version: event.target.value })}
              placeholder="Versiyon"
              style={{ width: 70, height: 24, border: '1px solid #cbd7e6', borderRadius: 5, fontSize: 10, padding: '0 6px' }}
            />
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="İzleme" width={182}>
        <RibbonStack>
          <RibbonRow>
            <span style={{ fontSize: 10, color: '#475569' }}>Geçme</span>
            <RibbonNumberInput
              value={lms.passingScore ?? 70}
              onChange={(event) => commands.patchLms({ passingScore: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
              width={50}
              min={0}
              max={100}
            />
          </RibbonRow>
          <RibbonSelect
            value={lms.trackingMode || 'completion+score'}
            onChange={(event) => commands.patchLms({ trackingMode: event.target.value })}
            options={[
              { value: 'completion', label: 'Tamamlama' },
              { value: 'score', label: 'Puan' },
              { value: 'completion+score', label: 'Tamamlama + Puan' },
            ]}
            width={138}
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="SCORM Kapsamı" width={150}>
        <RibbonStack>
          <RibbonSelect
            value={lms.scormExportScope || 'activity'}
            onChange={(event) => commands.patchLms({ scormExportScope: event.target.value })}
            options={[
              { value: 'activity', label: 'Seçili etkinlik' },
              { value: 'book', label: 'Tüm kitap' },
            ]}
            width={116}
          />
          <span style={{ fontSize: 9, color: '#64748b' }}>SCORM 1.2 ZIP</span>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Player Chrome" width={314}>
        <RibbonStack>
          <RibbonRow>
            {[
              ['Menü', 'showMenu', true],
              ['Notlar', 'showNotes', false],
              ['Sözlük', 'showGlossary', false],
              ['Seekbar', 'showSeekbar', true],
              ['CC', 'closedCaptionsEnabled', false],
            ].map(([label, key, defaultValue]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={lms[key] ?? defaultValue}
                  onChange={(event) => commands.patchLms({ [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
          </RibbonRow>
          <RibbonRow>
            <RibbonColorInput value={lms.primaryColor || '#2563eb'} onChange={(event) => commands.patchLms({ primaryColor: event.target.value })} title="Ana renk" />
            <RibbonColorInput value={lms.backgroundColor || '#0f172a'} onChange={(event) => commands.patchLms({ backgroundColor: event.target.value })} title="Arka plan" />
            <RibbonColorInput value={lms.textColor || '#ffffff'} onChange={(event) => commands.patchLms({ textColor: event.target.value })} title="Metin" />
            {galleries.playerSkins.slice(0, 3).map((skin) => (
              <CompactRibbonButton
                key={skin.id}
                label={skin.name}
                icon="palette"
                onClick={() => commands.patchLms({ playerTheme: skin.id, primaryColor: skin.primaryColor, backgroundColor: skin.backgroundColor, textColor: skin.textColor })}
                active={(lms.playerTheme || 'modern-dark') === skin.id}
                width={66}
              />
            ))}
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Yayınla" width={220}>
        <RibbonRow>
          <RibbonButton label="Dışa Aktar" icon="export" onClick={commands.exportProject} tone="green" />
          <RibbonButton label="Güvenli LMS" icon="score" onClick={commands.secureLmsExport} tone="green" width={64} />
          <RibbonButton label="SCORM ZIP" icon="zip" onClick={commands.scormExport} tone="amber" width={70} />
        </RibbonRow>
      </RibbonGroup>
    </>
  );
}
