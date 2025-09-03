interface PlotlyChartProps {
  html: string;
}

export default function PlotlyChart({ html }: PlotlyChartProps) {
  console.log('PlotlyChart rendering with HTML length:', html?.length);
  
  return (
    <div className="mt-3 p-2 bg-white border rounded-md">
      <div className="text-xs text-gray-500 mb-2">Interactive Chart</div>
      <iframe
        srcDoc={html}
        className="w-full h-[400px] border border-gray-200"
        sandbox="allow-scripts allow-same-origin"
        title="Interactive Chart"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}