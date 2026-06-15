import {
  normalizePdfText,
  sanitizePdfText,
  detectPdfDraftKind,
  extractPdfQuestionAnchors,
} from '../pdfParser';

import { Btn, Modal } from './uiPrimitives';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Dosya okunamadi.'));
    reader.readAsDataURL(file);
  });
}

function formatBookLockMessage(lock, fallback = '') {
  if (!lock) return fallback || 'Bu kitap su anda kilitli.';
  const owner = lock.userName || lock.userId || 'Baska bir kullanici';
  const time = lock.lockedAt ? new Date(lock.lockedAt).toLocaleString('tr-TR') : '';
  return `${owner} bu kitapta calisiyor.${time ? ` Kilit baslangici: ${time}.` : ''}`;
}

function buildCanvasPreviewDataUrl(canvas, maxSide = 1280, quality = 0.82) {
  if (!canvas?.width || !canvas?.height) return '';
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  if (scale >= 0.999) {
    return canvas.toDataURL('image/jpeg', quality);
  }
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  previewCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const previewContext = previewCanvas.getContext('2d', { alpha: false });
  if (!previewContext) {
    return canvas.toDataURL('image/jpeg', quality);
  }
  previewContext.fillStyle = '#ffffff';
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
  return previewCanvas.toDataURL('image/jpeg', quality);
}

function normalizePdfHintRect(rect, maxWidth = 1920, maxHeight = 1080, minSize = 18) {
  if (!rect || typeof rect !== 'object') return null;
  const width = clamp(Number(rect.width || 0), minSize, maxWidth);
  const height = clamp(Number(rect.height || 0), minSize, maxHeight);
  const x = clamp(Number(rect.x || 0), 0, Math.max(0, maxWidth - width));
  const y = clamp(Number(rect.y || 0), 0, Math.max(0, maxHeight - height));
  return { x, y, width, height };
}

function mergePdfTermLists(...lists) {
  return [
    ...new Set(
      lists
        .flatMap((list) => (Array.isArray(list) ? list : []))
        .map((item) => sanitizePdfText(item))
        .filter(Boolean)
    ),
  ];
}

function mapStoryboardInteractionTypeToDraftKind(interactionType = '') {
  if (interactionType === 'DragDrop') return 'drag-drop';
  if (interactionType === 'TrueFalse' || interactionType === 'Checkbox') return 'selection';
  if (interactionType === 'Ordering') return 'sequence';
  if (interactionType === 'MediaSlayt') return 'video';
  return null;
}

function pickPrimaryStoryboardInteraction(storyboardPages = []) {
  const priorities = ['DragDrop', 'Ordering', 'TrueFalse', 'Checkbox', 'MediaSlayt', 'Content'];
  return (
    priorities.find((type) => storyboardPages.some((page) => page?.interactionType === type)) ||
    'Content'
  );
}

function extractStoryboardTermLists(storyboardPages = []) {
  const dragTerms = [];
  const answerTerms = [];

  (Array.isArray(storyboardPages) ? storyboardPages : []).forEach((page) => {
    if (Array.isArray(page?.draggableItems)) {
      dragTerms.push(...page.draggableItems);
    }
    if (Array.isArray(page?.dropZones)) {
      answerTerms.push(...page.dropZones.map((zone) => zone?.correctAnswer || '').filter(Boolean));
    }
    if (page?.interactionType === 'Ordering' && Array.isArray(page?.items)) {
      const orderedTexts = [...page.items]
        .sort((a, b) => Number(a?.correctOrder || 0) - Number(b?.correctOrder || 0))
        .map((item) => sanitizePdfText(item?.text || ''))
        .filter(Boolean);
      dragTerms.push(...orderedTexts);
      answerTerms.push(...orderedTexts);
    }
  });

  return {
    draggableTerms: mergePdfTermLists(dragTerms),
    answerTerms: mergePdfTermLists(answerTerms),
  };
}

function buildPdfSelectionBlueprint(storyboardPages = []) {
  for (const page of Array.isArray(storyboardPages) ? storyboardPages : []) {
    if (page?.interactionType === 'TrueFalse' && Array.isArray(page?.items) && page.items.length) {
      const mcOptions = page.items
        .map((item) => ({
          id: uid(),
          label: sanitizePdfText(item?.statement || ''),
          isCorrect: String(item?.correctAnswer || '').toUpperCase() === 'D',
        }))
        .filter((item) => item.label);
      if (mcOptions.length) {
        return {
          mcMode: 'multi',
          mcQuestion: sanitizePdfText(
            page?.instruction || 'Aşağıdaki ifadelerden doğru olanları işaretleyiniz.'
          ),
          mcOptions,
        };
      }
    }

    if (page?.interactionType === 'Checkbox' && Array.isArray(page?.items) && page.items.length) {
      const mcOptions = page.items
        .map((item) => ({
          id: uid(),
          label: sanitizePdfText(item?.text || ''),
          isCorrect: !!item?.correctAnswer,
        }))
        .filter((item) => item.label);
      if (mcOptions.length) {
        return {
          mcMode: 'multi',
          mcQuestion: sanitizePdfText(page?.instruction || 'Uygun kutucukları işaretleyiniz.'),
          mcOptions,
        };
      }
    }
  }

  return null;
}

function countStoryboardExtractedItems(storyboardPages = []) {
  return (Array.isArray(storyboardPages) ? storyboardPages : []).reduce((total, page) => {
    if (Array.isArray(page?.items)) return total + page.items.length;
    if (Array.isArray(page?.dropZones)) return total + page.dropZones.length;
    return total;
  }, 0);
}

function createPdfStatusEntry(message = '', tone = 'info') {
  const safeMessage = sanitizePdfText(message);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeMessage,
    tone,
    time: new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}

function appendPdfImportLog(logs = [], entry = null) {
  if (!Array.isArray(logs) || !entry?.message) return logs;
  const previous = logs[logs.length - 1];
  if (previous?.message === entry.message && previous?.tone === entry.tone) {
    return logs;
  }
  logs.push(entry);
  return logs;
}

function getPdfLogPalette(tone = 'info') {
  if (tone === 'error')
    return { bg: 'rgba(127,29,29,.28)', border: 'rgba(248,113,113,.35)', text: '#fecaca' };
  if (tone === 'warn')
    return { bg: 'rgba(120,53,15,.28)', border: 'rgba(251,191,36,.35)', text: '#fde68a' };
  if (tone === 'success')
    return { bg: 'rgba(20,83,45,.28)', border: 'rgba(74,222,128,.35)', text: '#bbf7d0' };
  return { bg: 'rgba(30,41,59,.55)', border: 'rgba(148,163,184,.22)', text: '#e2e8f0' };
}

function PdfImportLogPanel({ importItem }) {
  if (!importItem) return null;
  const logs = Array.isArray(importItem.logs) ? importItem.logs : [];
  const storyboardPages = Array.isArray(importItem?.storyboardConfig?.pages)
    ? importItem.storyboardConfig.pages
    : [];
  const interactionCounts = storyboardPages.reduce((acc, page) => {
    const key = page?.interactionType || 'Content';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const interactionSummary = Object.entries(interactionCounts)
    .map(([label, count]) => `${label}: ${count}`)
    .join(' · ');
  const extractedItemCount = (Array.isArray(importItem.items) ? importItem.items : []).reduce(
    (total, item) => total + Number(item?.extractedItemCount || 0),
    0
  );

  return (
    <details
      style={{
        marginTop: 10,
        border: '1px dashed #cbd5e1',
        borderRadius: 14,
        background: '#f8fafc',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          padding: '10px 12px',
          fontSize: 11,
          fontWeight: 800,
          color: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>PDF Log Kaydi</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{logs.length} kayit</span>
      </summary>
      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              background: '#e2e8f0',
              color: '#0f172a',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {importItem.pageCount || storyboardPages.length || 0} sayfa
          </span>
          {interactionSummary ? (
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                background: '#dbeafe',
                color: '#1d4ed8',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {interactionSummary}
            </span>
          ) : null}
          {extractedItemCount ? (
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                background: '#dcfce7',
                color: '#166534',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {extractedItemCount} oge cikarildi
            </span>
          ) : null}
        </div>
        {logs.length ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 220,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {logs.map((entry) => {
              const palette = getPdfLogPalette(entry?.tone || 'info');
              return (
                <div
                  key={entry.id}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    background: palette.bg,
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ fontSize: 11, color: palette.text, fontWeight: 700 }}>
                    {entry.message}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{entry.time}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#64748b' }}>Bu import icin kayit bulunmuyor.</div>
        )}
      </div>
    </details>
  );
}

function PdfImportStatusModal({ open, busy, message, error, logs = [], onClose }) {
  if (!open) return null;
  const statusText = error ? 'Hata' : busy ? 'Islem devam ediyor' : 'Islem tamamladi';
  const statusColor = error ? '#fecaca' : busy ? '#c7d2fe' : '#bbf7d0';
  const statusInk = error ? '#b91c1c' : busy ? '#4338ca' : '#166534';
  return (
    <Modal title="PDF Islem Durumu" onClose={busy ? () => {} : onClose} width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: '#0f172a',
            border: '1px solid #334155',
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>
              {message || (busy ? 'PDF analiz ediliyor...' : 'Son durum hazir.')}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              PDF tamamen cevrimdisi analiz edilir.
            </div>
          </div>
          <div
            style={{
              whiteSpace: 'nowrap',
              padding: '6px 10px',
              borderRadius: 999,
              background: statusColor,
              color: statusInk,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {statusText}
          </div>
        </div>
        {error ? (
          <div
            style={{
              fontSize: 12,
              color: '#fecaca',
              background: 'rgba(127,29,29,.35)',
              border: '1px solid rgba(248,113,113,.35)',
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            {error}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 260,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {(logs.length
            ? logs
            : [createPdfStatusEntry(message || 'Hazirlaniyor...', busy ? 'info' : 'success')]
          ).map((entry) => {
            const palette =
              entry.tone === 'error'
                ? { bg: 'rgba(127,29,29,.28)', border: 'rgba(248,113,113,.35)', text: '#fecaca' }
                : entry.tone === 'warn'
                  ? { bg: 'rgba(120,53,15,.28)', border: 'rgba(251,191,36,.35)', text: '#fde68a' }
                  : entry.tone === 'success'
                    ? { bg: 'rgba(20,83,45,.28)', border: 'rgba(74,222,128,.35)', text: '#bbf7d0' }
                    : {
                        bg: 'rgba(30,41,59,.55)',
                        border: 'rgba(148,163,184,.22)',
                        text: '#e2e8f0',
                      };
            return (
              <div
                key={entry.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: palette.bg,
                  padding: '9px 10px',
                }}
              >
                <div style={{ fontSize: 12, color: palette.text, fontWeight: 700 }}>
                  {entry.message}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{entry.time}</div>
              </div>
            );
          })}
        </div>
        {!busy ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn onClick={onClose} color="#7C4DFF">
              Kapat
            </Btn>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function splitPdfLineSegments(segments = []) {
  const ordered = [...segments].sort((a, b) => a.x - b.x);
  if (!ordered.length) return [];

  const groups = [];
  let currentGroup = [];

  ordered.forEach((segment, index) => {
    if (!currentGroup.length) {
      currentGroup.push(segment);
      return;
    }

    const previous = currentGroup[currentGroup.length - 1];
    const gap = segment.x - (previous.x + previous.width);
    const currentText = currentGroup
      .map((item) => item.text)
      .join(' ')
      .trim();
    const remainingText = ordered
      .slice(index)
      .map((item) => item.text)
      .join(' ')
      .trim();
    const shouldSplit =
      gap > Math.max(120, Math.min(280, (previous.height || 20) * 8)) &&
      currentText.length >= 10 &&
      remainingText.length >= 10;

    if (shouldSplit) {
      groups.push(currentGroup);
      currentGroup = [segment];
      return;
    }

    currentGroup.push(segment);
  });

  if (currentGroup.length) groups.push(currentGroup);
  return groups;
}

function buildPdfTextLines(items = [], viewport = { width: 0, height: 0 }) {
  const buckets = new Map();
  items.forEach((item) => {
    const text = sanitizePdfText(item?.str || '');
    if (!text) return;
    const transform = item?.transform || [];
    const x = Number(transform[4] || 0);
    const y = Number(transform[5] || 0);
    const height = Math.abs(Number(transform[3] || item?.height || 12));
    const key = Math.round(y / 4) * 4;
    if (!buckets.has(key)) {
      buckets.set(key, { y, height, segments: [] });
    }
    buckets.get(key).segments.push({ text, x, width: Number(item?.width || 0) });
  });

  return [...buckets.values()]
    .flatMap((row) => {
      const segments = row.segments.sort((a, b) => a.x - b.x);
      return splitPdfLineSegments(segments).map((group) => {
        let lineText = '';
        let cursor = null;
        let maxWidth = 0;
        group.forEach((segment, index) => {
          const gap = cursor == null ? 0 : segment.x - cursor;
          const needsSpace = index > 0 && gap > 2;
          lineText += `${needsSpace ? ' ' : ''}${segment.text}`;
          cursor = segment.x + segment.width;
          maxWidth = Math.max(maxWidth, cursor);
        });
        const minX = Math.min(...group.map((segment) => segment.x));
        return {
          text: sanitizePdfText(lineText),
          x: minX,
          y: row.y,
          height: row.height,
          width: Math.max(0, maxWidth - minX),
          pageWidth: Number(viewport?.width || 0),
          pageHeight: Number(viewport?.height || 0),
          tokens: group.map((segment) => ({
            text: segment.text,
            x: segment.x,
            width: segment.width,
            height: row.height,
          })),
        };
      });
    })
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y || a.x - b.x);
}

function detectPdfMarker(lines = []) {
  const candidates = lines.slice(0, 8).map((line) => normalizePdfText(line.text));
  for (const line of candidates) {
    const eIcerikMatch = line.match(/(^|\b)(\d+)\s*[.)-]?\s*(e\s*-?\s*icerik|icerik|etkinlik)\b/);
    if (eIcerikMatch) {
      const order = Number(eIcerikMatch[2]) || 0;
      return {
        key: `${order}-etkinlik`,
        label: `${order}. Etkinlik`,
        index: order,
        kindHint: 'activity',
      };
    }
    const videoMatch = line.match(/(^|\b)(\d+)\s*[.)-]?\s*video\b/);
    if (videoMatch) {
      const order = Number(videoMatch[2]) || 0;
      return {
        key: `${order}-video`,
        label: `${order}. Video`,
        index: order,
        kindHint: 'video',
      };
    }
  }
  return null;
}

function buildFallbackPdfGroups(pages = []) {
  const groups = [];
  let currentGroup = null;

  pages.forEach((page, index) => {
    const pageKind = detectPdfDraftKind(page.lines || [], 1, page.marker || null);
    const readingLike = pageKind === 'reading' || pageKind === 'unknown';
    const shouldStartNewGroup = (() => {
      if (!currentGroup) return true;
      const currentReadingOnly = currentGroup.pageKinds.every(
        (kind) => kind === 'reading' || kind === 'unknown'
      );
      if (currentReadingOnly && readingLike) return false;
      if (currentReadingOnly && !readingLike && !currentGroup.hasTerminalInteractivePage) {
        currentGroup.hasTerminalInteractivePage = true;
        return false;
      }
      return true;
    })();

    if (shouldStartNewGroup) {
      currentGroup = {
        id: uid(),
        markerKey: `fallback-${index + 1}`,
        markerLabel: `Etkinlik ${groups.length + 1}`,
        markerIndex: groups.length + 1,
        pages: [],
        pageKinds: [],
        hasTerminalInteractivePage: false,
      };
      groups.push(currentGroup);
    }

    currentGroup.pages.push(page);
    currentGroup.pageKinds.push(pageKind);
  });

  return groups;
}

function inferPdfDraftTitle(lines = [], fallback = 'PDF Etkinligi') {
  const ignored = [
    'tema',
    'sozun ezgisi',
    'dunden bugune',
    'kelimelerin ritmi',
    'e-icerik',
    'video',
  ];
  const strongLine = lines.find((line) => {
    const normalized = normalizePdfText(line.text);
    if (!normalized || normalized.length < 8 || normalized.length > 160) return false;
    if (ignored.some((word) => normalized.includes(word))) return false;
    return true;
  });
  return strongLine?.text || fallback;
}

function detectPdfDraftStatus(kind = 'unknown', details = {}) {
  if (kind === 'drag-drop' && details.draggableTerms?.length && details.answerTerms?.length)
    return 'ready';
  if (kind === 'drag-drop' && details.draggableTerms?.length) return 'review';
  if (kind === 'selection') return 'review';
  if (kind === 'reading' || kind === 'sequence' || kind === 'video') return 'review';
  return 'blocked';
}

function inferPdfSelectionAnchors(lines = [], pageWidth = 1920, pageHeight = 1080) {
  const ignored = [
    'tema',
    'dunden bugune',
    'kutucugu',
    'isaretleyiniz',
    'e-icerik',
    'dogru eslestirme',
    'suruklenebilir',
    'yerlere uygun',
    'gunumuz turkcesiyle',
  ];
  const candidates = (lines || [])
    .map((line) => {
      const normalized = normalizePdfText(line.text);
      return { ...line, normalized };
    })
    .filter((line) => {
      if (!line.normalized || line.normalized.length < 8) return false;
      if (ignored.some((token) => line.normalized.includes(token))) return false;
      if (line.x > pageWidth * 0.16) return false;
      if (line.width < pageWidth * 0.22) return false;
      if (line.y < pageHeight * 0.22 || line.y > pageHeight * 0.88) return false;
      if (/^[dy]$/.test(line.normalized)) return false;
      return true;
    })
    .sort((a, b) => a.y - b.y);

  const anchors = [];
  candidates.forEach((line) => {
    const existing = anchors[anchors.length - 1];
    if (existing && Math.abs(existing.stageY - line.y) < Math.max(18, line.height * 0.8)) {
      existing.text = `${existing.text} ${line.text}`.trim();
      existing.width = Math.max(existing.width, line.x + line.width - existing.x);
      existing.height = Math.max(existing.height, line.height);
      return;
    }
    anchors.push({
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height || 28,
      stageY: line.y,
      order: anchors.length + 1,
    });
  });

  return anchors.slice(0, 16);
}

function shouldUsePdfBottomOrigin(lines = [], pageHeight = 1080) {
  if (!Array.isArray(lines) || !lines.length) return false;
  const values = lines
    .map((line) => Number(line?.y || 0))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return false;
  const maxY = Math.max(...values);
  return maxY > pageHeight * 0.5;
}

function getPdfStageRectForLines(
  lines = [],
  pageWidth = 1365,
  pageHeight = 768,
  paddingX = 18,
  paddingY = 14
) {
  if (!Array.isArray(lines) || !lines.length) return null;
  const points = lines.map((line) => {
    const x = Number(line?.x || 0);
    const width = Math.max(12, Number(line?.width || 0));
    const height = Math.max(12, Number(line?.height || 0));
    const y = Math.max(0, Number(line?.y || 0));
    return { x, y, width, height };
  });
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - paddingX);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - paddingY);
  const maxX = Math.min(
    pageWidth,
    Math.max(...points.map((point) => point.x + point.width)) + paddingX
  );
  const maxY = Math.min(
    pageHeight,
    Math.max(...points.map((point) => point.y + point.height)) + paddingY
  );
  return {
    x: minX,
    y: minY,
    width: Math.max(24, maxX - minX),
    height: Math.max(24, maxY - minY),
  };
}

function getPdfQuestionAnchors(page = {}) {
  const width = page.width || 1920;
  const height = page.height || 1080;
  const anchors = Array.isArray(page?.layoutHints?.questionAnchors)
    ? page.layoutHints.questionAnchors
    : [];
  return anchors
    .map((anchor, index) => ({
      text: sanitizePdfText(anchor?.text || ''),
      x: clamp(Number(anchor?.x || 0), 0, width),
      y: clamp(Number(anchor?.y || 0), 0, height),
      width: clamp(Number(anchor?.width || 0), 24, width),
      height: clamp(Number(anchor?.height || 0), 20, height),
      stageY: clamp(Number(anchor?.y || 0), 0, height),
      order: Math.max(1, Math.round(Number(anchor?.order || index + 1))),
    }))
    .sort((a, b) => a.order - b.order || a.y - b.y || a.x - b.x);
}

function getPdfDragPoolRect(page = {}) {
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const width = page.width || 1920;
  const height = page.height || 1080;
  const hintRect = normalizePdfHintRect(page?.layoutHints?.dragPoolRect, width, height, 28);
  if (hintRect) {
    return { ...hintRect, headerLine: null, source: 'layout' };
  }
  const headerLine = lines.find((line) =>
    normalizePdfText(line.text).includes('suruklenebilir ogeler')
  );
  if (!headerLine) return null;

  const answerLine = lines.find((line) => normalizePdfText(line.text).includes('dogru eslestirme'));
  const headerY = Number(headerLine?.y || 0);
  const headerX = Number(headerLine?.x || width * 0.68);
  const answerY = answerLine ? Number(answerLine?.y || 0) : height;

  // Content lines are those below the header, in the same X-column, and above the answer section
  const contentLines = lines.filter((line) => {
    const ly = Number(line?.y || 0);
    const lx = Number(line?.x || 0);
    if (ly <= headerY + (headerLine?.height || 12)) return false;
    if (answerLine && ly >= answerY) return false;
    return lx >= headerX - width * 0.03;
  });

  const contentRect = contentLines.length
    ? getPdfStageRectForLines(contentLines, width, height, 16, 12)
    : null;
  const headerBottom = clamp(headerY + Number(headerLine?.height || 0) + 10, 0, height - 80);
  const x = clamp(Math.max(headerX - 18, width * 0.58), 0, width - 160);
  const rightEdge = clamp(
    contentRect ? contentRect.x + contentRect.width + 18 : width - 24,
    x + 180,
    width - 20
  );
  const bottom = clamp(
    contentRect
      ? contentRect.y + contentRect.height + 8
      : headerBottom + Math.max(160, height * 0.3),
    headerBottom + 120,
    height - 20
  );

  return {
    x,
    y: headerBottom,
    width: Math.max(180, rightEdge - x),
    height: Math.max(120, bottom - headerBottom),
    headerLine,
  };
}

function detectCanvasContentBounds(canvas, threshold = 244, sampleStep = 3) {
  if (!canvas?.width || !canvas?.height) return null;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const a = imageData[index + 3];
      if (a < 8) continue;
      if (r >= threshold && g >= threshold && b >= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0 || maxY < 0) return null;
  const padX = Math.max(20, Math.round(width * 0.02));
  const padY = Math.max(20, Math.round(height * 0.02));
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    width: Math.min(width, maxX - minX + padX * 2),
    height: Math.min(height, maxY - minY + padY * 2),
  };
}

function mapPdfLinesToStage(lines = [], transform = {}) {
  const scaleX = Number(transform.scaleX || 1);
  const scaleY = Number(transform.scaleY || 1);
  const offsetX = Number(transform.offsetX || 0);
  const offsetY = Number(transform.offsetY || 0);
  const pageHeight = Number(
    lines.find((line) => Number(line?.pageHeight || 0) > 0)?.pageHeight || 0
  );
  const useBottomOrigin = pageHeight > 0 ? shouldUsePdfBottomOrigin(lines, pageHeight) : false;
  return (lines || []).map((line) => ({
    ...line,
    x: offsetX + Number(line?.x || 0) * scaleX,
    y: useBottomOrigin
      ? offsetY +
        Math.max(0, pageHeight - (Number(line?.y || 0) + Math.max(1, Number(line?.height || 0)))) *
          scaleY
      : offsetY + Number(line?.y || 0) * scaleY,
    width: Math.max(1, Number(line?.width || 0) * scaleX),
    height: Math.max(1, Number(line?.height || 0) * scaleY),
    tokens: (Array.isArray(line?.tokens) ? line.tokens : []).map((token) => ({
      ...token,
      x: offsetX + Number(token?.x || 0) * scaleX,
      y: useBottomOrigin
        ? offsetY +
          Math.max(
            0,
            pageHeight -
              (Number(line?.y || 0) + Math.max(1, Number(token?.height || line?.height || 0)))
          ) *
            scaleY
        : offsetY + Number(line?.y || 0) * scaleY,
      width: Math.max(1, Number(token?.width || 0) * scaleX),
      height: Math.max(1, Number(token?.height || 0) * scaleY),
    })),
  }));
}

function paintPdfCleanupRect(context, rect, bgColor = null) {
  if (!context || !rect) return;
  // Use provided bgColor or default to white if not sampling
  context.fillStyle = bgColor || '#ffffff';
  context.fillRect(
    Math.max(0, rect.x),
    Math.max(0, rect.y),
    Math.max(1, rect.width),
    Math.max(1, rect.height)
  );
}

function samplePdfCanvasBackgroundColor(canvas, nearRect) {
  if (!canvas?.width || !canvas?.height || !nearRect) return '#ffffff';
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#ffffff';
  const sampleX = Math.max(0, Math.round(nearRect.x - 12));
  const sampleY = Math.max(0, Math.round(nearRect.y + (nearRect.height || 0) * 0.5 - 4));
  const sampleW = Math.min(8, canvas.width - sampleX);
  const sampleH = Math.min(8, canvas.height - sampleY);
  if (sampleW < 1 || sampleH < 1) return '#ffffff';
  const data = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
  let sumR = 0,
    sumG = 0,
    sumB = 0,
    count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue;
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    count++;
  }
  if (!count) return '#ffffff';
  const r = Math.round(sumR / count),
    g = Math.round(sumG / count),
    b = Math.round(sumB / count);
  return `rgb(${r},${g},${b})`;
}

function detectPdfGreenCells(canvas, region = {}) {
  if (!canvas?.width || !canvas?.height) return [];
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const cw = canvas.width,
    ch = canvas.height;
  const sx = Math.max(0, Math.floor(region.x ?? cw * 0.5));
  const sy = Math.max(0, Math.floor(region.y ?? 0));
  const ex = Math.min(cw, Math.ceil(sx + (region.width ?? cw * 0.5)));
  const ey = Math.min(ch, Math.ceil(sy + (region.height ?? ch)));
  const rw = ex - sx,
    rh = ey - sy;
  if (rw < 2 || rh < 2) return [];
  const data = ctx.getImageData(sx, sy, rw, rh).data;
  const step = 2;
  const gh = Math.ceil(rh / step);
  const gw = Math.ceil(rw / step);
  const greenGrid = new Uint8Array(gh * gw);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = gx * step,
        py = gy * step;
      const i = (py * rw + px) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (a < 20) continue;
      if (r > 235 && g > 235 && b > 235) continue; // white
      if (r < 20 && g < 20 && b < 20) continue; // black text
      if (g > 100 && g > r + 15 && g > b - 30) {
        greenGrid[gy * gw + gx] = 1;
      }
    }
  }
  const cells = [];
  let inRun = false,
    runStartY = 0,
    runMinX = gw,
    runMaxX = -1;
  for (let gy = 0; gy <= gh; gy++) {
    let rowMinX = gw,
      rowMaxX = -1;
    if (gy < gh) {
      for (let gx = 0; gx < gw; gx++) {
        if (greenGrid[gy * gw + gx]) {
          rowMinX = Math.min(rowMinX, gx);
          rowMaxX = Math.max(rowMaxX, gx);
        }
      }
    }
    const hasGreen = rowMaxX >= 0;
    if (hasGreen) {
      if (!inRun) {
        inRun = true;
        runStartY = gy;
        runMinX = rowMinX;
        runMaxX = rowMaxX;
      } else {
        runMinX = Math.min(runMinX, rowMinX);
        runMaxX = Math.max(runMaxX, rowMaxX);
      }
    } else if (inRun) {
      const cellH = (gy - runStartY) * step;
      const cellW = (runMaxX - runMinX + 1) * step;
      if (cellH >= 6 && cellW >= 6) {
        const cx = sx + runMinX * step,
          cy = sy + runStartY * step;
        cells.push({
          x: cx,
          y: cy,
          width: cellW,
          height: cellH,
          centerX: cx + cellW / 2,
          centerY: cy + cellH / 2,
        });
      }
      inRun = false;
      runMinX = gw;
      runMaxX = -1;
    }
  }
  return cells;
}

function detectRedAnnotationBounds(canvas, region = {}) {
  if (!canvas?.width || !canvas?.height) return null;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const width = canvas.width;
  const height = canvas.height;
  const startX = Math.max(0, Math.floor(region.x ?? width * 0.55));
  const startY = Math.max(0, Math.floor(region.y ?? height * 0.72));
  const endX = Math.min(
    width,
    Math.ceil((region.x ?? width * 0.55) + (region.width ?? width * 0.4))
  );
  const endY = Math.min(
    height,
    Math.ceil((region.y ?? height * 0.72) + (region.height ?? height * 0.24))
  );
  const imageData = context.getImageData(
    startX,
    startY,
    Math.max(1, endX - startX),
    Math.max(1, endY - startY)
  ).data;
  let minX = endX;
  let minY = endY;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < endY - startY; y += 2) {
    for (let x = 0; x < endX - startX; x += 2) {
      const index = (y * (endX - startX) + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const a = imageData[index + 3];
      if (a < 20) continue;
      if (!(r > 160 && g < 170 && b < 190 && r - g > 35)) continue;
      minX = Math.min(minX, startX + x);
      minY = Math.min(minY, startY + y);
      maxX = Math.max(maxX, startX + x);
      maxY = Math.max(maxY, startY + y);
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  return {
    x: Math.max(0, minX - 18),
    y: Math.max(0, minY - 14),
    width: Math.min(width, maxX - minX + 36),
    height: Math.min(height, maxY - minY + 28),
  };
}

function estimatePdfRowHeight(anchors = [], pageHeight = 768) {
  const gaps = anchors
    .slice(1)
    .map((anchor, index) => anchor.stageY - anchors[index].stageY)
    .filter((gap) => gap > 24 && gap < pageHeight * 0.25);
  if (!gaps.length) return clamp(pageHeight * 0.08, 42, 86);
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return clamp(avgGap * 0.78, 40, 88);
}

function getMedian(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function clusterPdfColumnCenters(values = [], tolerance = 120) {
  const sorted = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return [];

  const clusters = [[sorted[0]]];
  for (let index = 1; index < sorted.length; index += 1) {
    const value = sorted[index];
    const current = clusters[clusters.length - 1];
    const currentCenter = current.reduce((sum, item) => sum + item, 0) / current.length;
    if (Math.abs(value - currentCenter) <= tolerance) {
      current.push(value);
    } else {
      clusters.push([value]);
    }
  }

  return clusters.map((cluster) => getMedian(cluster));
}

function compactPdfColumnLabel(value = '', index = 0) {
  const text = sanitizePdfText(value);
  if (!text) return `${index + 1}`;
  const roman = text.match(/\b([ivxlcdm]+|\d+)\b/i)?.[1];
  if (roman) return roman.toUpperCase();
  if (text.length <= 14) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .slice(0, 2)
      .map((word) => word[0])
      .join('');
    if (initials.length >= 2) return initials.toUpperCase();
  }
  return text.slice(0, 10).trim();
}

function stripPdfAnchorListPrefix(value = '') {
  return sanitizePdfText(value)
    .replace(/^\s*(?:(?:\(?\d+\)?|\(?[a-zçğıöşü]\)?)\s*[.)\-:]|[-•●▪])\s*/iu, '')
    .trim();
}

function stripTrailingCheckMark(value = '') {
  return sanitizePdfText(value)
    .replace(/\s+[☑☐✓✔✗✘]\s*$/u, '')
    .trim();
}

function inferPdfTableChoiceColumns(lines = [], centers = [], width = 1920, height = 1080) {
  if (!Array.isArray(centers) || !centers.length) return [];
  const candidateRows = (Array.isArray(lines) ? lines : [])
    .filter((line) => Number(line?.y || 0) < height * 0.45)
    .filter((line) => {
      const normalized = normalizePdfText(line?.text || '');
      return (
        normalized &&
        !normalized.includes('isaretleyiniz') &&
        !normalized.includes('kutucugu') &&
        !normalized.includes('kutucuklarini') &&
        !normalized.includes('tema') &&
        !/[✓✔☑]/.test(line?.text || '')
      );
    });

  return centers.map((center, index) => {
    let bestToken = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    candidateRows.forEach((line) => {
      (Array.isArray(line?.tokens) ? line.tokens : []).forEach((token) => {
        const tokenText = sanitizePdfText(token?.text || '');
        if (!tokenText || /[✓✔☑]/.test(tokenText)) return;
        const tokenCenter = Number(token?.x || 0) + Math.max(8, Number(token?.width || 0)) / 2;
        const distance = Math.abs(tokenCenter - center);
        if (distance < bestDistance && distance <= 180) {
          bestDistance = distance;
          bestToken = tokenText;
        }
      });
    });

    return {
      key: `col_${index + 1}`,
      label: compactPdfColumnLabel(bestToken || '', index),
      fullLabel: sanitizePdfText(bestToken || ''),
      center,
    };
  });
}

function findPdfAnchorLineForText(lines = [], target = '', usedLineIds = new Set()) {
  const normalizedTarget = normalizePdfText(target);
  if (!normalizedTarget) return null;

  const candidates = (Array.isArray(lines) ? lines : [])
    // Dedup satir nesnesi REFERANSIYLA yapilir; satirlarda kararli bir id alani
    // olmayabilir (buildPdfTextLines id uretmiyor), bu yuzden line.id ile dedup
    // ikinci ogeden sonra tum satirlari eliyordu.
    .filter((line) => !usedLineIds.has(line))
    .map((line) => {
      const cleanedText = stripTrailingCheckMark(
        stripPdfAnchorListPrefix(sanitizePdfText(line?.text || ''))
      );
      const normalizedLine = normalizePdfText(cleanedText);
      const exact = normalizedLine === normalizedTarget;
      const contains =
        normalizedLine.includes(normalizedTarget) || normalizedTarget.includes(normalizedLine);
      return {
        line,
        exact,
        contains,
        score: Math.abs(normalizedLine.length - normalizedTarget.length),
      };
    })
    .filter((entry) => entry.exact || entry.contains)
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.score !== b.score) return a.score - b.score;
      return a.line.y - b.line.y || a.line.x - b.line.x;
    });

  return candidates[0]?.line || null;
}

function buildPdfSelectionLayoutFromStoryboard(draft = {}, page = {}) {
  const storyboardPage = (Array.isArray(draft?.storyboardPages) ? draft.storyboardPages : []).find(
    (entry) => Number(entry?.pageNumber || 0) === Number(page?.pageNumber || 0)
  );
  if (!storyboardPage) return null;

  const lines = Array.isArray(page?.lines) ? page.lines : [];
  const width = page.width || 1920;
  const height = page.height || 1080;
  const usedLineIds = new Set();

  if (
    storyboardPage.interactionType === 'Checkbox' &&
    Array.isArray(storyboardPage.items) &&
    storyboardPage.items.length
  ) {
    const anchors = storyboardPage.items
      .map((item, index) => {
        const line = findPdfAnchorLineForText(lines, item?.text || '', usedLineIds);
        if (!line) return null;
        usedLineIds.add(line);
        return {
          text: sanitizePdfText(item?.text || line.text || ''),
          x: Number(line.x || 0),
          y: Number(line.y || 0),
          width: Number(line.width || 0),
          height: Math.max(20, Number(line.height || 28)),
          stageY: Number(line.y || 0),
          order: index + 1,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.stageY - b.stageY || a.x - b.x);

    if (!anchors.length) return null;

    const rowHeight = estimatePdfRowHeight(anchors, height);
    const candidateXs = (Array.isArray(page?.annotationCells) ? page.annotationCells : [])
      .map((cell) => Number(cell?.centerX || 0))
      .filter((value) => value > width * 0.35);
    const columnCenter = candidateXs.length ? getMedian(candidateXs) : width * 0.79;
    const columnWidth = clamp(width * 0.12, 78, width * 0.16);
    const tickLeft = clamp(columnCenter - columnWidth / 2, 0, width - columnWidth);
    const answers = Object.fromEntries(
      storyboardPage.items.map((item, index) => [
        `pdf-q-${index + 1}`,
        item?.correctAnswer ? 'tick' : null,
      ])
    );

    return {
      mode: 'single-check',
      anchors,
      rowHeight,
      columnWidth,
      columns: [{ key: 'tick', left: tickLeft, width: columnWidth }],
      answers,
    };
  }

  if (
    storyboardPage.interactionType === 'TrueFalse' &&
    Array.isArray(storyboardPage.items) &&
    storyboardPage.items.length
  ) {
    const anchors = storyboardPage.items
      .map((item, index) => {
        const line = findPdfAnchorLineForText(lines, item?.statement || '', usedLineIds);
        if (!line) return null;
        usedLineIds.add(line);
        return {
          text: sanitizePdfText(item?.statement || line.text || ''),
          x: Number(line.x || 0),
          y: Number(line.y || 0),
          width: Number(line.width || 0),
          height: Math.max(20, Number(line.height || 28)),
          stageY: Number(line.y || 0),
          order: index + 1,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.stageY - b.stageY || a.x - b.x);

    if (!anchors.length) return null;

    const headerTokens = lines
      .flatMap((line) =>
        Array.isArray(line?.tokens) ? line.tokens.map((token) => ({ ...token, rowY: line.y })) : []
      )
      .map((token) => ({ ...token, normalized: normalizePdfText(token?.text || '') }));
    const dToken = headerTokens.find((token) => token.normalized === 'd');
    const yToken = headerTokens.find(
      (token) => token.normalized === 'y' && Number(token?.x || 0) > Number(dToken?.x || 0)
    );
    const rowHeight = estimatePdfRowHeight(anchors, height);
    const columnWidth = clamp(
      (Math.abs(Number(yToken?.x || width * 0.84) - Number(dToken?.x || width * 0.74)) ||
        width * 0.1) * 0.82,
      54,
      width * 0.14
    );
    const dLeft = clamp(
      (Number(dToken?.x || width * 0.74) || 0) - columnWidth * 0.45,
      0,
      width - columnWidth
    );
    const yLeft = clamp(
      (Number(yToken?.x || width * 0.84) || 0) - columnWidth * 0.45,
      0,
      width - columnWidth
    );
    const answers = Object.fromEntries(
      storyboardPage.items.map((item, index) => [
        `pdf-q-${index + 1}`,
        normalizePdfText(item?.correctAnswer || '') === 'd' ? 'd' : 'y',
      ])
    );

    return {
      mode: 'binary',
      anchors,
      rowHeight,
      columnWidth,
      columns: [
        { key: 'd', left: dLeft, width: columnWidth },
        { key: 'y', left: yLeft, width: columnWidth },
      ],
      answers,
    };
  }

  return null;
}

function detectPdfSelectionLayout(page = {}) {
  const width = page.width || 1365;
  const height = page.height || 768;
  const lines = Array.isArray(page.lines) ? page.lines : [];
  const layoutAnchors = getPdfQuestionAnchors(page);
  const numberedAnchors = extractPdfQuestionAnchors(lines, height);
  const anchors = layoutAnchors.length
    ? layoutAnchors
    : numberedAnchors.length
      ? numberedAnchors
      : inferPdfSelectionAnchors(lines, width, height);
  if (!anchors.length) return null;

  const normalizedLines = lines.map((line) => ({
    ...line,
    normalized: normalizePdfText(line.text),
  }));
  const dLine = normalizedLines.find((line) => line.normalized === 'd');
  const yLine = normalizedLines.find(
    (line) => line.normalized === 'y' && (!dLine || line.x > dLine.x + 12)
  );
  const rowHeight = estimatePdfRowHeight(anchors, height);
  const answers = {};
  const textMarkLines = normalizedLines
    .map((line) => {
      const stageY = Math.max(0, Number(line.y || 0));
      const markText = sanitizePdfText(line.text || '');
      const centerX = Number(line.x || 0) + Math.max(8, Number(line.width || 0)) / 2;
      const centerY = stageY + Math.max(12, Number(line.height || 0)) / 2;
      return { ...line, stageY, markText, centerX, centerY };
    })
    .filter((line) => !!line.markText && /[✓✔☑√]/.test(line.markText));

  // Augment with annotation/pixel-detected cells (non-text tick detection)
  const annotCells = Array.isArray(page.annotationCells) ? page.annotationCells : [];
  const annotMarkLines = annotCells.map((ann) => ({
    stageY: ann.centerY - (ann.stageH || 0) / 2,
    markText: '✓',
    centerX: ann.centerX,
    centerY: ann.centerY,
    checked: ann.checked !== false,
  }));
  const markLines = [...textMarkLines, ...annotMarkLines.filter((a) => a.checked)];

  if (dLine && yLine) {
    const rawGap = Math.abs(Number(yLine.x || 0) - Number(dLine.x || 0));
    const columnWidth = clamp(rawGap * 0.82, 54, width * 0.14);
    const dLeft = clamp(Number(dLine.x || 0) - columnWidth * 0.45, 0, width - columnWidth);
    const yLeft = clamp(Number(yLine.x || 0) - columnWidth * 0.45, 0, width - columnWidth);
    const dCenter = dLeft + columnWidth / 2;
    const yCenter = yLeft + columnWidth / 2;

    anchors.forEach((anchor, index) => {
      const questionId = `pdf-q-${index + 1}`;
      const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
      const rowBottom = rowTop + rowHeight;
      const markLine = markLines.find(
        (line) => line.centerY >= rowTop && line.centerY <= rowBottom
      );
      if (!markLine) return;
      answers[questionId] =
        Math.abs(markLine.centerX - dCenter) <= Math.abs(markLine.centerX - yCenter) ? 'd' : 'y';
    });

    return {
      mode: 'binary',
      anchors,
      rowHeight,
      columnWidth,
      columns: [
        { key: 'd', left: dLeft, width: columnWidth },
        { key: 'y', left: yLeft, width: columnWidth },
      ],
      answers,
    };
  }

  const clusteredCenters = clusterPdfColumnCenters(
    markLines.filter((line) => line.centerX > width * 0.35).map((line) => line.centerX),
    Math.max(72, width * 0.05)
  );
  if (clusteredCenters.length >= 2) {
    const columnDefs = inferPdfTableChoiceColumns(lines, clusteredCenters, width, height);
    const gapValues = clusteredCenters
      .slice(1)
      .map((center, index) => center - clusteredCenters[index])
      .filter((gap) => gap > 24);
    const medianGap = gapValues.length ? getMedian(gapValues) : width * 0.14;
    const columnWidth = clamp(medianGap * 0.72, 84, width * 0.18);
    const columns = columnDefs.map((column, index) => ({
      key: column.key,
      label: column.label || `${index + 1}`,
      fullLabel: column.fullLabel || column.label || `${index + 1}`,
      left: clamp(column.center - columnWidth / 2, 0, width - columnWidth),
      width: columnWidth,
      center: column.center,
    }));

    anchors.forEach((anchor, index) => {
      const questionId = `pdf-q-${index + 1}`;
      const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
      const rowBottom = rowTop + rowHeight;
      const rowMarks = markLines.filter(
        (line) => line.centerY >= rowTop && line.centerY <= rowBottom
      );
      if (!rowMarks.length) {
        answers[questionId] = null;
        return;
      }
      const match = columns.reduce((best, column) => {
        const distance = Math.min(
          ...rowMarks.map((line) => Math.abs(line.centerX - column.center))
        );
        if (!best || distance < best.distance) return { key: column.key, distance };
        return best;
      }, null);
      answers[questionId] = match?.key || null;
    });

    return {
      mode: 'table-choice',
      anchors,
      rowHeight,
      columnWidth,
      columns,
      answers,
    };
  }

  const promptText = normalizePdfText(
    lines
      .slice(0, 12)
      .map((line) => line.text)
      .join(' ')
  );
  const isSingleTickMode =
    promptText.includes('kutucugu') || promptText.includes('isaretleyiniz') || markLines.length > 0;
  if (!isSingleTickMode) return null;

  const candidateXs = markLines
    .filter((line) => line.centerX > width * 0.55)
    .map((line) => line.centerX);
  const columnCenter = candidateXs.length ? getMedian(candidateXs) : width * 0.78;
  const columnWidth = clamp(width * 0.12, 78, width * 0.16);
  const tickLeft = clamp(columnCenter - columnWidth / 2, 0, width - columnWidth);

  anchors.forEach((anchor, index) => {
    const questionId = `pdf-q-${index + 1}`;
    const rowTop = Math.max(0, anchor.stageY - rowHeight * 0.18);
    const rowBottom = rowTop + rowHeight;
    const markLine = markLines.find((line) => line.centerY >= rowTop && line.centerY <= rowBottom);
    answers[questionId] = markLine ? 'tick' : null;
  });

  return {
    mode: 'single-check',
    anchors,
    rowHeight,
    columnWidth,
    columns: [{ key: 'tick', left: tickLeft, width: columnWidth }],
    answers,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export {
  uid,
  fileToDataUrl,
  formatBookLockMessage,
  buildCanvasPreviewDataUrl,
  normalizePdfHintRect,
  mergePdfTermLists,
  mapStoryboardInteractionTypeToDraftKind,
  pickPrimaryStoryboardInteraction,
  extractStoryboardTermLists,
  buildPdfSelectionBlueprint,
  countStoryboardExtractedItems,
  createPdfStatusEntry,
  appendPdfImportLog,
  getPdfLogPalette,
  PdfImportLogPanel,
  PdfImportStatusModal,
  splitPdfLineSegments,
  buildPdfTextLines,
  detectPdfMarker,
  buildFallbackPdfGroups,
  inferPdfDraftTitle,
  detectPdfDraftStatus,
  inferPdfSelectionAnchors,
  shouldUsePdfBottomOrigin,
  getPdfStageRectForLines,
  getPdfQuestionAnchors,
  getPdfDragPoolRect,
  detectCanvasContentBounds,
  mapPdfLinesToStage,
  paintPdfCleanupRect,
  samplePdfCanvasBackgroundColor,
  detectPdfGreenCells,
  detectRedAnnotationBounds,
  estimatePdfRowHeight,
  getMedian,
  clusterPdfColumnCenters,
  compactPdfColumnLabel,
  stripPdfAnchorListPrefix,
  stripTrailingCheckMark,
  inferPdfTableChoiceColumns,
  findPdfAnchorLineForText,
  buildPdfSelectionLayoutFromStoryboard,
  detectPdfSelectionLayout,
  clamp,
};
