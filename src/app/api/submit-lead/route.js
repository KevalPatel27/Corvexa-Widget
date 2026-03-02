import { NextResponse } from 'next/server';
import { errorResponse, handleBackendError, handleCatchError } from '../_lib/routeHelpers';

const API_BASE_URL = process.env.API_BASE_URL;
const API_KEY = process.env.API_KEY;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
    try {
        if (!API_KEY) throw new Error('API_KEY environment variable is not set');

        const leadData = await request.json();
        const domain = request.headers.get('X-Client-Domain');

        if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');
        if (!leadData.session_id) return errorResponse('Invalid request', 400, 'Session ID is required');
        if (!leadData.name?.trim()) return errorResponse('Invalid request', 400, 'Name is required');
        if (!leadData.email?.trim()) return errorResponse('Invalid request', 400, 'Email is required');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(leadData.email)) {
            return errorResponse('Invalid request', 400, 'Please provide a valid email address');
        }

        const res = await fetch(`${API_BASE_URL}/submit-lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Client-Domain': domain,
            },
            body: JSON.stringify({
                session_id: leadData.session_id,
                name: leadData.name,
                email: leadData.email,
                phone: leadData.phone || null,
            }),
            cache: 'no-store',
        });

        if (!res.ok) return handleBackendError(res);

        const responseData = await res.json();

        // Submit to HubSpot (fire-and-forget — never fails the main request)
        submitToHubSpot(domain, leadData).catch((err) =>
            console.error('❌ HubSpot submission error:', err)
        );

        return NextResponse.json(responseData);
    } catch (error) {
        return handleCatchError(error);
    }
}

/**
 * Fire-and-forget HubSpot form submission.
 * Errors here are logged but never propagate to the client.
 */
async function submitToHubSpot(domain, leadData) {
    const hubspotSettingsRes = await fetch(
        `https://${domain}/wp-json/chatbot/v1/hubspot-settings`,
        { method: 'GET', cache: 'no-store' }
    );

    if (!hubspotSettingsRes.ok) return;

    const hubspotSettings = await hubspotSettingsRes.json();
    if (!hubspotSettings.success || !hubspotSettings.portal_id || !hubspotSettings.form_id) return;

    const { portal_id, form_id } = hubspotSettings;
    const nameParts = leadData.name.trim().split(/\s+/);
    const firstname = nameParts[0] || '';
    const lastname = nameParts.slice(1).join(' ') || '';

    const fields = [
        { name: 'firstname', value: firstname },
        { name: 'lastname', value: lastname },
        { name: 'email', value: leadData.email },
    ];

    if (leadData.phone?.trim()) {
        fields.push({ name: 'phone', value: leadData.phone });
    }

    const formData = { fields };

    if (leadData.hubspotTracking) {
        const { cookies, ipAddress, pageUrl, pageName } = leadData.hubspotTracking;
        formData.context = {};
        if (cookies?.hutk) formData.context.hutk = cookies.hutk;
        if (ipAddress) formData.context.ipAddress = ipAddress;
        if (pageUrl) formData.context.pageUri = pageUrl;
        if (pageName) formData.context.pageName = pageName;
    }

    const hubspotRes = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${portal_id}/${form_id}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        }
    );

    if (!hubspotRes.ok) {
        const err = await hubspotRes.json().catch(() => ({}));
        console.error('❌ HubSpot submission failed:', { status: hubspotRes.status, error: err });
    }
}
