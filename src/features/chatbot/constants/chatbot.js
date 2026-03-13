/**
 * @file src/features/chatbot/constants/chatbot.js
 * Single source of truth for all magic numbers and constants.
 */

/** Artificial typing delay for flow-driven bot messages (ms) */
export const FLOW_BOT_DELAY_MS = 2500;

/** How many days before localStorage state expires */
export const EXPIRY_DAYS = 1;

/** Idle timer before showing the first-visit tour prompt (ms) */
export const IDLE_TOUR_PROMPT_DELAY_MS = 6000;

/** Idle timer check interval (ms) */
export const IDLE_CHECK_INTERVAL_MS = 4000;

/** Max retries for API calls */
export const API_MAX_RETRIES = 2;

/** Delay before focusing input after bot finishes typing (ms) */
export const INPUT_FOCUS_DELAY_MS = 100;

/** Delay before sending data to iframe after load (ms) */
export const IFRAME_LOAD_DELAY_MS = 2000;

/** Support flow steps */
export const SUPPORT_STEPS = {
    SUBMITTED_CONFIRM: 'submitted_confirm',  // re-entry after a completed lead
    RESUME_CONFIRM: 'resume_confirm',         // re-entry with partial data
    NAME: 'name',
    EMAIL: 'email',
    PHONE: 'phone',
    INTEREST_AREA: 'interest_area',
    TIME_PREFERENCE: 'time_preference',
};

/** SSE event types from the backend */
export const SSE_EVENTS = {
    TOKEN: 'token',
    ANSWER: 'answer',
    CROSS_QUESTION: 'cross_question',
    REQUIRE_INTENT_CHECK: 'require_intent_check',
    TRIGGER_LEAD: 'trigger_lead',
    ERROR: 'error',
    DONE: 'done',
};
