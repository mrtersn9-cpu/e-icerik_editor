import { useState, useEffect, useMemo } from 'react';

import { VARIABLE_TYPES } from '../constants';
import { uid } from '../utils/editorHelpers';

export default function VariablesManagerModal({
  open,
  onClose,
  variables = [],
  onChange = () => {},
  activities = [],
  activity = null,
  projectName = '',
  bookName = '',
  // utility function deps injected as props
  normalizeVariable,
  createVariableItem,
  castVariableValue,
  getVariableTypeLabel,
  formatVariableValue,
  getDefaultVariableValue,
  buildVariableUsageCountMap,
  buildBuiltInVariableRows,
}) {
  const [scopeTab, setScopeTab] = useState('project');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!open) return;
    const firstProjectVariableId = variables[0]?.id || '';
    setSelectedId((current) => current || firstProjectVariableId);
  }, [open, variables]);

  const usageCounts = useMemo(
    () => buildVariableUsageCountMap(activities),
    [activities, buildVariableUsageCountMap]
  );
  const builtInRows = useMemo(
    () => buildBuiltInVariableRows({ activity, projectName, bookName }),
    [activity, bookName, buildBuiltInVariableRows, projectName]
  );
  const projectRows = useMemo(
    () => variables.map((variable) => ({ ...variable, useCount: usageCounts[variable.id] || 0 })),
    [usageCounts, variables]
  );
  const rows = scopeTab === 'project' ? projectRows : builtInRows;
  const filteredRows = rows.filter((row) => {
    const haystack =
      `${row.name || ''} ${getVariableTypeLabel(row.type)} ${formatVariableValue(row.value, row.type)}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  const selectedProjectVariable = projectRows.find((row) => row.id === selectedId) || null;
  const canEditProjectRows = scopeTab === 'project';

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: 'rgba(15,23,42,.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
    >
      <div
        style={{
          width: 'min(920px, 94vw)',
          minHeight: 520,
          maxHeight: '88vh',
          background: '#ffffff',
          border: '1px solid #cfd8e3',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(15,23,42,.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            background: 'linear-gradient(180deg,#f3f6f9,#e7edf3)',
            borderBottom: '1px solid #d7dee7',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: '#425466' }}>Variables</div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'transparent',
              color: '#7b8794',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px 0',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {[
              { id: 'project', label: 'Project' },
              { id: 'builtin', label: 'Built-In' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScopeTab(tab.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0 0 8px',
                  borderBottom: `2px solid ${scopeTab === tab.id ? '#228be6' : 'transparent'}`,
                  color: scopeTab === tab.id ? '#228be6' : '#425466',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search variables"
              style={{
                width: 240,
                maxWidth: '56vw',
                height: 32,
                borderRadius: 0,
                border: '1px solid #c9d4df',
                background: '#ffffff',
                color: '#334155',
                padding: '0 10px',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                const nextVariable = normalizeVariable(
                  createVariableItem(variables.length),
                  variables.length
                );
                onChange([...variables, nextVariable]);
                setScopeTab('project');
                setSelectedId(nextVariable.id);
              }}
              disabled={!canEditProjectRows}
              title="Yeni değişken"
              style={{
                width: 30,
                height: 30,
                borderRadius: 0,
                border: '1px solid #b8c7d9',
                background: canEditProjectRows ? '#ffffff' : '#f8fafc',
                color: canEditProjectRows ? '#3b9c34' : '#94a3b8',
                cursor: canEditProjectRows ? 'pointer' : 'default',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                if (!selectedProjectVariable) return;
                const copy = normalizeVariable(
                  {
                    ...selectedProjectVariable,
                    id: uid(),
                    name: `${selectedProjectVariable.name || 'Degisken'} Kopya`,
                  },
                  variables.length
                );
                onChange([...variables, copy]);
                setScopeTab('project');
                setSelectedId(copy.id);
              }}
              disabled={!selectedProjectVariable || !canEditProjectRows}
              title="Kopyala"
              style={{
                width: 30,
                height: 30,
                borderRadius: 0,
                border: '1px solid #b8c7d9',
                background: '#ffffff',
                color: selectedProjectVariable && canEditProjectRows ? '#64748b' : '#cbd5e1',
                cursor: selectedProjectVariable && canEditProjectRows ? 'pointer' : 'default',
                fontSize: 14,
              }}
            >
              ⧉
            </button>
            <button
              onClick={() => {
                if (!selectedProjectVariable) return;
                // Kullanılan değişkeni silmek tetikleyicileri/koşulları öksüz bırakır;
                // önce kullanıcıyı uyar.
                const useCount = selectedProjectVariable.useCount || 0;
                if (
                  useCount > 0 &&
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    `"${selectedProjectVariable.name || 'Değişken'}" ${useCount} tetikleyici/koşulda kullanılıyor. ` +
                      'Silinirse bu tetikleyiciler artık çalışmayabilir. Yine de silmek istiyor musunuz?'
                  )
                ) {
                  return;
                }
                onChange(
                  variables.filter((variable) => variable.id !== selectedProjectVariable.id)
                );
                setSelectedId('');
              }}
              disabled={!selectedProjectVariable || !canEditProjectRows}
              title="Sil"
              style={{
                width: 30,
                height: 30,
                borderRadius: 0,
                border: '1px solid #b8c7d9',
                background: '#ffffff',
                color: selectedProjectVariable && canEditProjectRows ? '#e11d48' : '#cbd5e1',
                cursor: selectedProjectVariable && canEditProjectRows ? 'pointer' : 'default',
                fontSize: 15,
              }}
            >
              🗑
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 0 0',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px,1.5fr) 140px minmax(180px,1fr) 100px',
              borderTop: '1px solid #dbe4ee',
              borderBottom: '1px solid #dbe4ee',
              background: '#f8fafc',
              color: '#52667a',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <div style={{ padding: '9px 14px' }}>Name</div>
            <div style={{ padding: '9px 14px' }}>Type</div>
            <div style={{ padding: '9px 14px' }}>Default Value</div>
            <div style={{ padding: '9px 14px' }}>Use Count</div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {filteredRows.map((row) => {
              const isSelected = row.id === selectedId;
              return (
                <div
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px,1.5fr) 140px minmax(180px,1fr) 100px',
                    borderBottom: '1px solid #edf2f7',
                    background: isSelected ? '#228be6' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ padding: '8px 14px' }}>
                    {canEditProjectRows ? (
                      <input
                        value={row.name || ''}
                        onChange={(event) =>
                          onChange(
                            variables.map((variable) =>
                              variable.id === row.id
                                ? { ...variable, name: event.target.value }
                                : variable
                            )
                          )
                        }
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                    ) : (
                      row.name
                    )}
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {canEditProjectRows ? (
                      <select
                        value={row.type || 'text'}
                        onChange={(event) =>
                          onChange(
                            variables.map((variable) =>
                              variable.id === row.id
                                ? {
                                    ...variable,
                                    type: event.target.value,
                                    value: castVariableValue(
                                      event.target.value,
                                      variable.value ?? getDefaultVariableValue(event.target.value)
                                    ),
                                  }
                                : variable
                            )
                          )
                        }
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      >
                        {VARIABLE_TYPES.map((typeOption) => (
                          <option key={typeOption.value} value={typeOption.value}>
                            {typeOption.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getVariableTypeLabel(row.type)
                    )}
                  </div>
                  <div style={{ padding: '8px 14px' }}>
                    {canEditProjectRows ? (
                      row.type === 'boolean' ? (
                        <select
                          value={String(!!row.value)}
                          onChange={(event) =>
                            onChange(
                              variables.map((variable) =>
                                variable.id === row.id
                                  ? { ...variable, value: event.target.value === 'true' }
                                  : variable
                              )
                            )
                          }
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        >
                          <option value="false">False</option>
                          <option value="true">True</option>
                        </select>
                      ) : (
                        <input
                          type={row.type === 'number' ? 'number' : 'text'}
                          value={row.value ?? ''}
                          onChange={(event) =>
                            onChange(
                              variables.map((variable) =>
                                variable.id === row.id
                                  ? {
                                      ...variable,
                                      value: castVariableValue(row.type, event.target.value),
                                    }
                                  : variable
                              )
                            )
                          }
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />
                      )
                    ) : (
                      formatVariableValue(row.value, row.type)
                    )}
                  </div>
                  <div style={{ padding: '8px 14px', color: isSelected ? '#dbeafe' : '#228be6' }}>
                    {row.useCount || 0}
                  </div>
                </div>
              );
            })}
            {filteredRows.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                Aramanla eşleşen değişken bulunamadı.
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderTop: '1px solid #dbe4ee',
            background: '#ffffff',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Global değişkenler trigger ve koşullarda doğrudan kullanılabilir.
          </div>
          <button
            onClick={onClose}
            style={{
              minWidth: 84,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: '#228be6',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
