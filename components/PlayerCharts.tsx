"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { SeasonTotal } from "@/lib/nhl";

interface Props {
  seasons: SeasonTotal[];
  formatSeason: (s: number) => string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #1e2d45",
  borderRadius: "8px",
  color: "#e8eef8",
  fontSize: "12px",
};

export default function PlayerCharts({ seasons, formatSeason }: Props) {
  const data = seasons.map((s) => ({
    season: formatSeason(s.season),
    Goals: s.goals,
    Assists: s.assists,
    Points: s.points,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Goals and assists by season */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Goals & Assists by Season</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="season" tick={{ fontSize: 9, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1a2235" }} />
            <Legend wrapperStyle={{ fontSize: "11px", color: "#6b7fa3" }} />
            <Bar dataKey="Goals" fill="#f5c842" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Assists" fill="#94a3b8" radius={[3, 3, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Points by season */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-4">Points by Season</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis dataKey="season" tick={{ fontSize: 9, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7fa3" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#1a2235" }} />
            <Bar dataKey="Points" fill="#f5c842" radius={[3, 3, 0, 0]}
              label={{ position: "top", fontSize: 9, fill: "#6b7fa3" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
