const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:8001';

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/pipeline/run`, { method: 'POST' });
    if (!res.ok) return Response.json({ status: 'error' }, { status: 500 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ status: 'error' }, { status: 500 });
  }
}
