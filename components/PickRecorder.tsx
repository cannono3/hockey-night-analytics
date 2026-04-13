"use client";

import { useEffect } from "react";

export interface SerializablePick {
  gameId: number;
  pickedTeam: string;
  opponent: string;
  side: "home" | "away";
  moneyline: number;
  ev: number;
  confidence: "strong" | "lean" | "low";
}

export interface StoredPick extends SerializablePick {
  date: string;
  result: "win" | "loss" | "pending";
  savedAt: string;
}

export const PICKS_KEY = "hna-picks-v1";

export function loadAllPicks(): StoredPick[] {
  try {
    const raw = localStorage.getItem(PICKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAllPicks(picks: StoredPick[]) {
  localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
}

interface Props {
  picks: SerializablePick[];
  date: string; // "YYYY-MM-DD"
}

// Silent component — just records today's picks to localStorage on mount.
export default function PickRecorder({ picks, date }: Props) {
  useEffect(() => {
    if (picks.length === 0) return;
    const stored = loadAllPicks();

    let changed = false;
    for (const pick of picks) {
      const exists = stored.some((p) => p.gameId === pick.gameId);
      if (!exists) {
        stored.push({ ...pick, date, result: "pending", savedAt: new Date().toISOString() });
        changed = true;
      }
    }
    if (changed) saveAllPicks(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
