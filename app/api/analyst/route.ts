import "server-only";
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BASE = "https://api-web.nhle.com/v1";

async function nhlFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`NHL API ${res.status}: ${path}`);
  return res.json();
}

// Tools the AI can call to fetch real data
const tools: Anthropic.Tool[] = [
  {
    name: "get_standings",
    description: "Get current NHL standings with wins, losses, points, goal differential, streaks, and last-10 record for all 32 teams.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_team_stats",
    description: "Get skater and goalie stats for a specific team this season.",
    input_schema: {
      type: "object",
      properties: {
        team_abbrev: { type: "string", description: "3-letter team abbreviation e.g. BOS, TOR, EDM" },
      },
      required: ["team_abbrev"],
    },
  },
  {
    name: "get_team_schedule",
    description: "Get the full season schedule and results (scores, opponents, home/away) for a team.",
    input_schema: {
      type: "object",
      properties: {
        team_abbrev: { type: "string", description: "3-letter team abbreviation" },
      },
      required: ["team_abbrev"],
    },
  },
  {
    name: "get_league_leaders",
    description: "Get the top scorers in the league for a given stat category.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Stat category: points, goals, assists, plusMinus, penaltyMinutes, powerPlayGoals, shortHandedGoals, gameWinningGoals, shots",
        },
        limit: { type: "number", description: "Number of players to return (default 15)" },
      },
      required: ["category"],
    },
  },
  {
    name: "get_player_stats",
    description: "Get career stats and bio for a specific player by their NHL player ID.",
    input_schema: {
      type: "object",
      properties: {
        player_id: { type: "number", description: "NHL player ID" },
      },
      required: ["player_id"],
    },
  },
  {
    name: "search_player",
    description: "Search for a player by name to get their player ID.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Player name to search" },
      },
      required: ["query"],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_standings": {
      const data = await nhlFetch("/standings/now");
      return data.standings.map((t: Record<string, unknown>) => ({
        team: (t.teamAbbrev as { default: string }).default,
        name: (t.teamCommonName as { default: string }).default,
        division: t.divisionName,
        conference: t.conferenceName,
        gp: t.gamesPlayed,
        w: t.wins, l: t.losses, ot: t.otLosses,
        pts: t.points,
        gf: t.goalFor, ga: t.goalAgainst, diff: t.goalDifferential,
        streak: `${t.streakCode}${t.streakCount}`,
        l10: `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`,
        pctg: t.pointPctg,
      }));
    }
    case "get_team_stats": {
      const abbrev = String(input.team_abbrev).toUpperCase();
      const data = await nhlFetch(`/club-stats/${abbrev}/now`);
      return {
        skaters: data.skaters.map((s: Record<string, unknown>) => ({
          id: s.playerId,
          name: `${(s.firstName as { default: string }).default} ${(s.lastName as { default: string }).default}`,
          pos: s.positionCode, gp: s.gamesPlayed,
          g: s.goals, a: s.assists, pts: s.points,
          pm: s.plusMinus, ppg: s.powerPlayGoals,
          shots: s.shots, spct: s.shootingPctg,
          gwg: s.gameWinningGoals, toi: s.avgTimeOnIcePerGame,
        })).sort((a: { pts: number }, b: { pts: number }) => b.pts - a.pts),
        goalies: data.goalies.map((g: Record<string, unknown>) => ({
          id: g.playerId,
          name: `${(g.firstName as { default: string }).default} ${(g.lastName as { default: string }).default}`,
          gp: g.gamesPlayed, w: g.wins, l: g.losses, ot: g.otLosses,
          gaa: g.goalsAgainstAvg, svpct: g.savePctg, so: g.shutouts,
        })),
      };
    }
    case "get_team_schedule": {
      const abbrev = String(input.team_abbrev).toUpperCase();
      const data = await nhlFetch(`/club-schedule-season/${abbrev}/now`);
      const games = data.games.filter((g: Record<string, unknown>) => g.gameType === 2);
      return games.map((g: Record<string, unknown>) => {
        const away = g.awayTeam as { abbrev: string; score?: number };
        const home = g.homeTeam as { abbrev: string; score?: number };
        const isHome = home.abbrev === abbrev;
        return {
          date: g.gameDate,
          state: g.gameState,
          home: isHome,
          opponent: isHome ? away.abbrev : home.abbrev,
          teamScore: isHome ? (home.score ?? null) : (away.score ?? null),
          oppScore: isHome ? (away.score ?? null) : (home.score ?? null),
        };
      });
    }
    case "get_league_leaders": {
      const cat = String(input.category);
      const limit = Number(input.limit ?? 15);
      const data = await nhlFetch(`/skater-stats-leaders/current?categories=${cat}&limit=${limit}`);
      const leaders = data[cat] ?? [];
      return leaders.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: `${(p.firstName as { default: string }).default} ${(p.lastName as { default: string }).default}`,
        team: p.teamAbbrev,
        pos: p.position,
        value: p.value,
      }));
    }
    case "get_player_stats": {
      const data = await nhlFetch(`/player/${Number(input.player_id)}/landing`);
      return {
        id: data.playerId,
        name: `${data.firstName?.default} ${data.lastName?.default}`,
        team: data.teamAbbrev,
        pos: data.position,
        number: data.sweaterNumber,
        thisSeasonGP: data.featuredStats?.regularSeason?.subSeason?.gamesPlayed,
        thisSeasonG: data.featuredStats?.regularSeason?.subSeason?.goals,
        thisSeasonA: data.featuredStats?.regularSeason?.subSeason?.assists,
        thisSeasonPTS: data.featuredStats?.regularSeason?.subSeason?.points,
        careerPTS: data.featuredStats?.regularSeason?.career?.points,
        careerG: data.featuredStats?.regularSeason?.career?.goals,
        seasons: (data.seasonTotals ?? [])
          .filter((s: Record<string, unknown>) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2)
          .map((s: Record<string, unknown>) => ({
            season: s.season,
            team: (s.teamName as { default: string }).default,
            gp: s.gamesPlayed, g: s.goals, a: s.assists, pts: s.points,
            pm: s.plusMinus, ppg: s.powerPlayGoals,
          })),
      };
    }
    case "search_player": {
      const query = String(input.query).toLowerCase();
      // Search via team stats for BOS and major teams
      const teams = ["BOS", "TOR", "EDM", "PIT", "NYR", "VGK", "COL", "CAR", "FLA", "DAL"];
      const results: unknown[] = [];
      for (const team of teams) {
        try {
          const data = await nhlFetch(`/club-stats/${team}/now`);
          for (const s of data.skaters) {
            const name = `${s.firstName.default} ${s.lastName.default}`.toLowerCase();
            if (name.includes(query)) {
              results.push({ id: s.playerId, name: `${s.firstName.default} ${s.lastName.default}`, team });
            }
          }
          if (results.length >= 3) break;
        } catch { /* skip */ }
      }
      return results;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const apiMessages: Anthropic.MessageParam[] = messages;
        let response = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          system: `You are an expert NHL hockey analyst with access to live NHL data. When asked questions, use your tools to fetch real current data before answering. Be specific, cite actual numbers, and give insightful analysis beyond just listing stats. Format responses with clear sections using markdown. The user is a Boston Bruins fan.`,
          tools,
          messages: apiMessages,
        });

        // Agentic loop — keep going until no more tool calls
        while (response.stop_reason === "tool_use") {
          const toolUses = response.content.filter((b) => b.type === "tool_use");

          // Notify client which tools are being called
          for (const tu of toolUses) {
            send({ type: "tool_call", tool: tu.name });
          }

          // Execute all tools in parallel
          const toolResults = await Promise.all(
            toolUses.map(async (tu) => {
              if (tu.type !== "tool_use") return null;
              const result = await executeTool(tu.name, tu.input as Record<string, unknown>);
              return {
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: JSON.stringify(result),
              };
            })
          );

          apiMessages.push(
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[] }
          );

          response = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 4096,
            system: `You are an expert NHL hockey analyst with access to live NHL data. When asked questions, use your tools to fetch real current data before answering. Be specific, cite actual numbers, and give insightful analysis beyond just listing stats. Format responses with clear sections using markdown. The user is a Boston Bruins fan.`,
            tools,
            messages: apiMessages,
          });
        }

        // Stream the final text response
        const text = response.content.find((b) => b.type === "text");
        if (text && text.type === "text") {
          send({ type: "text", content: text.text });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
