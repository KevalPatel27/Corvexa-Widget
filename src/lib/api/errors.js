/**
 * @file src/lib/api/errors.js
 * Typed error class for API failures.
 */

export class ApiError extends Error {
    /**
     * @param {string} message - Human-readable error message
     * @param {number} status  - HTTP status code
     * @param {string} [detail] - Optional detail from the server
     */
    constructor(message, status, detail = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
    }

    get isRateLimit() { return this.status === 429; }
    get isUnauthorized() { return this.status === 401; }
    get isForbidden() { return this.status === 403; }
    get isNotFound() { return this.status === 404; }
    get isServerError() { return this.status >= 500; }
}
