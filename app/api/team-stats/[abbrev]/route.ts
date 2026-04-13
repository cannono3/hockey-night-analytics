import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ abbrev: string }> }) {
  const { abbrev } = await params;
  const res = await fetch(
    `https://api-web.nhle.com/v1/club-stats/${abbrev.toUpperCase()}/now`,
    { next: { revalidate: 60 } }
  );
  const data = await res.json();
  return Response.json(data);
}
