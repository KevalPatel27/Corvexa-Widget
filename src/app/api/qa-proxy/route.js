import { errorResponse, handleCatchError } from '../_lib/routeHelpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const domain = req.headers.get('x-client-domain');

    if (!domain) {
      return Response.json({ success: false, error: 'Missing domain header' });
    }

    const res = await fetch(`https://${domain}/wp-json/chatbot/v1/qa`, {
      cache: 'no-store',
    });

    if (!res.ok) return Response.json({});

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    return handleCatchError(error);
  }
}