import { NextResponse } from 'next/server';
import { errorResponse, handleBackendError, handleCatchError } from '../_lib/routeHelpers';

/** Personal/free email domains to exclude from company name extraction */
const PERSONAL_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'pm.me',
    'zoho.com', 'yandex.com', 'mail.com', 'gmx.com', 'rediffmail.com',
]);

/**
 * Extracts a company name from an email address.
 * e.g. "john@acme-corp.com" → "Acme Corp"
 * Returns null for personal email providers.
 */
function extractCompanyFromEmail(email) {
    try {
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (!emailDomain || PERSONAL_DOMAINS.has(emailDomain)) return null;
        // Strip TLD(s) - handle .co.uk, .com.au etc.
        const namePart = emailDomain.split('.').slice(0, -1).join(' ');
        // Capitalise each word and replace hyphens/underscores with spaces
        return namePart
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    } catch {
        return null;
    }
}

const API_BASE_URL = process.env.API_BASE_URL;
const API_KEY = process.env.API_KEY;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
    try {
        if (!API_KEY) throw new Error('API_KEY environment variable is not set');

        const leadData = await request.json();
        const domain = request.headers.get('X-Client-Domain');

        // Cloudflare automatically adds this header — 2-letter ISO country code (e.g. "IN", "US")
        const country = request.headers.get('CF-IPCountry') || null;

        if (!domain) return errorResponse('Invalid request', 400, 'Domain is required');
        if (!leadData.session_id) return errorResponse('Invalid request', 400, 'Session ID is required');
        if (!leadData.name?.trim()) return errorResponse('Invalid request', 400, 'Name is required');
        if (!leadData.email?.trim()) return errorResponse('Invalid request', 400, 'Email is required');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(leadData.email)) {
            return errorResponse('Invalid request', 400, 'Please provide a valid email address');
        }

        // Build the shared payload once — used by both endpoints
        const companyName = extractCompanyFromEmail(leadData.email);
        const leadPayload = {
            session_id: leadData.session_id,
            name: leadData.name,
            email: leadData.email,
            phone: leadData.phone || null,
            interest_area: leadData.interest_area || null,
            time_preference: leadData.time_preference || null,
            country: country,
            company_name: companyName,
            page_url: leadData.hubspotTracking?.pageUrl || null,
            page_name: leadData.hubspotTracking?.pageName || null,
        };

        const sharedHeaders = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-Client-Domain': domain,
        };

        // Fire both backend calls in parallel — same payload, different endpoints
        const [submitResult, emailResult] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/submit-lead`, {
                method: 'POST',
                headers: sharedHeaders,
                body: JSON.stringify(leadPayload),
                cache: 'no-store',
            }),
            fetch(`${API_BASE_URL}/lead-email`, {
                method: 'POST',
                headers: sharedHeaders,
                body: JSON.stringify(leadPayload),
                cache: 'no-store',
            }),
        ]);

        // /submit-lead response is authoritative — check it first
        if (submitResult.status === 'rejected') throw submitResult.reason;
        const res = submitResult.value;
        if (!res.ok) return handleBackendError(res);

        const responseData = await res.json();

        // Log /lead-email failure silently (never blocks the response)
        if (emailResult.status === 'rejected') {
            console.error('❌ Lead email error:', emailResult.reason);
        } else if (!emailResult.value.ok) {
            emailResult.value.json().catch(() => ({})).then(err =>
                console.error('❌ Lead email failed:', { status: emailResult.value.status, error: err })
            );
        }

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
    if (leadData.interest_area?.trim()) {
        fields.push({ name: 'interest_area', value: leadData.interest_area });
    }
    if (leadData.time_preference?.trim()) {
        fields.push({ name: 'time_preference', value: leadData.time_preference });
    }
    if (leadData.country?.trim()) {
        fields.push({ name: 'country', value: leadData.country });
    }
    if (leadData.page_name?.trim()) {
        fields.push({ name: 'page_name', value: leadData.page_name });
    }
    const company = extractCompanyFromEmail(leadData.email);
    if (company) {
        fields.push({ name: 'company', value: company });
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
