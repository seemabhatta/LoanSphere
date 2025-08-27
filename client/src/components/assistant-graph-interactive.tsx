import { useEffect, useRef } from 'react';

type GraphNode = { id: string; label?: string };
type GraphEdge = { source: string; target: string; label?: string };

export type GraphSpec = {
  type: 'graph';
  title?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: 'circular' | 'hierarchical';
};

export default function AssistantGraphInteractive({ spec, onNodeClick }: { spec: GraphSpec, onNodeClick?: (id: string, label?: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vis: any = await import('vis-network/standalone');
        if (cancelled || !containerRef.current) return;

        const nodes = new vis.DataSet(
          (spec.nodes || []).map((n) => ({ id: n.id, label: n.label || n.id }))
        );
        const edges = new vis.DataSet(
          (spec.edges || []).map((e) => ({ from: e.source, to: e.target, label: e.label }))
        );

        const data = { nodes, edges };
        const options: any = {
          interaction: { hover: true },
          physics: spec.layout !== 'hierarchical',
          edges: { arrows: { to: { enabled: false } }, color: '#94a3b8', smooth: true },
          nodes: { shape: 'dot', size: 12, color: '#2563eb', font: { color: '#0f172a' } },
          layout: spec.layout === 'hierarchical' ? { hierarchical: { enabled: true, direction: 'LR', levelSeparation: 120 } } : undefined,
        };

        networkRef.current = new vis.Network(containerRef.current, data, options);
        if (onNodeClick) {
          networkRef.current.on('selectNode', (params: any) => {
            if (!params?.nodes?.length) return;
            const id = params.nodes[0];
            try {
              const n = nodes.get(id);
              onNodeClick(id, n?.label);
            } catch {
              onNodeClick(id);
            }
          });
        }
      } catch (e) {
        // Fallback: do nothing if library load fails
      }
    })();
    return () => {
      cancelled = true;
      if (networkRef.current) {
        try { networkRef.current.destroy(); } catch {}
        networkRef.current = null;
      }
    };
  }, [spec]);

  if (!spec || !spec.nodes || !spec.edges) return null;

  return (
    <div className="mt-3 p-2 bg-white border rounded-md">
      {spec.title && (
        <div className="text-sm font-medium mb-2 text-neutral-800">{spec.title}</div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 280 }} />
    </div>
  );
}
