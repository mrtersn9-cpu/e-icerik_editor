import {
  CHART_TYPES,
  buildChartSvg,
  chartAddPoint,
  chartRemovePoint,
  chartSetLabel,
  chartSetValue,
  normalizeChartData,
} from '../utils/chartSvg';

import { Modal } from './ui';

const toolButtonStyle = {
  height: 30,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--eic-light-border)',
  background: 'var(--eic-light-panel)',
  color: '#334155',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

export default function ChartEditorModal({ open, onClose, chartType = 'bar', chartData, onChange, title = 'Grafiği Düzenle' }) {
  if (!open) return null;

  const points = normalizeChartData(chartData);

  return (
    <Modal title={title} onClose={onClose} size="lg">
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {CHART_TYPES.map((type) => {
                const active = chartType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => onChange?.({ chartType: type.value })}
                    style={{
                      ...toolButtonStyle,
                      flex: 1,
                      borderColor: active ? 'var(--eic-light-accent)' : 'var(--eic-light-border)',
                      background: active ? 'var(--eic-light-accent-soft)' : 'var(--eic-light-panel)',
                      color: active ? 'var(--eic-light-accent-strong)' : '#334155',
                    }}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {points.map((point, index) => (
                <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: point.color, flexShrink: 0 }} />
                  <input
                    value={point.label}
                    onChange={(e) => onChange?.({ chartData: chartSetLabel(chartData, index, e.target.value) })}
                    style={{ flex: 1, height: 30, border: '1px solid var(--eic-light-border-soft)', borderRadius: 6, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }}
                  />
                  <input
                    type="number"
                    value={point.value}
                    onChange={(e) => onChange?.({ chartData: chartSetValue(chartData, index, e.target.value) })}
                    style={{ width: 70, height: 30, border: '1px solid var(--eic-light-border-soft)', borderRadius: 6, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={toolButtonStyle} onClick={() => onChange?.({ chartData: chartAddPoint(chartData) })}>
                + Veri
              </button>
              <button type="button" style={toolButtonStyle} onClick={() => onChange?.({ chartData: chartRemovePoint(chartData) })}>
                − Veri
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              border: '1px solid var(--eic-light-border-soft)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: buildChartSvg({ chartType, chartData }) }}
          />
        </div>
    </Modal>
  );
}
