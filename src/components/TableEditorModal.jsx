import {
  normalizeTableData,
  tableAddColumn,
  tableAddRow,
  tableRemoveColumn,
  tableRemoveRow,
  tableSetCell,
  tableToggleHeader,
} from '../utils/tableHtml';

import { Modal } from './ui';

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

export default function TableEditorModal({ open, onClose, tableData, onChange, title = 'Tabloyu Düzenle' }) {
  if (!open) return null;

  const { headerRow, rows } = normalizeTableData(tableData);
  const apply = (next) => onChange?.(next);

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <button type="button" style={toolButtonStyle} onClick={() => apply(tableAddRow(tableData))}>
          + Satır
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => apply(tableRemoveRow(tableData))}>
          − Satır
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => apply(tableAddColumn(tableData))}>
          + Sütun
        </button>
        <button type="button" style={toolButtonStyle} onClick={() => apply(tableRemoveColumn(tableData))}>
          − Sütun
        </button>
        <button
          type="button"
          style={{ ...toolButtonStyle, borderColor: headerRow ? '#2563eb' : '#cbd5e1', color: headerRow ? '#1d4ed8' : '#334155', background: headerRow ? '#eff6ff' : '#fff' }}
          onClick={() => apply(tableToggleHeader(tableData))}
        >
          Başlık Satırı
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} style={{ border: '1px solid #e2e8f0', padding: 2 }}>
                    <input
                      value={cell}
                      onChange={(e) => apply(tableSetCell(tableData, rowIndex, colIndex, e.target.value))}
                      style={{
                        width: '100%',
                        minWidth: 90,
                        height: 32,
                        border: 'none',
                        outline: 'none',
                        padding: '0 8px',
                        fontSize: 13,
                        fontWeight: headerRow && rowIndex === 0 ? 800 : 500,
                        color: '#1f2937',
                        background: headerRow && rowIndex === 0 ? '#f8fafc' : '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
