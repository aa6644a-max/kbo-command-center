const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:8001';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/standings`, {
      cache: 'no-store',
    });
    if (!res.ok) return Response.json([]);
    return Response.json(await res.json());
  } catch {
    return Response.json([]);
  }
}
