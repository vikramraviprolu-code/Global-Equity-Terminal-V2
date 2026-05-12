import { useMemo, useState } from "react";

type Props = {
  volumes: number[];
  closes?: number[];
  height?: number;
};

/**
 * Volume bar chart showing trading volume over time.
 * Supports optional price overlay to correlate volume with price movements.
 */
export function VolumeChart({ volumes, closes, height = 200 }: Props) {
  const [showPrice, setShowPrice] = useState(false);
  const [barColor, setBarColor] = useState<"auto" | "bull" | "bear">("auto");

  const W = 800, H = height, P = 28;
  const data = useMemo(() => volumes.filter((n) => typeof n === "number" && n > 0), [volumes]);
  const priceData = useMemo(() => closes?.filter((n) => typeof n === "number" && n > 0) ?? [], [closes]);

  if (!data.length) {
    return (
      <div className="panel p-10 text-center">
        <div className="font-mono text-xs text-muted-foreground">No volume data available.</div>
      </div>
    );
  }

  const maxVol = Math.max(...data);
  const maxPrice = priceData.length ? Math.max(...priceData) : 0;
  const minPrice = priceData.length ? Math.min(...priceData) : 0;
  
  const barWidth = (W - 2 * P) / data.length;
  const gap = Math.max(1, barWidth * 0.1); // 10% gap between bars
  const actualBarWidth = barWidth - gap;

  const x = (i: number) => P + i * barWidth + gap / 2;
  const y = (v: number) => H - P - ((v / maxVol) * (H - 2 * P));
  const yPrice = (v: number) => H - P - ((v - minPrice) / (maxPrice - minPrice || 1)) * (H - 2 * P);

  const volTicks = 5;
  const volTickValues = Array.from({ length: volTicks + 1 }, (_, i) => (maxVol * i) / volTicks);

  const getBarColor = (i: number) => {
    if (barColor !== "auto") {
      return barColor === "bull" ? "var(--bull)" : "var(--bear)";
    }
    // Auto color based on price movement
    if (priceData.length > i) {
      const prevPrice = i > 0 ? priceData[i - 1] : priceData[i];
      const currentPrice = priceData[i];
      return currentPrice >= prevPrice ? "var(--bull)" : "var(--bear)";
    }
    return "var(--primary)";
  };

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-3 flex-wrap">
        <span>Volume Chart · {data.length} sessions</span>
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono">
          {priceData.length > 0 && (
            <Toggle on={showPrice} setOn={setShowPrice} color="var(--primary)" label="Price Overlay" />
          )}
          <select
            value={barColor}
            onChange={(e) => setBarColor(e.target.value as "auto" | "bull" | "bear")}
            className="bg-background border border-border px-2 py-1 rounded text-xs"
          >
            <option value="auto">Auto Color</option>
            <option value="bull">Bull Only</option>
            <option value="bear">Bear Only</option>
          </select>
        </div>
      </div>
      <div className="p-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block">
          {/* Volume y-axis grid + labels */}
          {volTickValues.map((t, i) => (
            <g key={i}>
              <line x1={P} x2={W - P} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 4" strokeWidth={0.5} />
              <text x={4} y={y(t) + 3} fontSize="9" fontFamily="var(--font-mono)" fill="var(--muted-foreground)">
                {t >= 1_000_000 ? `${(t / 1_000_000).toFixed(1)}M` : t >= 1_000 ? `${(t / 1_000).toFixed(1)}K` : t.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Volume bars */}
          {data.map((v, i) => (
            <rect
              key={i}
              x={x(i)}
              y={y(v)}
              width={actualBarWidth}
              height={(v / maxVol) * (H - 2 * P)}
              fill={getBarColor(i)}
              opacity={0.8}
              rx={1}
            />
          ))}

          {/* Price overlay line */}
          {showPrice && priceData.length > 0 && (
            <polyline
              points={priceData.map((p, i) => `${x(i).toFixed(1)},${yPrice(p).toFixed(1)}`).join(" ")}
              fill="none"
              stroke="var(--cyan)"
              strokeWidth={2}
              opacity={0.8}
            />
          )}
        </svg>

        {/* Volume stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-mono">
          <div>
            <span className="text-muted-foreground">Avg Volume: </span>
            <span className="ml-1">{(data.reduce((a, b) => a + b, 0) / data.length / 1_000_000).toFixed(2)}M</span>
          </div>
          <div>
            <span className="text-muted-foreground">Peak Volume: </span>
            <span className="ml-1">{(maxVol / 1_000_000).toFixed(2)}M</span>
          </div>
          <div>
            <span className="text-muted-foreground">Recent Trend: </span>
            <span className="ml-1">
              {data.slice(-5).reduce((a, b) => a + b, 0) / Math.max(...data.slice(-5)) > 1 ? "↑ Increasing" : "↓ Decreasing"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Sessions: </span>
            <span className="ml-1">{data.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, setOn, color, label }: { on: boolean; setOn: (b: boolean) => void; color: string; label: string }) {
  return (
    <button
      onClick={() => setOn(!on)}
      className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
        on ? "border-border text-foreground" : "border-border/50 text-muted-foreground/60 line-through"
      }`}
    >
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </button>
  );
}