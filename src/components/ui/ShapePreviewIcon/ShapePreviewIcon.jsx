import React from 'react';

export function ShapePreviewIcon({
  kind = 'rect',
  fill = '#e0f2fe',
  stroke = '#2563eb',
  strokeWidth = 4,
  strokeLinejoin = 'round',
  strokeLinecap = 'round',
  cornerRadius = null,
  nonScalingStroke = false,
  fullBleed = false,
  vectorPath = '',
  style = {},
  preserveAspectRatio = 'none',
}) {
  const vectorEffect = nonScalingStroke ? 'non-scaling-stroke' : undefined;
  const lineProps = { stroke, strokeWidth, strokeLinecap, strokeLinejoin, fill: 'none', vectorEffect };
  const solidProps = { stroke, strokeWidth, strokeLinejoin, fill, vectorEffect };
  const roundedRectRadius = Math.max(0, Math.min(34, Number(cornerRadius ?? 12) || 0));
  const box = fullBleed
    ? { x: 0, y: 0, w: 100, h: 100, rx: roundedRectRadius, ellipseRx: 50, ellipseRy: 50 }
    : { x: 8, y: 16, w: 84, h: 68, rx: roundedRectRadius, ellipseRx: 42, ellipseRy: 34 };

  const content = (() => {
    switch (kind) {
      case 'line':
        return <line x1="8" y1="50" x2="92" y2="50" {...lineProps} />;
      case 'lineDiagonalDown':
        return <line x1="10" y1="14" x2="90" y2="86" {...lineProps} />;
      case 'lineDiagonalUp':
        return <line x1="10" y1="86" x2="90" y2="14" {...lineProps} />;
      case 'curve':
        return <path d="M 8 70 C 28 22, 72 22, 92 70" {...lineProps} />;
      case 'freeform':
        return <path d="M 10 72 C 20 30, 34 34, 44 58 S 62 88, 74 44 S 88 18, 94 40" {...lineProps} />;
      case 'arrowRight':
        return <polygon points="7,35 66,35 66,18 94,50 66,82 66,65 7,65" {...solidProps} />;
      case 'arrowLeft':
        return <polygon points="93,35 34,35 34,18 6,50 34,82 34,65 93,65" {...solidProps} />;
      case 'arrowUp':
        return <polygon points="35,93 35,34 18,34 50,6 82,34 65,34 65,93" {...solidProps} />;
      case 'arrowDown':
        return <polygon points="35,7 35,66 18,66 50,94 82,66 65,66 65,7" {...solidProps} />;
      case 'arrowUpRight':
        return (
          <>
            <line x1="16" y1="82" x2="72" y2="26" {...lineProps} />
            <polygon points="66,14 88,12 86,34" fill={stroke} stroke={stroke} strokeLinejoin="round" vectorEffect={vectorEffect} />
          </>
        );
      case 'chevronRight':
        return <polygon points="16,14 62,14 92,50 62,86 16,86 46,50" {...solidProps} />;
      case 'doubleArrow':
        return <polygon points="6,50 28,24 28,38 72,38 72,24 94,50 72,76 72,62 28,62 28,76" {...solidProps} />;
      case 'ellipse':
        return <ellipse cx="50" cy="50" rx={box.ellipseRx} ry={box.ellipseRy} {...solidProps} />;
      case 'triangle':
        return <polygon points="50,8 92,90 8,90" {...solidProps} />;
      case 'rightTriangle':
        return <polygon points="12,10 90,90 12,90" {...solidProps} />;
      case 'diamond':
        return <polygon points="50,6 94,50 50,94 6,50" {...solidProps} />;
      case 'pentagon':
        return <polygon points="50,7 92,38 76,92 24,92 8,38" {...solidProps} />;
      case 'hexagon':
        return <polygon points="26,8 74,8 94,50 74,92 26,92 6,50" {...solidProps} />;
      case 'octagon':
        return <polygon points="32,7 68,7 93,32 93,68 68,93 32,93 7,68 7,32" {...solidProps} />;
      case 'parallelogram':
        return <polygon points="22,8 94,8 78,92 6,92" {...solidProps} />;
      case 'trapezoid':
        return <polygon points="24,12 76,12 94,88 6,88" {...solidProps} />;
      case 'plus':
        return <polygon points="38,8 62,8 62,38 92,38 92,62 62,62 62,92 38,92 38,62 8,62 8,38 38,38" {...solidProps} />;
      case 'cross':
        return <polygon points="25,8 50,33 75,8 92,25 67,50 92,75 75,92 50,67 25,92 8,75 33,50 8,25" {...solidProps} />;
      case 'bracePair':
        return (
          <>
            <path d="M 36 10 C 20 10, 22 28, 22 35 C 22 45, 12 44, 12 50 C 12 56, 22 55, 22 65 C 22 72, 20 90, 36 90" {...lineProps} />
            <path d="M 64 10 C 80 10, 78 28, 78 35 C 78 45, 88 44, 88 50 C 88 56, 78 55, 78 65 C 78 72, 80 90, 64 90" {...lineProps} />
          </>
        );
      case 'flowProcess':
        return <rect x={box.x} y={fullBleed ? 0 : 18} width={box.w} height={fullBleed ? 100 : 64} rx="0" {...solidProps} />;
      case 'flowDecision':
        return <polygon points="50,6 94,50 50,94 6,50" {...solidProps} />;
      case 'flowData':
        return <polygon points="20,18 94,18 80,82 6,82" {...solidProps} />;
      case 'flowTerminator':
        return <rect x={box.x} y={fullBleed ? 0 : 24} width={box.w} height={fullBleed ? 100 : 52} rx={fullBleed ? 50 : 26} {...solidProps} />;
      case 'star5':
        return <polygon points="50,7 61,36 92,38 68,58 76,90 50,72 24,90 32,58 8,38 39,36" {...solidProps} />;
      case 'star8':
        return <polygon points="50,6 62,30 88,12 70,38 94,50 70,62 88,88 62,70 50,94 38,70 12,88 30,62 6,50 30,38 12,12 38,30" {...solidProps} />;
      case 'ribbon':
        return <polygon points="8,20 92,20 80,50 92,80 8,80 20,50" {...solidProps} />;
      case 'calloutRect':
        return <path d="M 10 16 H 90 V 70 H 62 L 48 88 L 50 70 H 10 Z" {...solidProps} />;
      case 'calloutRound':
        return <path d="M 50 12 C 74 12, 92 27, 92 48 C 92 69, 74 84, 50 84 C 44 84, 38 83, 32 81 L 16 92 L 21 74 C 13 68, 8 59, 8 48 C 8 27, 26 12, 50 12 Z" {...solidProps} />;
      case 'calloutCloud':
        return <path d="M 26 72 C 13 72, 8 62, 13 52 C 3 41, 13 25, 29 29 C 36 13, 62 12, 68 29 C 85 26, 97 42, 88 56 C 93 66, 84 76, 70 73 H 58 L 44 90 L 46 73 Z" {...solidProps} />;
      case 'roundedRect':
        return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.rx} {...solidProps} />;
      case 'customPath':
        return <path d={String(vectorPath || 'M 10 90 L 50 10 L 90 90 Z')} {...solidProps} />;
      case 'rect':
      default:
        return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="0" {...solidProps} />;
    }
  })();

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio={preserveAspectRatio}
      shapeRendering="geometricPrecision"
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}

export default ShapePreviewIcon;
