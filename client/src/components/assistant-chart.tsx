import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

type ChartSpec = {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
};

export default function AssistantChart({ spec }: { spec: ChartSpec }) {
  if (!spec || !spec.data || !spec.xKey || !spec.yKey) return null;

  return (
    <div className="mt-3 p-2 bg-white border rounded-md">
      {spec.title && (
        <div className="text-sm font-medium mb-2 text-neutral-800">{spec.title}</div>
      )}
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          {spec.type === 'line' ? (
            <LineChart data={spec.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={spec.yKey} stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={spec.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={spec.yKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

