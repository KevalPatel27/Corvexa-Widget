'use client';

import { useState, useCallback, useRef } from 'react';
import { FLOW_BOT_DELAY_MS, SUPPORT_STEPS } from '../constants/chatbot';
import { validateName, validateEmail, validatePhone } from '../../../lib/validation';
import { submitLead } from '../services/chatApi';
import { patchState } from '../../../lib/storage';

/**
 * Manages the support lead-collection flow state machine.
 * Handles name → email → phone validation and lead submission.
 *
 * @param {{ domain: string, user: object, hubspotTracking: object, mail: object, storageKey: string, setMessages: Function, setIsBotTyping: Function, delayedAppend: Function }} options
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
}) {
    const [supportStep, setSupportStep] = useState(initialState?.supportStep ?? null);
    const [supportInfo, setSupportInfo] = useState(initialState?.supportInfo ?? { name: '', email: '', phone: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const emailNudgeTimer = useRef(null);

    /** Start the support flow from the beginning. */
    const startSupportFlow = useCallback(() => {
        const isLoggedIn = user?.email && (user?.first_name || user?.name);

        if (isLoggedIn) {
            const userName = user?.first_name
                ? `${user.first_name} ${user.last_name || ''}`.trim()
                : user?.name;

            setSupportStep(SUPPORT_STEPS.PHONE);
            setSupportInfo({ name: userName, email: user.email, phone: '' });

            delayedAppend([{
                role: 'bot',
                content: `Hi ${userName}! 👋 Great to see you again! What's the best phone number to reach you?`,
                timestamp: new Date().toISOString(),
            }]);
        } else {
            setSupportStep(SUPPORT_STEPS.NAME);
            setSupportInfo({ name: '', email: '', phone: '' });

            delayedAppend([{
                role: 'bot',
                content: "I'd be happy to connect you with our team. May I please have your full name first?",
                timestamp: new Date().toISOString(),
            }]);
        }
        setRetryCount(0);
    }, [user, delayedAppend]);

    /** Exit the support flow and return to general chat. */
    const exitSupportFlow = useCallback((userInput = null) => {
        setSupportStep(null);
        setSupportInfo({ name: '', email: '', phone: '' });
        delayedAppend([
            { role: 'user', content: userInput || 'Exit flow', timestamp: new Date().toISOString() },
            { role: 'bot', content: 'Looks like you want something else. Ask me anything!', timestamp: new Date().toISOString() },
        ]);
    }, [delayedAppend]);

    /** Handle a user input during the support flow. */
    const handleSupportInput = useCallback(async (rawInput) => {
        const input = (rawInput || '').trim();

        if (!supportStep) return;

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

            // Nudge after 10s if user hasn't responded yet — injected directly like idle tour prompt
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

        if (supportStep === SUPPORT_STEPS.EMAIL) {
            // Cancel the nudge timer — user has responded
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

            const phoneValue = result.value;
            setRetryCount(0);
            setSupportInfo(p => {
                const next = { ...p, phone: phoneValue };
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

            // Submit lead
            const nextInfo = { ...supportInfo, phone: phoneValue };
            await _submitLead(nextInfo);
            setSupportStep(null);
        }
    }, [supportStep, supportInfo, retryCount, domain, user, hubspotTracking, storageKey, delayedAppend, exitSupportFlow, setMessages, setIsBotTyping]);

    /** Internal lead submission — updates messages on success/failure. */
    async function _submitLead(info) {
        setIsSubmitting(true);
        try {
            const name = info?.name?.trim() ||
                (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.name) ||
                localStorage.getItem('user_name') || 'Guest';
            const email = info?.email?.trim() || user?.email || localStorage.getItem('user_email') || '';
            const phone = info?.phone?.trim() || '';

            if (!email) {
                setMessages(prev => [...prev, {
                    role: 'bot', content: '❌ Email is required to submit your information.',
                    isError: true, timestamp: new Date().toISOString(),
                }]);
                setIsBotTyping(false);
                return;
            }

            const sessionId = localStorage.getItem('chatbot_session_id') || crypto.randomUUID();

            const result = await submitLead({ sessionId, name, email, phone, hubspotTracking, domain });

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
        } catch (error) {
            const msg = error.isRateLimit
                ? `⚠️ ${error.detail || 'Rate limit exceeded. Please try again later.'}`
                : `❌ ${error.message || 'Failed to submit. Please try again.'}`;

            setMessages(prev => [...prev, {
                role: 'bot', content: msg, isError: true, timestamp: new Date().toISOString(),
            }]);
            setIsBotTyping(false);
        } finally {
            setIsSubmitting(false);
        }
    }

    return {
        supportStep,
        setSupportStep,
        supportInfo,
        isSubmitting,
        startSupportFlow,
        exitSupportFlow,
        handleSupportInput,
    };
}
