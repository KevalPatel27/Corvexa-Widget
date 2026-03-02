import { NextResponse } from 'next/server';

/**
 * Build a standardized error JSON response.
 * @param {string} message - Short error label
 * @param {number} status  - HTTP status code
 * @param {string|null} detail - Optional detail string
 */
export function errorResponse(message, status, detail = null) {
    return NextResponse.json(
        { error: message, ...(detail && { detail }) },
        { status }
    );
}

/**
 * Inspect a non-ok backend response and return the appropriate NextResponse.
 * Handles 429, 401, 403, 404, 5xx, and generic failures.
 * @param {Response} res - The raw fetch Response from the backend
 */
export async function handleBackendError(res) {
    const data = await res.json().catch(() => ({}));
    const detail = data.detail || null;

    if (res.status === 429) return errorResponse('Rate limit exceeded', 429, detail || 'Too many requests. Please try again later.');
    if (res.status === 401) return errorResponse('Unauthorized', 401, detail || 'Invalid API key or authentication failed');
    if (res.status === 403) return errorResponse('Forbidden', 403, detail || 'Access denied. Please contact support.');
    if (res.status === 404) return errorResponse('Not found', 404, detail || 'The requested resource was not found');
    if (res.status >= 500) return errorResponse('Server error', 500, detail || 'Internal server error. Please try again later.');

    return errorResponse('Request failed', res.status, detail || `Request failed with status ${res.status}`);
}

/**
 * Handle common catch-block errors (network, timeout, JSON parse).
 * @param {Error} error
 */
export function handleCatchError(error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return errorResponse('Network error', 503, 'Unable to connect to the server. Please check your internet connection and try again.');
    }
    if (error.name === 'AbortError') {
        return errorResponse('Request timeout', 408, 'The request took too long to complete. Please try again.');
    }
    if (error.name === 'SyntaxError') {
        return errorResponse('Invalid request', 400, 'Invalid JSON format in request body');
    }
    return errorResponse('Internal server error', 500, error.message || 'An unexpected error occurred');
}

/**
 * Extract the real client IP from common proxy headers.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIP(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const clientIP = request.headers.get('x-client-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    return (
        realIP ||
        clientIP ||
        cfConnectingIP ||
        (forwarded ? forwarded.split(',')[0].trim() : null) ||
        'unknown'
    );
}

/**
 * Build backend headers with IP forwarding (skips Docker-internal IPs).
 * @param {string} apiKey
 * @param {string} domain
 * @param {string} clientIP
 */
export function buildBackendHeaders(apiKey, domain, clientIP = null) {
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Client-Domain': domain,
    };

    if (
        clientIP &&
        !clientIP.startsWith('172.') &&
        !clientIP.startsWith('10.') &&
        clientIP !== 'unknown'
    ) {
        headers['X-Real-IP'] = clientIP;
        headers['X-Forwarded-For'] = clientIP;
        headers['X-Client-IP'] = clientIP;
        headers['CF-Connecting-IP'] = clientIP;
    }

    return headers;
}
