/**
 * @file src/lib/api/client.js
 * Centralized HTTP client for all client-side API calls.
 * Wraps fetchWithRetry, normalizes errors into ApiError instances.
 */

import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { ApiError } from './errors';

/**
 * Make a POST request to a Next.js API route.
 * Throws ApiError on non-ok responses.
 *
 * @param {string} path - Relative URL (e.g. '/api/submit-lead')
 * @param {object} body - JSON body
 * @param {Record<string, string>} [extraHeaders] - Additional headers
 * @param {number} [retries=2] - Number of retries on network failure
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiPost(path, body, extraHeaders = {}, retries = 2) {
    const res = await fetchWithRetry(
        path,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders,
            },
            body: JSON.stringify(body),
        },
        retries
    );

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(
            data.error || 'Request failed',
            res.status,
            data.detail || null
        );
    }

    return res.json();
}

/**
 * Make a POST request that returns a streaming Response (for SSE).
 * Returns the raw Response — caller handles the stream.
 *
 * @param {string} path
 * @param {object} body
 * @param {Record<string, string>} [extraHeaders]
 * @param {number} [retries=2]
 * @returns {Promise<Response>}
 */
export async function apiStream(path, body, extraHeaders = {}, retries = 2) {
    const res = await fetchWithRetry(
        path,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...extraHeaders,
            },
            body: JSON.stringify(body),
        },
        retries
    );

    // Return the raw response — caller reads the stream
    return res;
}
