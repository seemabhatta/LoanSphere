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
  const nodesRef = useRef<any>(null);
  const edgesRef = useRef<any>(null);
  // Track expansions: nodeId -> { nodes: string[], edges: string[] }
  const expansionsRef = useRef<Record<string, { nodes: string[]; edges: string[] }>>({});
  const expandedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Use ESM standalone build path for vis-network
        const vis: any = await import('vis-network/standalone/esm/vis-network');
        if (cancelled || !containerRef.current) return;

        const nodes = new vis.DataSet(
          (spec.nodes || []).map((n) => ({ id: n.id, label: n.label || n.id }))
        );
        const edges = new vis.DataSet(
          (spec.edges || []).map((e) => ({ id: `${e.source}->${e.target}:${e.label || ''}` , from: e.source, to: e.target, label: e.label }))
        );

        nodesRef.current = nodes;
        edgesRef.current = edges;
        const data = { nodes, edges };
        nodesRef.current = nodes;
        edgesRef.current = edges;
        const options: any = {
          interaction: { hover: true },
          physics: spec.layout !== 'hierarchical',
          edges: { arrows: { to: { enabled: false } }, color: '#94a3b8', smooth: true },
          nodes: { shape: 'dot', size: 12, color: '#2563eb', font: { color: '#0f172a' } },
          layout: spec.layout === 'hierarchical' ? { hierarchical: { enabled: true, direction: 'LR', levelSeparation: 120 } } : undefined,
        };

        networkRef.current = new vis.Network(containerRef.current, data, options);
        // Single-click: expand/collapse neighbors (graph-centric UX)
        networkRef.current.on('selectNode', async (params: any) => {
          if (!params?.nodes?.length) return;
          const nodeId = params.nodes[0] as string;
          // Collapse if already expanded
          if (expandedRef.current.has(nodeId)) {
            const exp = expansionsRef.current[nodeId];
            if (exp) {
              try { edges.remove(exp.edges); } catch {}
              try { nodes.remove(exp.nodes); } catch {}
            }
            delete expansionsRef.current[nodeId];
            expandedRef.current.delete(nodeId);
            return;
          }
          // Expand: fetch neighbors
          try {
            const res = await fetch('/api/graph/neighbors', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ node_id: nodeId })
            });
            if (!res.ok) return;
            const payload = await res.json();
            const addedNodes: string[] = [];
            const addedEdges: string[] = [];
            (payload.nodes || []).forEach((n: any) => {
              if (!nodes.get(n.id)) {
                nodes.add({ id: n.id, label: n.label || n.id, title: n.title || undefined });
                addedNodes.push(n.id);
              }
            });
            (payload.edges || []).forEach((e: any) => {
              const eid = e.id || `${e.source}->${e.target}:${e.label || ''}`;
              if (!edges.get(eid)) {
                edges.add({ id: eid, from: e.source, to: e.target, label: e.label });
                addedEdges.push(eid);
              }
            });
            expansionsRef.current[nodeId] = { nodes: addedNodes, edges: addedEdges };
            expandedRef.current.add(nodeId);
          } catch {
            // ignore
          }
        });

        // Double-click disabled: single click already toggles expansion/collapse
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
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
          onClick={() => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;
            if (!nodes || !edges) return;
            try {
              nodes.clear();
              edges.clear();
              const baseNodes = (spec.nodes || []).map((n) => ({ id: n.id, label: n.label || n.id }));
              const baseEdges = (spec.edges || []).map((e) => ({ id: `${e.source}->${e.target}:${e.label || ''}`, from: e.source, to: e.target, label: e.label }));
              nodes.add(baseNodes);
              edges.add(baseEdges);
              expansionsRef.current = {};
              expandedRef.current = new Set();
              networkRef.current?.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
            } catch {}
          }}
        >
          Collapse all
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
          onClick={() => {
            try { networkRef.current?.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } }); } catch {}
          }}
        >
          Fit to view
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-700"
          onClick={async () => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;
            if (!nodes || !edges) return;
            const ids: string[] = nodes.getIds ? nodes.getIds() : [];
            for (const nodeId of ids) {
              if (expandedRef.current.has(nodeId)) continue;
              try {
                const res = await fetch('/api/graph/neighbors', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ node_id: nodeId })
                });
                if (!res.ok) continue;
                const payload = await res.json();
                const addedNodes: string[] = [];
                const addedEdges: string[] = [];
                (payload.nodes || []).forEach((n: any) => {
                  if (!nodes.get(n.id)) {
                    nodes.add({ id: n.id, label: n.label || n.id });
                    addedNodes.push(n.id);
                  }
                });
                (payload.edges || []).forEach((e: any) => {
                  const eid = e.id || `${e.source}->${e.target}:${e.label || ''}`;
                  if (!edges.get(eid)) {
                    edges.add({ id: eid, from: e.source, to: e.target, label: e.label });
                    addedEdges.push(eid);
                  }
                });
                if (addedNodes.length || addedEdges.length) {
                  expansionsRef.current[nodeId] = { nodes: addedNodes, edges: addedEdges };
                  expandedRef.current.add(nodeId);
                }
              } catch {}
            }
            try { networkRef.current?.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } }); } catch {}
          }}
        >
          Expand all
        </button>
      </div>
      {spec.title && (
        <div className="text-sm font-medium mb-2 text-neutral-800">{spec.title}</div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 280 }} />
      {/* No JSON detail dump; graph is navigated by expanding/collapsing nodes */}
    </div>
  );
}
