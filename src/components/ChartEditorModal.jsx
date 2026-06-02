import {
  CHART_TYPES,
  buildChartSvg,
  chartAddPoint,
  chartRemovePoint,
  chartSetLabel,
  chartSetValue,
  normalizeChartData,
} from '../utils/chartSvg';

const toolButtonStyle = {
  height: 30,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

export default function ChartEditorModal({ open, onClose, chartType = 'bar', chartData, onChange, title = 'Grafiği Düzenle' }) {
  if (!open) return null;

  const points = normalizeChartData(chartData);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(15,23,42,.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, calc(100vw - 32px))',
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: 18,
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 20, padding: 24, overflow: 'auto' }}>
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
                      borderColor: active ? '#2563eb' : '#cbd5e1',
                      background: active ? '#eff6ff' : '#fff',
                      color: active ? '#1d4ed8' : '#334155',
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
                    style={{ flex: 1, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }}
                  />
                  <input
                    type="number"
                    value={point.value}
                    onChange={(e) => onChange?.({ chartData: chartSetValue(chartData, index, e.target.value) })}
                    style={{ width: 70, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 12, boxSizing: 'border-box' }}
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
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: buildChartSvg({ chartType, chartData }) }}
          />
        </div>
      </div>
    </div>
  );
}
