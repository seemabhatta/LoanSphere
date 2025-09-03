interface PlotlyChartProps {
  html: string;
}

export default function PlotlyChart({ html }: PlotlyChartProps) {
  return (
    <div className="mt-3 p-2 bg-white border rounded-md">
      <iframe
        srcDoc={html}
        className="w-full h-[400px] border-0"
        sandbox="allow-scripts"
        title="Interactive Chart"
      />
    </div>
  );
}