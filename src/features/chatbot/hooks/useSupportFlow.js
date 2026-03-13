'use client';

import { useState, useCallback, useRef } from 'react';
import { FLOW_BOT_DELAY_MS, SUPPORT_STEPS } from '../constants/chatbot';
import { validateName, validateEmail, validatePhone } from '../../../lib/validation';
import { submitLead } from '../services/chatApi';
import { patchState } from '../../../lib/storage';

/**
 * Manages the support lead-collection flow state machine.
 * Steps: name → email → phone → interest_area → time_preference → submit
 *
 * @param {{ domain, user, hubspotTracking, mail, storageKey, setMessages, setIsBotTyping, delayedAppend, initialState, requestFreshTracking }} options
 */
export function useSupportFlow({
    domain,
    user,
    hubspotTracking,
    mail,
    storageKey,
    setMessages,
    setIsBotTyping,
    delayedAppend,
    initialState,
    requestFreshTracking,
}) {
    const [supportStep, setSupportStep] = useState(initialState?.supportStep ?? null);
    const [supportInfo, setSupportInfo] = useState(
        initialState?.supportInfo ?? { name: '', email: '', phone: '', interestArea: '', timePreference: '' }
    );
    // true after a successful full lead submission — triggers the "reuse submitted data?" prompt
    const [supportSubmitted, setSupportSubmitted] = useState(initialState?.supportSubmitted ?? false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const emailNudgeTimer = useRef(null);

    /** Start the support flow from the beginning. */
    const startSupportFlow = useCallback(() => {
        // If they already have partial info in state
        const hasExistingData = !!(
            supportInfo?.name?.trim() ||
            supportInfo?.email?.trim() ||
            supportInfo?.phone?.trim() ||
            supportInfo?.interestArea?.trim() ||
            supportInfo?.timePreference?.trim()
        );

        if (hasExistingData) {
            const summary = [
                supportInfo.name     && `**Name:** ${supportInfo.name}`,
                supportInfo.email    && `**Email:** ${supportInfo.email}`,
                supportInfo.phone    && `**Phone:** ${supportInfo.phone}`,
                supportInfo.interestArea    && `**Interest:** ${supportInfo.interestArea}`,
                supportInfo.timePreference  && `**Time:** ${supportInfo.timePreference}`,
            ].filter(Boolean).join('\n');

            if (supportSubmitted) {
                // User already completed the flow — ask if they want to reuse submitted data
                setSupportStep(SUPPORT_STEPS.SUBMITTED_CONFIRM);
                delayedAppend([{
                    role: 'bot',
                    content: `We already have information from a previously submitted lead:\n${summary}\n\nWould you like to submit again with the same details?`,
                    options: [
                        { label: 'Yes', value: 'submitted_yes' },
                        { label: 'No', value: 'submitted_no' }
                    ],
                    timestamp: new Date().toISOString(),
                }]);
            } else {
                // Partial data — ask if they want to continue from where they left off
                setSupportStep(SUPPORT_STEPS.RESUME_CONFIRM);
                delayedAppend([{
                    role: 'bot',
                    content: `We already have an existing record for this chat:\n${summary}\n\nWould you like to continue from where you left off?`,
                    options: [
                        { label: 'Yes', value: 'resume_yes' },
                        { label: 'No', value: 'resume_no' }
                    ],
                    timestamp: new Date().toISOString(),
                }]);
            }
            setRetryCount(0);
            return;
        }

        const isLoggedIn = user?.email && (user?.first_name || user?.name);

        if (isLoggedIn) {
            const userName = user?.first_name
                ? `${user.first_name} ${user.last_name || ''}`.trim()
                : user?.name;

            setSupportStep(SUPPORT_STEPS.PHONE);
            setSupportInfo({ name: userName, email: user.email, phone: '', interestArea: '', timePreference: '' });

            delayedAppend([{
                role: 'bot',
                content: `Hi ${userName}! 👋 Great to see you again! What's the best phone number to reach you?`,
                timestamp: new Date().toISOString(),
            }]);
        } else {
            setSupportStep(SUPPORT_STEPS.NAME);
            setSupportInfo({ name: '', email: '', phone: '', interestArea: '', timePreference: '' });

            delayedAppend([{
                role: 'bot',
                content: "I'd be happy to connect you with our team. May I please have your full name first?",
                timestamp: new Date().toISOString(),
            }]);
        }
        setRetryCount(0);
    }, [user, delayedAppend, supportInfo, supportSubmitted, setSupportStep, setSupportInfo, setRetryCount]);

    /** Exit the support flow and return to general chat. */
    const exitSupportFlow = useCallback(async (userInput = null) => {
        setSupportStep(null);

        if (_shouldSubmitPartialLead(supportInfo)) {
            // At least email or phone collected — submit as partial lead
            // NOTE: do NOT clear supportInfo here — keep it persisted so the
            // resume prompt works if the user re-enters the support flow.
            delayedAppend([
                { role: 'user', content: userInput || 'Exit flow', timestamp: new Date().toISOString() },
                { role: 'bot', content: "Looks like you want something else. Ask me anything!", timestamp: new Date().toISOString() },
            ]);
            // Submit quietly in the background without awaiting to avoid blocking UI
            _submitLead(_buildPartialInfo(supportInfo), true).catch(e => console.error("Partial lead submission failed", e));
        } else {
            // Not enough data — just exit cleanly (preserve partial data for resume later)
            delayedAppend([
                { role: 'user', content: userInput || 'Exit flow', timestamp: new Date().toISOString() },
                { role: 'bot', content: 'Looks like you want something else. Ask me anything!', timestamp: new Date().toISOString() },
            ]);
        }
    }, [supportInfo, delayedAppend, setMessages, setIsBotTyping]);

    /** Handle a user input during the support flow. */
    const handleSupportInput = useCallback(async (rawInput) => {
        const input = (rawInput || '').trim();

        if (!supportStep) return;

        // ── SUBMITTED CONFIRM — re-entry after a completed lead ──────────────
        if (supportStep === SUPPORT_STEPS.SUBMITTED_CONFIRM) {
            if (input === 'submitted_yes') {
                // Re-submit with the same previously submitted data
                setSupportStep(null);
                setMessages(prev => [...prev,
                    { role: 'user', content: 'Yes', timestamp: new Date().toISOString() },
                    { role: 'bot', content: 'Sure! Let me re-submit that for you.', timestamp: new Date().toISOString() },
                ]);
                setIsBotTyping(true);
                setMessages(prev => [...prev,
                    { role: 'bot', content: '', hasReceivedContent: false, timestamp: new Date().toISOString() },
                ]);
                await _submitLead(supportInfo);
            } else if (input === 'submitted_no') {
                // Wipe everything and start a fresh collection
                const empty = { name: '', email: '', phone: '', interestArea: '', timePreference: '' };
                setSupportInfo(empty);
                setSupportSubmitted(false);
                patchState(storageKey, { supportInfo: empty, supportSubmitted: false });
                setSupportStep(SUPPORT_STEPS.NAME);
                delayedAppend([
                    { role: 'user', content: 'No', timestamp: new Date().toISOString() },
                    { role: 'bot', content: "No worries! Let's start fresh. May I please have your full name?", timestamp: new Date().toISOString() }
                ]);
            }
            return;
        }

        // ── RESUME CONFIRM — re-entry with partial data ──────────────────────
        if (supportStep === SUPPORT_STEPS.RESUME_CONFIRM) {
            if (input === 'resume_yes') {
                const nextStep = _getNextUnfilledStep(supportInfo);
                if (nextStep) {
                    setSupportStep(nextStep);
                    delayedAppend([
                        { role: 'user', content: 'Yes', timestamp: new Date().toISOString() },
                        { role: 'bot', content: _getPromptForStep(nextStep, supportInfo), timestamp: new Date().toISOString() }
                    ]);
                } else {
                    // Everything is already filled! Just submit it.
                    setSupportStep(null);
                    setMessages(prev => [...prev,
                        { role: 'user', content: 'Yes', timestamp: new Date().toISOString() },
                        { role: 'bot', content: "Great! Let me submit that for you.", timestamp: new Date().toISOString() },
                    ]);
                    setIsBotTyping(true);
                    setMessages(prev => [...prev,
                        { role: 'bot', content: '', hasReceivedContent: false, timestamp: new Date().toISOString() },
                    ]);
                    await _submitLead(supportInfo);
                }
            } else if (input === 'resume_no') {
                setSupportInfo({ name: '', email: '', phone: '', interestArea: '', timePreference: '' });
                patchState(storageKey, { supportInfo: { name: '', email: '', phone: '', interestArea: '', timePreference: '' }});
                setSupportStep(SUPPORT_STEPS.NAME);
                delayedAppend([
                    { role: 'user', content: 'No', timestamp: new Date().toISOString() },
                    { role: 'bot', content: "No worries! Let's start fresh. May I please have your full name?", timestamp: new Date().toISOString() }
                ]);
            }
            return;
        }

        // ── NAME ─────────────────────────────────────────────────────────────
        if (supportStep === SUPPORT_STEPS.NAME) {
            const result = validateName(input);
            if (!result.valid) {
                if (retryCount >= 1) { exitSupportFlow(input); setRetryCount(0); return; }
                setRetryCount(c => c + 1);
                delayedAppend([
                    { role: 'user', content: input, timestamp: new Date().toISOString() },
                    { role: 'bot', content: result.error, timestamp: new Date().toISOString() },
                ]);
                return;
            }
            setRetryCount(0);
            setSupportInfo(p => {
                const next = { ...p, name: result.value };
                patchState(storageKey, { supportInfo: next });
                return next;
            });
            delayedAppend([
                { role: 'user', content: result.value, timestamp: new Date().toISOString() },
                { role: 'bot', content: `Thanks, **${result.value}**! I'm connecting u to our team. Could you share your **email** so I can help u connect with our team?`, timestamp: new Date().toISOString() },
            ]);
            setSupportStep(SUPPORT_STEPS.EMAIL);

            // Nudge after 10s if user hasn't responded
            if (emailNudgeTimer.current) clearTimeout(emailNudgeTimer.current);
            emailNudgeTimer.current = setTimeout(() => {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    content: "Don't worry, we never use emails for promotional purpose. 🙂",
                    timestamp: new Date().toISOString(),
                }]);
                emailNudgeTimer.current = null;
            }, 10000);
            return;
        }

        // ── EMAIL ────────────────────────────────────────────────────────────
        if (supportStep === SUPPORT_STEPS.EMAIL) {
            if (emailNudgeTimer.current) { clearTimeout(emailNudgeTimer.current); emailNudgeTimer.current = null; }
            const result = validateEmail(input);
            if (!result.valid) {
                if (retryCount >= 1) { exitSupportFlow(input); setRetryCount(0); return; }
                setRetryCount(c => c + 1);
                delayedAppend([
                    { role: 'user', content: input, timestamp: new Date().toISOString() },
                    { role: 'bot', content: result.error, timestamp: new Date().toISOString() },
                ]);
                return;
            }
            setRetryCount(0);
            setSupportInfo(p => {
                const next = { ...p, email: result.value };
                patchState(storageKey, { supportInfo: next });
                return next;
            });
            delayedAppend([
                { role: 'user', content: result.value, timestamp: new Date().toISOString() },
                { role: 'bot', content: "Almost there! To make sure our team can reach you quickly and personally, could you drop your **phone number**? It really helps us serve you better!", timestamp: new Date().toISOString() },
            ]);
            setSupportStep(SUPPORT_STEPS.PHONE);
            return;
        }

        // ── PHONE ────────────────────────────────────────────────────────────
        if (supportStep === SUPPORT_STEPS.PHONE) {
            const result = validatePhone(input);
            if (!result.valid) {
                if (retryCount >= 1) { exitSupportFlow(input); setRetryCount(0); return; }
                setRetryCount(c => c + 1);
                delayedAppend([
                    { role: 'user', content: input, timestamp: new Date().toISOString() },
                    { role: 'bot', content: result.error, timestamp: new Date().toISOString() },
                ]);
                return;
            }
            setRetryCount(0);
            setSupportInfo(p => {
                const next = { ...p, phone: result.value };
                patchState(storageKey, { supportInfo: next });
                return next;
            });
            delayedAppend([
                { role: 'user', content: input, timestamp: new Date().toISOString() },
                { role: 'bot', content: "Almost done! What area are you most interested in? *(e.g. Pricing, Features, Demo, Integration...)*", timestamp: new Date().toISOString() },
            ]);
            setSupportStep(SUPPORT_STEPS.INTEREST_AREA);
            return;
        }

        // ── INTEREST AREA ────────────────────────────────────────────────────
        if (supportStep === SUPPORT_STEPS.INTEREST_AREA) {
            if (!input) return; // silently ignore blank input
            setSupportInfo(p => {
                const next = { ...p, interestArea: input };
                patchState(storageKey, { supportInfo: next });
                return next;
            });
            delayedAppend([
                { role: 'user', content: input, timestamp: new Date().toISOString() },
                { role: 'bot', content: "Great choice! What time works best for a callback? *(e.g. 2-3 PM, 4-5 PM, etc.)*", timestamp: new Date().toISOString() },
            ]);
            setSupportStep(SUPPORT_STEPS.TIME_PREFERENCE);
            return;
        }

        // ── TIME PREFERENCE ──────────────────────────────────────────────────
        if (supportStep === SUPPORT_STEPS.TIME_PREFERENCE) {
            if (!input) return; // silently ignore blank input

            const timeValue = input;
            setSupportInfo(p => {
                const next = { ...p, timePreference: timeValue };
                patchState(storageKey, { supportInfo: next });
                return next;
            });

            // Show user message + typing placeholder
            setMessages(prev => [...prev,
            { role: 'user', content: input, timestamp: new Date().toISOString() },
            ]);
            setIsBotTyping(true);
            setMessages(prev => [...prev,
            { role: 'bot', content: '', hasReceivedContent: false, timestamp: new Date().toISOString() },
            ]);

            // Build the final info object synchronously
            const nextInfo = { ...supportInfo, timePreference: timeValue };
            await _submitLead(nextInfo);
            setSupportStep(null);
        }
    }, [supportStep, supportInfo, supportSubmitted, retryCount, domain, user, hubspotTracking, storageKey, delayedAppend, exitSupportFlow, setMessages, setIsBotTyping, setSupportSubmitted]);

    function _shouldSubmitPartialLead(info) {
        return !!(info?.email?.trim() || info?.phone?.trim());
    }

    function _buildPartialInfo(info) {
        return {
            name: info?.name?.trim() || 'N/A',
            email: info?.email?.trim() || 'N/A',
            phone: info?.phone?.trim() || 'N/A',
            interestArea: info?.interestArea?.trim() || 'N/A',
            timePreference: info?.timePreference?.trim() || 'N/A',
        };
    }

    function _getNextUnfilledStep(info) {
        if (!info?.name?.trim() || info.name === 'N/A') return SUPPORT_STEPS.NAME;
        if (!info?.email?.trim() || info.email === 'N/A') return SUPPORT_STEPS.EMAIL;
        if (!info?.phone?.trim() || info.phone === 'N/A') return SUPPORT_STEPS.PHONE;
        if (!info?.interestArea?.trim() || info.interestArea === 'N/A') return SUPPORT_STEPS.INTEREST_AREA;
        if (!info?.timePreference?.trim() || info.timePreference === 'N/A') return SUPPORT_STEPS.TIME_PREFERENCE;
        return null;
    }

    function _getPromptForStep(step, info) {
        switch (step) {
            case SUPPORT_STEPS.NAME:
                return "I'd be happy to connect you with our team. May I please have your full name first?";
            case SUPPORT_STEPS.EMAIL:
                return `Thanks, **${info?.name || 'there'}**! I'm connecting u to our team. Could you share your **email** so I can help u connect with our team?`;
            case SUPPORT_STEPS.PHONE:
                return "Almost there! To make sure our team can reach you quickly and personally, could you drop your **phone number**? It really helps us serve you better!";
            case SUPPORT_STEPS.INTEREST_AREA:
                return "Almost done! What area are you most interested in? *(e.g. Pricing, Features, Demo, Integration...)*";
            case SUPPORT_STEPS.TIME_PREFERENCE:
                return "Great choice! What time works best for a callback? *(e.g. 2-3 PM, 4-5 PM, etc.)*";
            default:
                return "How can I help you today?";
        }
    }

    /** Internal lead submission — fetches fresh tracking data right before posting. */
    async function _submitLead(info, isPartial = false) {
        if (!isPartial) setIsSubmitting(true);
        try {
            const name = info?.name?.trim() !== 'N/A' && info?.name?.trim() ? info.name.trim() :
                (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.name) ||
                localStorage.getItem('user_name') || 'Guest';
            const email = info?.email?.trim() || user?.email || localStorage.getItem('user_email') || 'N/A';
            const phone = info?.phone?.trim() || 'N/A';
            const interestArea = info?.interestArea?.trim() || 'N/A';
            const timePreference = info?.timePreference?.trim() || 'N/A';

            const sessionId = localStorage.getItem('chatbot_session_id') || crypto.randomUUID();

            // ── Fetch fresh tracking data right at submission time ──────────
            let freshTracking = null;
            if (typeof requestFreshTracking === 'function') {
                freshTracking = await requestFreshTracking();
            }
            const trackingToUse = freshTracking ?? hubspotTracking;
            // ────────────────────────────────────────────────────────────────

            const result = await submitLead({
                sessionId, name, email, phone,
                interestArea, timePreference,
                hubspotTracking: trackingToUse, domain, mail
            });

            if (isPartial) {
                // For partial leads, UI is completely separated. Return silently.
                return result;
            }

            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'bot',
                    content: result.thank_you_message || `Thank you, ${name}! We've received your information and will be in touch soon.`,
                    hasReceivedContent: true,
                    timestamp: new Date().toISOString(),
                };
                return updated;
            });
            setIsBotTyping(false);
            // Keep supportInfo persisted — mark as submitted so next re-entry
            // shows the "reuse submitted data?" prompt instead of starting fresh.
            setSupportSubmitted(true);
            patchState(storageKey, { supportSubmitted: true });
        } catch (error) {
            if (isPartial) return; // Silent fail for background partial leads

            const msg = error.isRateLimit
                ? `⚠️ ${error.detail || 'Rate limit exceeded. Please try again later.'}`
                : `❌ ${error.message || 'Failed to submit. Please try again.'}`;

            setMessages(prev => [...prev, {
                role: 'bot', content: msg, isError: true, timestamp: new Date().toISOString(),
            }]);
            setIsBotTyping(false);
        } finally {
            if (!isPartial) setIsSubmitting(false);
        }
    }

    return {
        supportStep,
        setSupportStep,
        supportInfo,
        supportSubmitted,
        isSubmitting,
        startSupportFlow,
        exitSupportFlow,
        handleSupportInput,
    };
}
