import { NextResponse } from 'next/server';
import { errorResponse, handleBackendError, handleCatchError } from '../_lib/routeHelpers';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error('API_KEY environment variable is not set');
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { prompt, domain } = await request.json();

    if (!prompt?.trim()) return errorResponse('Invalid request', 400, 'Prompt is required');
    if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Client-Domain': domain,
        'Connection': 'keep-alive',
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return handleBackendError(response);

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return handleCatchError(error);
  }
}