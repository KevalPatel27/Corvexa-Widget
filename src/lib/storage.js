/**
 * @file src/lib/storage.js
 * Pure localStorage utilities for chatbot state persistence.
 * No React dependencies — fully unit-testable.
 */

const EXPIRY_DAYS = 1;

/**
 * Build the localStorage key for a given domain.
 * @param {string} domain
 * @returns {string}
 */
export function getStorageKey(domain) {
    const safeDomain = domain || 'default';
    return `chatbotState:${safeDomain}`;
}

/**
 * Load chatbot state from localStorage.
 * Returns null if no state exists or if the state has expired.
 * @param {string} domain
 * @returns {object|null}
 */
export function loadState(domain) {
    if (typeof window === 'undefined') return null;

    try {
        const savedState = localStorage.getItem(getStorageKey(domain));
        if (!savedState) return null;

        const state = JSON.parse(savedState);
        const expiryTime = state.timestamp + EXPIRY_DAYS * 24 * 60 * 60 * 1000;

        if (Date.now() > expiryTime) {
            localStorage.removeItem(getStorageKey(domain));
            return null;
        }

        return state;
    } catch {
        return null;
    }
}

/**
 * Save chatbot state to localStorage.
 * @param {string} domain
 * @param {object} state
 */
export function saveState(domain, state) {
    if (typeof window === 'undefined') return;

    try {
        const payload = {
            ...state,
            timestamp: Date.now(),
        };
        localStorage.setItem(getStorageKey(domain), JSON.stringify(payload));
    } catch {
        // Silently ignore quota errors
    }
}

/**
 * Patch a single field in the stored state without overwriting the rest.
 * @param {string} domain
 * @param {object} patch
 */
export function patchState(domain, patch) {
    if (typeof window === 'undefined') return;

    try {
        const current = JSON.parse(localStorage.getItem(getStorageKey(domain)) || '{}');
        localStorage.setItem(getStorageKey(domain), JSON.stringify({ ...current, ...patch }));
    } catch {
        // Silently ignore
    }
}

/**
 * Remove chatbot state from localStorage.
 * @param {string} domain
 */
export function clearState(domain) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(getStorageKey(domain));
}
