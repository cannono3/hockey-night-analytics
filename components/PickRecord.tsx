"use client";

import { useState, useEffect, useCallback } from "react";
import { loadAllPicks, saveAllPicks, StoredPick } from "./PickRecorder";

function unitReturn(pick: StoredPick): number {
  if (pick.result === "win") {
    return pick.moneyline > 0
      ? pick.moneyline / 100       // e.g. +130 → win $1.30 per $1
      : 100 / Math.abs(pick.moneyline); // e.g. -150 → win $0.67 per $1
  }
  return -1;
}

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${(Math.abs(n) * 100).toFixed(0)}`;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  strong: "Strong",
  lean: "Lean",
  low: "Low",
};

export default function PickRecord() {
  const [picks, setPicks] = useState<StoredPick[]>([]);
  const [settling, setSettling] = useState(false);
  const [mounted, setMounted] = useState(false);

  const settlePending = useCallback(async (current: StoredPick[]) => {
    const pending = current.filter((p) => p.result === "pending");
    if (pending.length === 0) return current;

    setSettling(true);
    const datesToCheck = [...new Set(pending.map((p) => p.date))];
    const updated = [...current];
    let anyChanged = false;

    for (const date of datesToCheck) {
      try {
        const res = await fetch(`/api/scores/${date}`);
        const games: { id: number; gameState: string; homeTeam: { score: number; abbrev: string }; awayTeam: { score: number; abbrev: string } }[] = await res.json();

        for (const game of games) {
          if (game.gameState !== "OFF" && game.gameState !== "FINAL") continue;
          const pick = updated.find((p) => p.gameId === game.id && p.result === "pending");
          if (!pick) continue;

          const homeWon = game.homeTeam.score > game.awayTeam.score;
          pick.result = (pick.side === "home") === homeWon ? "win" : "loss";
          anyChanged = true;
        }
      } catch {
        // network error — leave as pending
      }
    }

    if (anyChanged) saveAllPicks(updated);
    setSettling(false);
    return updated;
  }, []);

  useEffect(() => {
    setMounted(true);
    const stored = loadAllPicks();
    setPicks(stored);
    settlePending(stored).then(setPicks);
  }, [settlePending]);

  if (!mounted || picks.length === 0) return null;

  const settled = picks.filter((p) => p.result !== "pending");
  const wins = settled.filter((p) => p.result === "win");
  const losses = settled.filter((p) => p.result === "loss");
  const pending = picks.filter((p) => p.result === "pending");
  const roi = settled.reduce((sum, p) => sum + unitReturn(p), 0);
  const winRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;

  const byTier = (tier: string) => {
    const t = settled.filter((p) => p.confidence === tier);
    const w = t.filter((p) => p.result === "win").length;
    return { w, l: t.length - w, n: t.length };
  };
  const strong = byTier("strong");
  const lean = byTier("lean");

  const recent = [...picks].reverse().slice(0, 6);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          Pick Record
        </h2>
        <button
          onClick={() => { saveAllPicks([]); setPicks([]); }}
          className="text-[10px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
        >
          Clear history
        </button>
      </div>

      <div className="stat-card">
        {/* Summary row */}
        <div className="flex items-center gap-6 mb-4">
          {/* W-L */}
          <div>
            <p className="text-2xl font-bold text-[var(--text)]">
              {wins.length}
              <span className="text-[var(--muted)]">-</span>
              {losses.length}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {settled.length > 0 ? `${winRate.toFixed(0)}% win rate` : "No settled picks"}
              {pending.length > 0 && ` · ${pending.length} pending`}
            </p>
          </div>

          {/* ROI */}
          {settled.length > 0 && (
            <div className="border-l border-[var(--border)] pl-6">
              <p
                className="text-2xl font-bold"
                style={{ color: roi >= 0 ? "var(--success)" : "var(--danger)" }}
              >
                {fmtMoney(roi)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">per $100 bet (flat)</p>
            </div>
          )}

          {/* Tier breakdown */}
          {settled.length > 0 && (
            <div className="border-l border-[var(--border)] pl-6 space-y-0.5 ml-auto">
              {strong.n > 0 && (
                <p className="text-xs text-[var(--muted)]">
                  Strong{" "}
                  <span className="font-semibold text-[var(--text)]">
                    {strong.w}-{strong.l}
                  </span>
                </p>
              )}
              {lean.n > 0 && (
                <p className="text-xs text-[var(--muted)]">
                  Lean{" "}
                  <span className="font-semibold text-[var(--text)]">
                    {lean.w}-{lean.l}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent picks */}
        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          {recent.map((pick) => {
            const isPending = pick.result === "pending";
            const isWin = pick.result === "win";
            const ret = isPending ? null : unitReturn(pick);

            return (
              <div key={`${pick.gameId}-${pick.pickedTeam}`} className="flex items-center gap-3">
                {/* Result dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: isPending
                      ? "var(--muted)"
                      : isWin
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                />

                {/* Pick info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">
                    {pick.pickedTeam} ML{" "}
                    <span className="font-normal">
                      {pick.moneyline > 0 ? `+${pick.moneyline}` : pick.moneyline}
                    </span>
                    <span className="text-[var(--muted)] font-normal ml-1">vs {pick.opponent}</span>
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {pick.date} · {CONFIDENCE_LABEL[pick.confidence]}
                  </p>
                </div>

                {/* Return */}
                <div className="text-right flex-shrink-0">
                  {isPending ? (
                    <span className="text-xs text-[var(--muted)]">
                      {settling ? "checking…" : "pending"}
                    </span>
                  ) : (
                    <span
                      className="text-xs font-bold"
                      style={{ color: ret! >= 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {fmtMoney(ret!)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
