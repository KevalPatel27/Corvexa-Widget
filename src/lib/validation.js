/**
 * @file src/lib/validation.js
 * Pure validation functions. No React dependencies.
 * Each validator returns { valid: boolean, value?: string, error?: string }
 */

/**
 * Validate a full name (at least two words, letters only).
 * @param {string} input
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateName(input) {
    const normalized = (input || '').replace(/\s+/g, ' ').trim();
    const pattern = /^[\p{L}]+(?:\s+[\p{L}]+)+$/u;

    if (!pattern.test(normalized)) {
        return {
            valid: false,
            error: "Hmm, that doesn't seem right. Could you enter your **full name** (First & Last) using letters only?",
        };
    }

    return { valid: true, value: normalized };
}

// Common personal/free email providers to block
const PERSONAL_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.com.au', 'ymail.com',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
    'outlook.com', 'outlook.in', 'outlook.co.in', 'outlook.co.uk', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'aim.com',
    'protonmail.com', 'proton.me',
    'zoho.com',
    'mail.com', 'email.com',
    'rediffmail.com',   
    'tutanota.com',
    'gmx.com', 'gmx.de', 'gmx.net',
    'inbox.com',
]);

/**
 * Validate a work/company email address.
 * Rejects personal email providers (Gmail, Yahoo, etc.).
 * @param {string} input
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateEmail(input) {
    const trimmed = (input || '').trim();
    const pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!pattern.test(trimmed)) {
        return {
            valid: false,
            error: "Hmm, that doesn't look like a valid email address. Could you double-check and try again?",
        };
    }

    const domain = trimmed.split('@')[1]?.toLowerCase();
    if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
        return {
            valid: false,
            error: "Oops! It looks like that's a personal email.😊 Could you share your **work or company email** instead? That helps us get you connected faster!",
        };
    }

    return { valid: true, value: trimmed };
}

/**
 * Validate a phone number. "skip" is accepted and returns an empty string.
 * @param {string} input
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validatePhone(input) {
    const trimmed = (input || '').trim();

    if (trimmed.toLowerCase() === 'skip') {
        return { valid: true, value: '' };
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10) {
        return {
            valid: false,
            error: "Hmm, that doesn't look quite right.😊 Could you double-check your **phone number**? We need at least 10 digits to reach you!",
        };
    }

    return { valid: true, value: trimmed };
}
