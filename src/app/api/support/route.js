import { NextResponse } from 'next/server';
import { errorResponse, handleBackendError, handleCatchError, getClientIP, buildBackendHeaders } from '../_lib/routeHelpers';

const API_BASE_URL = process.env.API_BASE_URL;
const API_KEY = process.env.API_KEY;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    if (!API_KEY) throw new Error('API_KEY environment variable is not set');

    const formData = await request.json();
    const domain = request.headers.get('X-Client-Domain');

    if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');
    if (!formData.name?.trim()) return errorResponse('Invalid request', 400, 'Name is required');
    if (!formData.email?.trim()) return errorResponse('Invalid request', 400, 'Email is required');
    if (!formData.user_issue?.trim()) return errorResponse('Invalid request', 400, 'Issue description is required');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return errorResponse('Invalid request', 400, 'Please provide a valid email address');
    }

    const clientIP = getClientIP(request);
    const backendHeaders = buildBackendHeaders(API_KEY, domain, clientIP);

    const res = await fetch(`${API_BASE_URL}/send-support-email`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(formData),
      cache: 'no-store',
    });

    if (!res.ok) return handleBackendError(res);

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return errorResponse('Invalid response', 500, 'Server returned an invalid response format');
    }

    const responseData = await res.json();
    return NextResponse.json(responseData);
  } catch (error) {
    return handleCatchError(error);
  }
}
