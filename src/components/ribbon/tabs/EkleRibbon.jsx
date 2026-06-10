import { useReducer } from 'react';

import { ShapePreviewIcon } from '../../ui';
import {
  CompactRibbonButton,
  RibbonButton,
  RibbonGalleryButton,
  RibbonGroup,
  RibbonMenuGrid,
  RibbonPopoverButton,
  RibbonRow,
  RibbonStack,
} from '../RibbonPrimitives';

// Son kullanılan şekiller — oturum boyunca modül kapsamında tutulur (en çok 8).
const recentShapeKinds = [];
function pushRecentShape(kind) {
  const index = recentShapeKinds.indexOf(kind);
  if (index !== -1) recentShapeKinds.splice(index, 1);
  recentShapeKinds.unshift(kind);
  if (recentShapeKinds.length > 8) recentShapeKinds.length = 8;
}

// Marker / etiketli hotspot ön ayarları — hepsi 'hotspot' tipinde, stil/etiket farkıyla.
const MARKER_PRESETS = [
  {
    id: 'classic',
    label: 'Klasik',
    glyph: '?',
    patch: { label: '?', style: { background: '#f4433633', borderColor: '#f44336', borderRadius: 999, color: '#b91c1c' } },
  },
  {
    id: 'info',
    label: 'Bilgi',
    glyph: 'i',
    patch: { label: 'i', hotspotPopupTitle: 'Bilgi', style: { background: '#dbeafe', borderColor: '#2563eb', borderRadius: 999, color: '#1d4ed8' } },
  },
  {
    id: 'number',
    label: 'Numaralı',
    glyph: '1',
    patch: { label: '1', style: { background: '#2563eb', borderColor: '#1d4ed8', borderRadius: 999, color: '#ffffff' } },
  },
  {
    id: 'pin',
    label: 'Pin',
    glyph: '📍',
    patch: { label: '📍', style: { background: 'transparent', borderColor: 'transparent', color: '#ef4444' } },
  },
  {
    id: 'plus',
    label: 'Artı',
    glyph: '+',
    patch: { label: '+', style: { background: '#dcfce7', borderColor: '#16a34a', borderRadius: 999, color: '#15803d' } },
  },
  {
    id: 'star',
    label: 'Yıldız',
    glyph: '★',
    patch: { label: '★', style: { background: '#fef9c3', borderColor: '#eab308', borderRadius: 999, color: '#a16207' } },
  },
];

const shapeSectionHeaderStyle = {
  fontSize: 10,
  fontWeight: 900,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  margin: '2px 0 4px',
};

// Buton galerisi tile'ı — preseti gerçek görünümüyle render eder, hover/down durumlarını önizler
// (factories.js'deki createButtonPresetObject stateStyles ile aynı his).
function ButtonGalleryTile({ preset, onClick }) {
  const style = preset.style || {};
  const baseShadow = style.boxShadow && style.boxShadow !== 'none' ? style.boxShadow : 'none';
  return (
    <button
      type="button"
      title={preset.label}
      onClick={onClick}
      style={{
        height: 44,
        padding: '0 10px',
        borderStyle: 'solid',
        borderWidth: style.borderWidth ?? 2,
        borderColor: style.borderColor || '#1d4ed8',
        borderRadius: style.borderRadius ?? 8,
        background: style.background || '#2563eb',
        color: style.color || '#ffffff',
        fontSize: 13,
        fontWeight: style.fontWeight || 800,
        boxShadow: baseShadow,
        cursor: 'pointer',
        transition: 'filter .12s, transform .06s, box-shadow .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = 'brightness(1.06)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(15,23,42,.16)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'none';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = baseShadow;
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'translateY(1px)';
        e.currentTarget.style.filter = 'brightness(.94)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.filter = 'brightness(1.06)';
      }}
    >
      {preset.label}
    </button>
  );
}

function ShapeGalleryItem({ shape, onClick }) {
  return (
    <RibbonGalleryButton title={shape.label} onClick={onClick} width={28} height={26}>
      <ShapePreviewIcon
        kind={shape.kind}
        fill={shape.style?.background || 'transparent'}
        stroke={shape.style?.borderColor || '#334155'}
        strokeWidth={4}
        preserveAspectRatio="xMidYMid meet"
      />
    </RibbonGalleryButton>
  );
}

export default function EkleRibbon({ controller }) {
  const { commands, galleries } = controller;
  const [, bumpRecentShapes] = useReducer((value) => value + 1, 0);

  const handleInsertShape = (kind) => {
    commands.insertShape(kind);
    pushRecentShape(kind);
    bumpRecentShapes();
  };

  // Şekilleri kategoriye göre, orijinal sırayı koruyarak grupla.
  const shapeCategories = [];
  const shapeCategoryIndex = new Map();
  galleries.shapes.forEach((shape) => {
    const category = shape.category || 'Diğer';
    if (!shapeCategoryIndex.has(category)) {
      shapeCategoryIndex.set(category, shapeCategories.length);
      shapeCategories.push({ category, items: [] });
    }
    shapeCategories[shapeCategoryIndex.get(category)].items.push(shape);
  });

  const recentShapes = recentShapeKinds
    .map((kind) => galleries.shapes.find((shape) => shape.kind === kind))
    .filter(Boolean);

  return (
    <>
      <RibbonGroup title="Metin" width={196}>
        <RibbonRow>
          <RibbonButton label="Metin" icon="text" onClick={() => commands.insertText('body')} tone="slate" />
          <RibbonButton label="Başlık" icon="heading" onClick={() => commands.insertText('heading')} tone="slate" />
          <RibbonButton label="Sembol" icon="Ω" onClick={commands.insertSymbol} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Görsel" width={412}>
        <RibbonRow>
          <RibbonButton label="Resim" icon="image" onClick={commands.insertImage} tone="slate" />
          <RibbonButton label="SVG" icon="code" onClick={commands.loadSvgBackground} tone="slate" />
          <RibbonPopoverButton label="Şekil" icon="shape" width={58} variant="large" tone="slate">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 210 }}>
              {recentShapes.length > 0 && (
                <div>
                  <div style={shapeSectionHeaderStyle}>Son Kullanılan</div>
                  <RibbonMenuGrid columns="repeat(6, 30px)">
                    {recentShapes.map((shape) => (
                      <ShapeGalleryItem
                        key={`recent-${shape.kind}`}
                        shape={shape}
                        onClick={() => handleInsertShape(shape.kind)}
                      />
                    ))}
                  </RibbonMenuGrid>
                </div>
              )}
              {shapeCategories.map((group) => (
                <div key={group.category}>
                  <div style={shapeSectionHeaderStyle}>{group.category}</div>
                  <RibbonMenuGrid columns="repeat(6, 30px)">
                    {group.items.map((shape) => (
                      <ShapeGalleryItem
                        key={shape.kind}
                        shape={shape}
                        onClick={() => handleInsertShape(shape.kind)}
                      />
                    ))}
                  </RibbonMenuGrid>
                </div>
              ))}
            </div>
          </RibbonPopoverButton>
          <RibbonButton label="İkon" icon="star" onClick={commands.insertIcon} tone="slate" />
          <RibbonButton label="Kütüphane" icon="components" onClick={commands.openContentLibrary} tone="slate" />
          <RibbonButton label="Karakter" icon="user" onClick={commands.insertCharacter} tone="slate" />
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Etkileşim" width={252}>
        <RibbonRow>
          <RibbonPopoverButton label="Buton" icon="button" width={58} variant="large" tone="slate">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 264 }}>
              <div style={shapeSectionHeaderStyle}>Buton Stilleri · üzerine gelin / basın</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {galleries.buttonStyles.map((preset) => (
                  <ButtonGalleryTile
                    key={preset.id}
                    preset={preset}
                    onClick={() => commands.insertButtonPreset(preset.id)}
                  />
                ))}
              </div>
            </div>
          </RibbonPopoverButton>
          <RibbonPopoverButton label="Hotspot" icon="hotspot" width={64} variant="large" tone="slate">
            <RibbonMenuGrid columns="repeat(2, 124px)">
              {MARKER_PRESETS.map((preset) => (
                <CompactRibbonButton
                  key={preset.id}
                  label={preset.label}
                  icon={preset.glyph}
                  onClick={() => commands.insertObject('hotspot', preset.patch)}
                  width={118}
                />
              ))}
            </RibbonMenuGrid>
          </RibbonPopoverButton>
          <RibbonPopoverButton label="Sürükle-Bırak" icon="dragdrop" width={86} variant="large" tone="slate">
            <RibbonStack>
              <CompactRibbonButton label="Sürüklenebilir" icon="dragdrop" onClick={() => commands.insertObject('draggable')} width={126} />
              <CompactRibbonButton label="Bırakma Alanı" icon="button" onClick={() => commands.insertObject('dropzone')} width={126} />
              <CompactRibbonButton label="Cevap Merkezi" icon="score" onClick={commands.openAnswerCenter} width={126} />
            </RibbonStack>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>

      <RibbonGroup title="Diğer Ekle" width={278}>
        <RibbonRow>
          <RibbonButton label="Soru" icon="question" onClick={commands.openAnswerCenter} tone="slate" width={58} />
          <RibbonButton label="Tablo" icon="table" onClick={() => commands.insertObject('table')} tone="slate" width={58} />
          <RibbonButton label="Grafik" icon="chart" onClick={() => commands.insertObject('chart')} tone="slate" width={58} />
          <RibbonPopoverButton label="Medya / Bileşen" icon="components" width={92} variant="large" tone="slate">
            <RibbonMenuGrid columns="repeat(2, 124px)">
              <CompactRibbonButton label="Ses" icon="audio" onClick={commands.insertAudio} width={118} />
              <CompactRibbonButton label="Video" icon="video" onClick={commands.insertVideo} width={118} />
              <CompactRibbonButton label="Web Gömme" icon="web" onClick={() => commands.insertObject('embed')} width={118} />
              <CompactRibbonButton label="Etiket" icon="tag" onClick={commands.insertLabel} width={118} />
              <CompactRibbonButton label="Bilgi Kutusu" icon="i" onClick={() => commands.insertComponent('info-box')} width={112} />
              <CompactRibbonButton label="Uyarı" icon="!" onClick={() => commands.insertComponent('warning-box')} width={112} />
              <CompactRibbonButton label="Kart" icon="▤" onClick={() => commands.insertComponent('card')} width={112} />
              <CompactRibbonButton label="Akordeon" icon="☰" onClick={() => commands.insertComponent('accordion')} width={112} />
              <CompactRibbonButton label="Metin Stüdyo" icon="text" onClick={commands.openTextStudio} width={112} />
            </RibbonMenuGrid>
          </RibbonPopoverButton>
        </RibbonRow>
      </RibbonGroup>
    </>
  );
}
