import { useMemo } from 'react';

type GraphNode = { id: string; label?: string };
type GraphEdge = { source: string; target: string; label?: string };

type GraphSpec = {
  type: 'graph';
  title?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: 'circular' | 'hierarchical';
};

export default function AssistantGraph({ spec }: { spec: GraphSpec }) {
  const { nodes, edges } = spec || ({} as GraphSpec);
  const size = 280;
  const padding = 32;
  const radius = (size - padding * 2) / 2;
  const center = { x: size / 2, y: size / 2 };

  const positions = useMemo(() => {
    if (!nodes || nodes.length === 0) return {} as Record<string, { x: number; y: number }>;
    const pos: Record<string, { x: number; y: number }> = {};
    const N = nodes.length;
    nodes.forEach((n, i) => {
      // circular layout for simplicity
      const angle = (i / N) * Math.PI * 2;
      pos[n.id] = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
    return pos;
  }, [nodes]);

  if (!nodes || !edges) return null;

  return (
    <div className="mt-3 p-2 bg-white border rounded-md">
      {spec.title && (
        <div className="text-sm font-medium mb-2 text-neutral-800">{spec.title}</div>
      )}
      <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Edges */}
        {edges.map((e, idx) => {
          const s = positions[e.source];
          const t = positions[e.target];
          if (!s || !t) return null;
          return (
            <g key={`e-${idx}`}>
              <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#CBD5E1" strokeWidth={1.5} />
              {e.label && (
                <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2} fill="#64748B" fontSize={10} textAnchor="middle">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {/* Nodes */}
        {nodes.map((n, idx) => {
          const p = positions[n.id];
          if (!p) return null;
          return (
            <g key={`n-${n.id}-${idx}`}>
              <circle cx={p.x} cy={p.y} r={10} fill="#2563EB" />
              <text x={p.x} y={p.y - 14} fill="#0F172A" fontSize={10} textAnchor="middle">
                {n.label || n.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

