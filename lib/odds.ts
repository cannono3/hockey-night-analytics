const TEAM_NAME_TO_ABBREV: Record<string, string> = {
  "Anaheim Ducks": "ANA",
  "Boston Bruins": "BOS",
  "Buffalo Sabres": "BUF",
  "Calgary Flames": "CGY",
  "Carolina Hurricanes": "CAR",
  "Chicago Blackhawks": "CHI",
  "Colorado Avalanche": "COL",
  "Columbus Blue Jackets": "CBJ",
  "Dallas Stars": "DAL",
  "Detroit Red Wings": "DET",
  "Edmonton Oilers": "EDM",
  "Florida Panthers": "FLA",
  "Los Angeles Kings": "LAK",
  "Minnesota Wild": "MIN",
  "Montreal Canadiens": "MTL",
  "Nashville Predators": "NSH",
  "New Jersey Devils": "NJD",
  "New York Islanders": "NYI",
  "New York Rangers": "NYR",
  "Ottawa Senators": "OTT",
  "Philadelphia Flyers": "PHI",
  "Pittsburgh Penguins": "PIT",
  "San Jose Sharks": "SJS",
  "Seattle Kraken": "SEA",
  "St. Louis Blues": "STL",
  "St Louis Blues": "STL",
  "Tampa Bay Lightning": "TBL",
  "Toronto Maple Leafs": "TOR",
  "Utah Hockey Club": "UTA",
  "Utah Mammoth": "UTA",
  "Vancouver Canucks": "VAN",
  "Vegas Golden Knights": "VGK",
  "Washington Capitals": "WSH",
  "Winnipeg Jets": "WPG",
};

export interface OddsGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  moneyline?: { home: number; away: number };
  spread?: { homePoint: number; homePrice: number; awayPrice: number };
  total?: { point: number; overPrice: number; underPrice: number };
}

export async function getNHLOdds(): Promise<OddsGame[]> {
  const key = process.env.ODDS_API_KEY;
  if (!key || key === "your_key_here") return [];

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/?apiKey=${key}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();

    return data.map((game) => {
      const bookmaker = game.bookmakers?.[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h2h = bookmaker?.markets?.find((m: any) => m.key === "h2h");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spreads = bookmaker?.markets?.find((m: any) => m.key === "spreads");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totals = bookmaker?.markets?.find((m: any) => m.key === "totals");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const homeH2H = h2h?.outcomes?.find((o: any) => o.name === game.home_team);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const awayH2H = h2h?.outcomes?.find((o: any) => o.name === game.away_team);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const homeSpread = spreads?.outcomes?.find((o: any) => o.name === game.home_team);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const awaySpread = spreads?.outcomes?.find((o: any) => o.name === game.away_team);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const over = totals?.outcomes?.find((o: any) => o.name === "Over");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const under = totals?.outcomes?.find((o: any) => o.name === "Under");

      return {
        id: game.id,
        homeTeam: TEAM_NAME_TO_ABBREV[game.home_team] ?? game.home_team,
        awayTeam: TEAM_NAME_TO_ABBREV[game.away_team] ?? game.away_team,
        commenceTime: game.commence_time,
        moneyline:
          homeH2H && awayH2H
            ? { home: homeH2H.price, away: awayH2H.price }
            : undefined,
        spread:
          homeSpread && awaySpread
            ? {
                homePoint: homeSpread.point,
                homePrice: homeSpread.price,
                awayPrice: awaySpread.price,
              }
            : undefined,
        total:
          over && under
            ? { point: over.point, overPrice: over.price, underPrice: under.price }
            : undefined,
      };
    });
  } catch {
    return [];
  }
}
