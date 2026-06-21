import { useMemo } from 'react';

import { Modal } from './ui';

export default function BranchingDiagramModal({
  open,
  onClose,
  activities = [],
  variables = [],
  currentActivityId = null,
}) {
  const graph = useMemo(() => {
    if (!activities.length) return { nodes: [], edges: [] };
    const nodes = activities.map((act, i) => ({
      id: act.id,
      name: act.name || `Etkinlik ${i + 1}`,
      type: act.type || 'info',
      index: i,
    }));
    const edges = [];
    const addEdge = (fromId, toId, label, color) => {
      if (toId && activities.some((a) => a.id === toId))
        edges.push({ from: fromId, to: toId, label, color });
    };
    activities.forEach((act) => {
      if (act.nextActivityId) addEdge(act.id, act.nextActivityId, 'sonraki', '#64748b');
      (act.triggers || []).forEach((trigger) => {
        // Hedef etkinlik id'si trigger.value alaninda tutulur (targetActivityId yok).
        // '__next__'/'__prev__' gibi goreli degerler gercek bir dugume isaret etmez, atla.
        const target = trigger.value;
        const isRelative = typeof target === 'string' && target.startsWith('__');
        if (trigger.action === 'SayfaGec' && target && !isRelative)
          addEdge(act.id, target, trigger.label || 'SayfaGec', '#2563eb');
        if (trigger.action === 'SliderGec' && target && !isRelative)
          addEdge(act.id, target, trigger.label || 'SlideraGec', '#7c3aed');
      });
    });
    return { nodes, edges };
  }, [activities]);

  if (!open) return null;

  const COL_W = 220;
  const ROW_H = 80;
  const PAD = 30;
  const cols = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)));

  const nodePositions = {};
  graph.nodes.forEach((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    nodePositions[node.id] = { x: PAD + col * COL_W, y: PAD + row * ROW_H, node };
  });

  const svgW = PAD * 2 + cols * COL_W;
  const svgH = PAD * 2 + Math.ceil(graph.nodes.length / cols) * ROW_H;
  const NODE_W = 180;
  const NODE_H = 44;

  const typeColors = {
    selection: '#3b82f6',
    'drag-drop': '#8b5cf6',
    sequence: '#f59e0b',
    matching: '#10b981',
    'text-entry': '#06b6d4',
    info: '#64748b',
  };

  return (
    <Modal
      title="Dallanma Diyagramı"
      subtitle={`${activities.length} etkinlik • ${graph.edges.length} bağlantı`}
      onClose={onClose}
      size="xl"
      footer={
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            fontSize: 11,
            color: '#94a3b8',
            width: '100%',
          }}
        >
          <span>—— kesikli: varsayılan sıra</span>
          <span style={{ color: '#2563eb' }}>—— mavi: SayfaGec trigger</span>
          <span style={{ color: '#7c3aed' }}>—— mor: SlideraGec trigger</span>
        </div>
      }
    >
        <div style={{ overflowX: 'auto' }}>
          {graph.nodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
              Henüz etkinlik yok.
            </div>
          ) : (
            <svg width={svgW} height={svgH} style={{ display: 'block' }}>
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="arrow-blue"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
                </marker>
              </defs>
              {graph.edges.map((edge, i) => {
                const from = nodePositions[edge.from];
                const to = nodePositions[edge.to];
                if (!from || !to) return null;
                const x1 = from.x + NODE_W / 2;
                const y1 = from.y + NODE_H;
                const x2 = to.x + NODE_W / 2;
                const y2 = to.y;
                const midY = (y1 + y2) / 2;
                const isDefault = edge.color === '#64748b';
                return (
                  <g key={i}>
                    <path
                      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                      fill="none"
                      stroke={edge.color || '#94a3b8'}
                      strokeWidth={isDefault ? 1.5 : 2}
                      markerEnd={isDefault ? 'url(#arrow)' : 'url(#arrow-blue)'}
                      strokeDasharray={isDefault ? '6 3' : 'none'}
                    />
                    {edge.label && (
                      <text
                        x={(x1 + x2) / 2}
                        y={midY - 4}
                        textAnchor="middle"
                        fill={edge.color || '#94a3b8'}
                        fontSize={9}
                        fontWeight={700}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {graph.nodes.map((node) => {
                const pos = nodePositions[node.id];
                const isCurrent = node.id === currentActivityId;
                const bgColor = isCurrent ? '#dbeafe' : '#f8fafc';
                const borderColor = isCurrent ? '#3b82f6' : '#dbe7f5';
                const typeColor = typeColors[node.type] || '#64748b';
                return (
                  <g key={node.id}>
                    <rect
                      x={pos.x}
                      y={pos.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={10}
                      ry={10}
                      fill={bgColor}
                      stroke={borderColor}
                      strokeWidth={isCurrent ? 2.5 : 1.5}
                    />
                    <circle cx={pos.x + 14} cy={pos.y + NODE_H / 2} r={5} fill={typeColor} />
                    <text
                      x={pos.x + 26}
                      y={pos.y + 18}
                      fontSize={11}
                      fontWeight={800}
                      fill="#0f172a"
                    >
                      {(node.name || '').slice(0, 22)}
                      {(node.name || '').length > 22 ? '…' : ''}
                    </text>
                    <text x={pos.x + 26} y={pos.y + 32} fontSize={9} fill="#64748b">
                      {node.type} • #{node.index + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
    </Modal>
  );
}
