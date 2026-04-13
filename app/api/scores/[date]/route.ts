import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const res = await fetch(`https://api-web.nhle.com/v1/score/${date}`);
  const data = await res.json();
  return Response.json(data.games ?? []);
}
