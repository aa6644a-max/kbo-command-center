import type { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8001';

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/predictions/[date]'>
) {
  const { date } = await ctx.params;

  try {
    const res = await fetch(`${BACKEND}/predictions/${date}`, {
      // 서버 캐시: 5분
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return Response.json([], { status: 200 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
