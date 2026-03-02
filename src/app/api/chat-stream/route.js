import { NextResponse } from 'next/server';
import { errorResponse, handleBackendError, handleCatchError, buildBackendHeaders } from '../_lib/routeHelpers';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
const API_KEY = process.env.API_KEY;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (!API_KEY) throw new Error('API_KEY environment variable is not set');

    const { prompt, message, domain, role, frontendDomain, session_id } = await request.json();
    const messageText = message || prompt; // support both field names for backwards compat

    if (!messageText?.trim()) return errorResponse('Invalid request', 400, 'Message is required');
    if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');

    // Get real client IP from common proxy headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfIP = request.headers.get('cf-connecting-ip');
    const clientIP = realIP || cfIP || (forwarded ? forwarded.split(',')[0].trim() : null);

    const backendHeaders = {
      'X-API-Key': API_KEY,
      'X-Client-Domain': domain,
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
      ...(session_id ? { 'X-Session-ID': session_id } : {}),
    };

    if (clientIP && !clientIP.startsWith('172.') && !clientIP.startsWith('10.') && clientIP !== 'unknown') {
      backendHeaders['X-Real-IP'] = clientIP;
      backendHeaders['X-Forwarded-For'] = clientIP;
      backendHeaders['CF-Connecting-IP'] = clientIP;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    // Abort upstream fetch when client disconnects
    request.signal.addEventListener('abort', () => controller.abort());

    const response = await fetch(`${API_BASE_URL}/chatbot/stream`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify({
        message: messageText,
        role: role || 'all',
        domain,
        frontendDomain,
        session_id,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) return handleBackendError(response);

    // Stream the SSE response directly to the client
    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable).catch(() => writable.abort());

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return handleCatchError(error);
  }
}
