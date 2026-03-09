/**
 * @file src/features/chatbot/services/chatApi.js
 * All client-side API calls for the chatbot feature.
 * Components never call fetch directly — they use this service.
 */

import { apiPost, apiStream } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/errors';
import { API_MAX_RETRIES } from '../constants/chatbot';

/**
 * Submit a lead to the backend.
 *
 * @param {{ sessionId: string, name: string, email: string, phone?: string, interestArea?: string, timePreference?: string, hubspotTracking?: object, domain: string }} params
 * @returns {Promise<{ thank_you_message?: string }>}
 * @throws {ApiError}
 */
export async function submitLead({ sessionId, name, email, phone = '', interestArea = '', timePreference = '', hubspotTracking = null, domain }) {
    return apiPost(
        '/api/submit-lead',
        {
            session_id: sessionId,
            name,
            email,
            phone,
            interest_area: interestArea,
            time_preference: timePreference,
            hubspotTracking,
        },
        { 'X-Client-Domain': domain },
        API_MAX_RETRIES
    );
}

/**
 * Send a support request email.
 *
 * @param {{ name: string, email: string, userIssue: string, chatHistory: object[], mailConfig: object, domain: string }} params
 * @returns {Promise<object>}
 * @throws {ApiError}
 */
export async function sendSupportRequest({ name, email, userIssue, chatHistory, mailConfig, domain }) {
    return apiPost(
        '/api/support',
        {
            name,
            email,
            user_issue: userIssue,
            chat_history: chatHistory,
            mail_config: mailConfig,
        },
        { 'X-Client-Domain': domain },
        API_MAX_RETRIES
    );
}

/**
 * Detect user intent for a given message + context.
 *
 * @param {{ message: string, context: string, domain: string }} params
 * @returns {Promise<{ intent: string, confidence: number, explanation: string }>}
 */
export async function detectIntent({ message, context, domain }) {
    try {
        return await apiPost(
            '/api/detect-intent',
            { message, context },
            { 'X-Client-Domain': domain },
            API_MAX_RETRIES
        );
    } catch {
        // Fail gracefully — intent detection is non-critical
        return { intent: 'irrelevant', confidence: 0, explanation: 'Error' };
    }
}

/**
 * Start a streaming chat request.
 * Returns the raw Response — caller reads the SSE stream.
 *
 * @param {{ prompt: string, role?: string, domain: string, frontendDomain: string, sessionId: string }} params
 * @returns {Promise<Response>}
 * @throws {ApiError}
 */
export async function streamChat({ prompt, role = 'all', domain, frontendDomain, sessionId }) {
    return apiStream(
        '/api/chat-stream',
        {
            prompt,
            role,
            domain,
            frontendDomain,
            session_id: sessionId,
        },
        {},
        API_MAX_RETRIES
    );
}
