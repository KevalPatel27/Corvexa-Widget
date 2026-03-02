import { errorResponse, handleBackendError, handleCatchError } from '../_lib/routeHelpers';

const API_BASE_URL = process.env.API_BASE_URL;
const API_KEY = process.env.API_KEY;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
    try {
        if (!API_KEY) throw new Error('API_KEY environment variable is not set');

        const { message, context } = await request.json();
        const domain = request.headers.get('x-client-domain');

        if (!message?.trim()) return errorResponse('Invalid request', 400, 'Message is required');
        if (!context?.trim()) return errorResponse('Invalid request', 400, 'Context is required');
        if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE_URL}/detect-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Client-Domain': domain,
            },
            body: JSON.stringify({ message, context }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) return handleBackendError(response);

        const data = await response.json();
        return Response.json(data);
    } catch (error) {
        return handleCatchError(error);
    }
}
