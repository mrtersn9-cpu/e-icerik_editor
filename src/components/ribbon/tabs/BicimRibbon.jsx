import { useState } from 'react';

import { CHART_TYPES } from '../../../utils/chartSvg';
import {
  tableAddColumn,
  tableAddRow,
  tableRemoveColumn,
  tableRemoveRow,
  tableToggleHeader,
} from '../../../utils/tableHtml';
import ChartEditorModal from '../../ChartEditorModal';
import TableEditorModal from '../../TableEditorModal';
import { ShapePreviewIcon } from '../../ui';
import FontPicker from '../FontPicker';
import {
  CompactRibbonButton,
  RibbonColorInput,
  RibbonGroup,
  RibbonMenuGrid,
  RibbonNumberInput,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

// Görsel (Picture Format) filtre ön ayarları — img'e CSS filter olarak uygulanır (editör+runtime parite).
const IMAGE_FILTER_PRESETS = [
  { label: 'Orijinal', value: '' },
  { label: 'Parlak', value: 'brightness(1.2)' },
  { label: 'Koyu', value: 'brightness(0.8)' },
  { label: 'Kontrast', value: 'contrast(1.3)' },
  { label: 'Gri Ton', value: 'grayscale(1)' },
  { label: 'Sepya', value: 'sepia(0.7)' },
];

// Efekt ön ayarları — editör/runtime paritesi için boxShadow tabanlı (gölge, parlama, bevel).
const EFFECT_PRESETS = [
  { label: 'Efekt Yok', patch: { boxShadow: 'none' } },
  { label: 'Yumuşak Gölge', patch: { boxShadow: '0 12px 28px rgba(15,23,42,.20)' } },
  { label: 'Güçlü Gölge', patch: { boxShadow: '0 22px 44px rgba(15,23,42,.34)' } },
  { label: 'Mavi Parlama', patch: { boxShadow: '0 0 18px rgba(37,99,235,.7)' } },
  { label: 'Yeşil Parlama', patch: { boxShadow: '0 0 18px rgba(22,163,74,.7)' } },
  { label: 'Bevel', patch: { boxShadow: 'inset 0 2px 0 rgba(255,255,255,.55), inset 0 -3px 0 rgba(0,0,0,.22), 0 6px 14px rgba(0,0,0,.18)' } },
];

export default function BicimRibbon({ controller }) {
  const { commands, object, can, galleries } = controller;
  const disabled = !can.selection;
  const textDisabled = disabled || !can.textStyle;
  const [tableEditorOpen, setTableEditorOpen] = useState(false);
  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  const patchTableData = (nextTableData) => commands.patchObject({ tableData: nextTableData });

  return (
    <>
      <RibbonGroup title="Metin" width={368}>
        <RibbonStack>
          <RibbonRow>
            <FontPicker
              value={object?.style?.fontFamily || 'Arial'}
              onChange={(font) => commands.setObjectStyle({ fontFamily: font })}
              disabled={disabled}
              width={132}
            />
            <RibbonNumberInput
              value={object?.style?.fontSize || 36}
              onChange={(event) => commands.setObjectStyle({ fontSize: Number(event.target.value) || 14 })}
              disabled={disabled}
              width={48}
            />
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.color, '#111111')}
              onChange={(event) => commands.setObjectStyle({ color: event.target.value })}
              disabled={disabled}
              title="Yazı rengi"
            />
          </RibbonRow>
          <RibbonRow>
            <CompactRibbonButton label="Kalın" icon="B" onClick={() => commands.toggleTextStyle('bold')} disabled={textDisabled} width={60} />
            <CompactRibbonButton label="İtalik" icon="I" onClick={() => commands.toggleTextStyle('italic')} disabled={textDisabled} width={60} />
            <CompactRibbonButton label="Altı" icon="U" onClick={() => commands.toggleTextStyle('underline')} disabled={textDisabled} width={58} />
            <RibbonPopoverButton label="Hizala" icon="alignLeft" width={72} disabled={disabled}>
              <RibbonMenuGrid columns="repeat(2, 84px)">
                <CompactRibbonButton label="Sol" icon="alignLeft" onClick={() => commands.setObjectStyle({ textAlign: 'left' })} width={78} />
                <CompactRibbonButton label="Orta" icon="alignCenter" onClick={() => commands.setObjectStyle({ textAlign: 'center' })} width={78} />
                <CompactRibbonButton label="Sağ" icon="alignRight" onClick={() => commands.setObjectStyle({ textAlign: 'right' })} width={78} />
                <CompactRibbonButton label="Yasla" icon="J" onClick={() => commands.setObjectStyle({ textAlign: 'justify' })} width={78} />
              </RibbonMenuGrid>
            </RibbonPopoverButton>
            <RibbonPopoverButton label="Aralık" icon="note" width={72} disabled={disabled}>
              <RibbonStack>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>Satır Aralığı</div>
                <RibbonRow>
                  {[1, 1.2, 1.5, 1.8, 2].map((value) => (
                    <CompactRibbonButton key={value} label={`${value}`} icon="note" onClick={() => commands.setObjectStyle({ lineHeight: value })} width={48} />
                  ))}
                </RibbonRow>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>Harf Aralığı</div>
                <RibbonRow>
                  {[0, 0.5, 1, 2, 3].map((value) => (
                    <CompactRibbonButton key={value} label={`${value}`} icon="note" onClick={() => commands.setObjectStyle({ letterSpacing: value ? `${value}px` : '0' })} width={48} />
                  ))}
                </RibbonRow>
              </RibbonStack>
            </RibbonPopoverButton>
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Şekil Stilleri" width={270}>
        <RibbonRow>
          {galleries.shapeStyles.slice(0, 4).map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              disabled={disabled}
              onClick={() => commands.setObjectStyle(preset.style)}
              style={{
                width: 40,
                height: 36,
                padding: 4,
                border: '1px solid #cbd5e1',
                borderRadius: 5,
                background: '#ffffff',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.42 : 1,
              }}
            >
              <ShapePreviewIcon
                kind={object?.shapeKind || 'roundedRect'}
                fill={preset.style?.background || 'transparent'}
                stroke={preset.style?.borderColor || '#64748b'}
                strokeWidth={Number(preset.style?.borderWidth || 3)}
                preserveAspectRatio="xMidYMid meet"
              />
            </button>
          ))}
          <RibbonPopoverButton label="Diğer" icon="more" width={66} disabled={disabled}>
            <RibbonMenuGrid columns="repeat(3, 46px)">
              {galleries.shapeStyles.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() => commands.setObjectStyle(preset.style)}
                  style={{ width: 42, height: 36, border: '1px solid #cbd5e1', borderRadius: 5, background: '#ffffff' }}
                >
                  <ShapePreviewIcon
                    kind={object?.shapeKind || 'roundedRect'}
                    fill={preset.style?.background || 'transparent'}
                    stroke={preset.style?.borderColor || '#64748b'}
                    strokeWidth={Number(preset.style?.borderWidth || 3)}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </button>
              ))}
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Dolgu / Çizgi" width={128}>
        <RibbonStack>
          <RibbonRow>
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.background, '#ffffff')}
              onChange={(event) => commands.setObjectStyle({ background: event.target.value })}
              disabled={disabled}
              title="Dolgu"
            />
            <RibbonColorInput
              value={controller.resolveColor(object?.style?.borderColor, '#94a3b8')}
              onChange={(event) => commands.setObjectStyle({ borderColor: event.target.value })}
              disabled={disabled}
              title="Çizgi"
            />
          </RibbonRow>
          <RibbonPopoverButton label="Çizgi" icon="border" width={84} disabled={disabled}>
            <RibbonStack>
              {[1, 2, 3, 4, 6, 8].map((value) => (
                <CompactRibbonButton key={value} label={`${value}px`} icon="border" onClick={() => commands.setObjectStyle({ borderWidth: value })} width={74} />
              ))}
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Efektler" width={120}>
        <RibbonPopoverButton label="Efektler" icon="shadow" width={96} disabled={disabled}>
          <RibbonMenuGrid columns="repeat(2, 124px)">
            {EFFECT_PRESETS.map((effect) => (
              <CompactRibbonButton
                key={effect.label}
                label={effect.label}
                icon="shadow"
                onClick={() => commands.setObjectStyle(effect.patch)}
                width={118}
              />
            ))}
          </RibbonMenuGrid>
        </RibbonPopoverButton>
      </RibbonGroup>

      <RibbonGroup title="Sırala ve Hizala" width={230}>
        <RibbonStack>
          <RibbonRow>
            <CompactRibbonButton label="Öne Al" icon="bringFront" onClick={commands.bringFront} disabled={disabled} width={58} />
            <CompactRibbonButton label="Arkaya" icon="sendBack" onClick={commands.sendBack} disabled={disabled} width={58} />
            <CompactRibbonButton
              label={can.ungroup ? 'Ayır' : 'Grupla'}
              icon={can.ungroup ? 'ungroup' : 'group'}
              onClick={can.ungroup ? commands.ungroupSelection : commands.groupSelection}
              disabled={!can.group && !can.ungroup}
              width={58}
            />
          </RibbonRow>
          <RibbonRow>
            {/* Tek öge seçiliyken hizalama sahneye göre çalışır (can.align) */}
            <CompactRibbonButton label="Sola" icon="alignLeft" onClick={() => commands.align('left')} disabled={!can.align} width={52} />
            <CompactRibbonButton label="Orta" icon="alignCenter" onClick={() => commands.align('center')} disabled={!can.align} width={52} />
            <CompactRibbonButton label="Sağa" icon="alignRight" onClick={() => commands.align('right')} disabled={!can.align} width={52} />
            <RibbonPopoverButton label="Diğer" icon="more" width={54} disabled={!can.align}>
              <RibbonMenuGrid columns="repeat(2, 96px)">
                <CompactRibbonButton label="Üste" icon="alignTop" onClick={() => commands.align('top')} disabled={!can.align} width={88} />
                <CompactRibbonButton label="Ortaya" icon="alignMiddle" onClick={() => commands.align('middle')} disabled={!can.align} width={88} />
                <CompactRibbonButton label="Alta" icon="alignBottom" onClick={() => commands.align('bottom')} disabled={!can.align} width={88} />
                <CompactRibbonButton label="Yatay Dağıt" icon="distributeH" onClick={() => commands.distribute('horizontal')} disabled={!can.distribute} width={88} />
                <CompactRibbonButton label="Dikey Dağıt" icon="distributeV" onClick={() => commands.distribute('vertical')} disabled={!can.distribute} width={88} />
              </RibbonMenuGrid>
            </RibbonPopoverButton>
          </RibbonRow>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup title="Boyut ve Konum" width={230}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '14px 44px 14px 44px 16px 44px',
            gap: 4,
            alignItems: 'center',
            fontSize: 10,
            color: '#475569',
          }}
        >
          <span title="X konumu">X</span>
          <RibbonNumberInput value={Math.round(object?.x || 0)} onChange={(event) => commands.patchObject({ x: Number(event.target.value) || 0 })} disabled={disabled} width={44} title="X konumu" />
          <span title="Y konumu">Y</span>
          <RibbonNumberInput value={Math.round(object?.y || 0)} onChange={(event) => commands.patchObject({ y: Number(event.target.value) || 0 })} disabled={disabled} width={44} title="Y konumu" />
          <span title="Döndürme (derece)">D°</span>
          <RibbonNumberInput value={Math.round(object?.rotation || 0)} onChange={(event) => commands.patchObject({ rotation: Number(event.target.value) || 0 })} disabled={disabled} width={44} title="Döndürme (derece)" />
          <span title="Genişlik">G</span>
          <RibbonNumberInput value={Math.round(object?.width || 0)} onChange={(event) => commands.patchObject({ width: Math.max(20, Number(event.target.value) || 20) })} disabled={disabled} width={44} title="Genişlik" />
          <span title="Yükseklik">Yük</span>
          <RibbonNumberInput value={Math.round(object?.height || 0)} onChange={(event) => commands.patchObject({ height: Math.max(20, Number(event.target.value) || 20) })} disabled={disabled} width={44} title="Yükseklik" />
          <span title="Köşe yarıçapı">K</span>
          <RibbonNumberInput value={Math.round(object?.style?.borderRadius || 0)} onChange={(event) => commands.setObjectStyle({ borderRadius: Math.max(0, Number(event.target.value) || 0) })} disabled={disabled} width={44} title="Köşe yarıçapı" />
        </div>
      </RibbonGroup>

      {object?.type === 'hotspot' && (
        <RibbonGroup title="Açılır İçerik" width={150}>
          <RibbonPopoverButton label="Başlık / Açıklama" icon="note" width={120} variant="large" disabled={disabled}>
            <RibbonStack>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>Açılır Başlık</div>
              <input
                value={object.hotspotPopupTitle || ''}
                onChange={(event) => commands.patchObject({ hotspotPopupTitle: event.target.value })}
                placeholder="Başlık"
                style={{ height: 26, width: 240, border: '1px solid #cbd7e6', borderRadius: 6, fontSize: 11, padding: '0 8px' }}
              />
              <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>Açılır Metin</div>
              <textarea
                value={object.hotspotPopupBody || ''}
                onChange={(event) => commands.patchObject({ hotspotPopupBody: event.target.value })}
                placeholder="Açıklama metni"
                rows={3}
                style={{ width: 240, border: '1px solid #cbd7e6', borderRadius: 6, fontSize: 11, padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonGroup>
      )}

      {object?.type === 'shape' && (
        <RibbonGroup title="Düğümler" width={130}>
          <CompactRibbonButton
            label={object.shapeKind === 'customPath' ? 'Düğümler Aktif' : 'Düğümleri Düzenle'}
            icon="border"
            onClick={commands.convertToEditablePoints}
            active={object.shapeKind === 'customPath'}
            width={112}
          />
        </RibbonGroup>
      )}

      {object?.type === 'image' && (
        <RibbonGroup title="Görsel" width={236}>
          <RibbonPopoverButton label="Filtre" icon="image" width={96} disabled={disabled}>
            <RibbonMenuGrid columns="repeat(2, 110px)">
              {IMAGE_FILTER_PRESETS.map((filter) => (
                <CompactRibbonButton
                  key={filter.label}
                  label={filter.label}
                  icon="image"
                  onClick={() => commands.patchObject({ imageFilter: filter.value })}
                  active={(object.imageFilter || '') === filter.value}
                  width={104}
                />
              ))}
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonGroup>
      )}

      {object?.type === 'table' && (
        <RibbonGroup title="Tablo" width={236}>
          <RibbonStack>
            <RibbonRow>
              <CompactRibbonButton label="+ Satır" icon="table" onClick={() => patchTableData(tableAddRow(object.tableData))} width={70} />
              <CompactRibbonButton label="− Satır" icon="table" onClick={() => patchTableData(tableRemoveRow(object.tableData))} width={70} />
              <CompactRibbonButton label="+ Sütun" icon="table" onClick={() => patchTableData(tableAddColumn(object.tableData))} width={70} />
            </RibbonRow>
            <RibbonRow>
              <CompactRibbonButton label="− Sütun" icon="table" onClick={() => patchTableData(tableRemoveColumn(object.tableData))} width={70} />
              <CompactRibbonButton label="Başlık" icon="table" onClick={() => patchTableData(tableToggleHeader(object.tableData))} width={70} />
              <CompactRibbonButton label="Düzenle" icon="text" onClick={() => setTableEditorOpen(true)} width={70} />
            </RibbonRow>
          </RibbonStack>
        </RibbonGroup>
      )}

      {object?.type === 'chart' && (
        <RibbonGroup title="Grafik" width={236}>
          <RibbonStack>
            <RibbonRow>
              {CHART_TYPES.map((type) => (
                <CompactRibbonButton
                  key={type.value}
                  label={type.label}
                  icon="chart"
                  onClick={() => commands.patchObject({ chartType: type.value })}
                  active={(object.chartType || 'bar') === type.value}
                  width={70}
                />
              ))}
            </RibbonRow>
            <CompactRibbonButton label="Veri Düzenle" icon="text" onClick={() => setChartEditorOpen(true)} width={150} />
          </RibbonStack>
        </RibbonGroup>
      )}

      <TableEditorModal
        open={tableEditorOpen && object?.type === 'table'}
        onClose={() => setTableEditorOpen(false)}
        tableData={object?.tableData}
        onChange={patchTableData}
      />

      <ChartEditorModal
        open={chartEditorOpen && object?.type === 'chart'}
        onClose={() => setChartEditorOpen(false)}
        chartType={object?.chartType}
        chartData={object?.chartData}
        onChange={(patch) => commands.patchObject(patch)}
      />
    </>
  );
}
