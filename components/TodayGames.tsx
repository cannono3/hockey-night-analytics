import { TodayGame } from "@/lib/nhl";
import Image from "next/image";

function gameStatus(game: TodayGame) {
  if (game.gameState === "FUT" || game.gameState === "PRE") {
    const t = new Date(game.startTimeUTC).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
    return t;
  }
  if (game.gameState === "LIVE" || game.gameState === "CRIT") {
    const p = game.periodDescriptor;
    const time = game.clock?.timeRemaining ?? "";
    const inInt = game.clock?.inIntermission;
    if (inInt) return `INT ${p?.number}`;
    return `${p?.number}P ${time}`;
  }
  return "Final";
}

export default function TodayGames({ games }: { games: TodayGame[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
      {games.map((game) => {
        const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
        const isFinal = game.gameState === "OFF" || game.gameState === "FINAL";
        return (
          <div
            key={game.id}
            className="flex-shrink-0 stat-card min-w-[200px] flex flex-col gap-2"
          >
            {/* Status */}
            <div className="flex items-center gap-1.5">
              {isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              )}
              <span className={`text-xs font-semibold ${isLive ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                {gameStatus(game)}
              </span>
            </div>

            {/* Teams */}
            {[game.awayTeam, game.homeTeam].map((team, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image src={team.logo} alt={team.abbrev} width={20} height={20} className="object-contain" />
                  <span className="text-sm font-semibold text-[var(--text)]">{team.abbrev}</span>
                  <span className="text-xs text-[var(--muted)]">{i === 0 ? "Away" : "Home"}</span>
                </div>
                {(isLive || isFinal) && (
                  <span className="text-base font-bold text-[var(--text)]">{team.score ?? 0}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
