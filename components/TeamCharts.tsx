"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

interface GameResult {
  date: string;
  gf: number;
  ga: number;
  opponent: string;
  result: "W" | "L" | "OTL";
}

interface Props {
  gameResults: GameResult[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #1e2d45",
  borderRadius: "8px",
  color: "#e8eef8",
  fontSize: "12px",
};

export default function TeamCharts({ gameResults }: Props) {
  // Running point total
  let pts = 0;
  const pointTrend = gameResults.map((g) => {
    pts += g.result === "W" ? 2 : g.result === "OTL" ? 1 : 0;
    return { date: g.date, points: pts, result: g.result };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Goals for vs against */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">
          Goals For vs Against — Last 20 Games
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gameResults} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1a2235" }} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "#6b7fa3" }} />
            <Bar dataKey="gf" name="Goals For" fill="#f5c842" radius={[3, 3, 0, 0]} />
            <Bar dataKey="ga" name="Goals Against" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Running points trend */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">
          Points Accumulation — Last 20 Games
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={pointTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <ReferenceLine y={0} stroke="#1e2d45" />
            <Line
              type="monotone"
              dataKey="points"
              stroke="#f5c842"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={payload.result === "W" ? "#22c55e" : payload.result === "OTL" ? "#f5c842" : "#ef4444"}
                    stroke="none"
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
