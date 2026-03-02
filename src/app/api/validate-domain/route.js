import { NextResponse } from 'next/server';
import { errorResponse, handleCatchError } from '../_lib/routeHelpers';

const AUTH_DOMAIN_API = process.env.AUTH_DOMAIN_API;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const clientDomain = request.headers.get('x-client-domain');

    if (!clientDomain) {
      return errorResponse('Invalid request', 400, 'x-client-domain header is required');
    }

    if (!AUTH_DOMAIN_API) {
      return errorResponse('Server configuration error', 500, 'AUTH_DOMAIN_API is not configured');
    }

    const response = await fetch(AUTH_DOMAIN_API, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ valid: false, domain: null }, { status: 200 });
    }

    const result = await response.json();

    // API returns: { success: true, data: [ { domains: [ { frontend_domain, domain, status } ] } ] }
    if (!result.success || !Array.isArray(result.data)) {
      return NextResponse.json({ valid: false, domain: null });
    }

    // Search all users' domain entries for a matching active frontend_domain
    for (const user of result.data) {
      if (!Array.isArray(user.domains)) continue;

      for (const entry of user.domains) {
        if (
          entry.frontend_domain === clientDomain &&
          entry.status === 'active'
        ) {
          // Return the backend (WordPress) domain for API calls
          return NextResponse.json({ valid: true, domain: entry.domain });
        }
      }
    }

    // No matching active domain found
    return NextResponse.json({ valid: false, domain: null });
  } catch (error) {
    return handleCatchError(error);
  }
}
