'use client';

import { useCallback } from 'react';
import { FLOW_BOT_DELAY_MS } from '../constants/chatbot';
import { detectIntent } from '../services/chatApi';

/**
 * Handles all option-click routing logic.
 * Centralizes: connect_support, no_thanks, tour prompts, cross-question intent, fallback support.
 *
 * @param {{ domain: string, setMessages: Function, setIsBotTyping: Function, setIntChat: Function, setHasUserInteracted: Function, startSupportFlow: Function, requireIntentCheck: boolean, lastCrossQuestionContext: string, setRequireIntentCheck: Function, setLastCrossQuestionContext: Function, delayedAppend: Function, handleSend: Function }} options
 */
export function useChatActions({
    domain,
    setMessages,
    setIsBotTyping,
    setIntChat,
    setHasUserInteracted,
    startSupportFlow,
    requireIntentCheck,
    lastCrossQuestionContext,
    setRequireIntentCheck,
    setLastCrossQuestionContext,
    delayedAppend,
    handleSend,
}) {
    const handleOptionClick = useCallback(async (value, message = null) => {
        if (value === 'connect_support' || value === 'Contact Support') {
            setMessages(prev => [...prev, {
                role: 'user', content: 'Connect Support', timestamp: new Date().toISOString(),
            }]);
            setIntChat(false);
            setHasUserInteracted(true);
            startSupportFlow();
            return;
        }

        if (value === 'no_thanks' || value === 'No') {
            delayedAppend([
                { role: 'user', content: 'No, thanks', timestamp: new Date().toISOString() },
                { role: 'bot', content: "Thank you for chatting with us today.\n\nYou’ve reached the daily message limit.\n\nPlease come back tomorrow or connect with support if you need immediate assistance.", timestamp: new Date().toISOString() },
            ]);
            return;
        }

        if (String(value).endsWith('_yes')) {
            const flowType = String(value).replace('_yes', '');
            if (flowType === 'support') {
                setMessages(prev => [...prev, {
                    role: 'user', content: 'Yes', timestamp: new Date().toISOString(),
                }]);
                setIntChat(false);
                setHasUserInteracted(true);
                startSupportFlow();
                return;
            }
        }

        if (value === 'randomquestionset_no') {
            setMessages(prev => [...prev,
            { role: 'user', content: 'No', timestamp: new Date().toISOString() },
            { role: 'bot', content: "Thank you for chatting with us today.\n\nYou’ve reached the daily message limit.\n\nPlease come back tomorrow or connect with support if you need immediate assistance.", timestamp: new Date().toISOString() },
            ]);
            return;
        }

        if (value === 'fallbacksupportno') {
            delayedAppend([
                { role: 'user', content: 'No', timestamp: new Date().toISOString() },
                { role: 'bot', content: 'No problem! Is there anything else I can help you with?', timestamp: new Date().toISOString() },
            ]);
            return;
        }

        // Tour prompt options — send as a regular message
        if (message?.isTourPrompt) {
            await handleSend(value);
            return;
        }

        // Support prompt "Yes"
        if (message?.isSupportPrompt && String(value).toLowerCase() === 'yes') {
            setMessages(prev => [...prev, {
                role: 'user', content: 'Yes', timestamp: new Date().toISOString(),
            }]);
            startSupportFlow();
            return;
        }

        // Default: send as a regular message
        await handleSend(value);
    }, [domain, setMessages, setIsBotTyping, setIntChat, setHasUserInteracted, startSupportFlow, delayedAppend, handleSend]);

    /**
     * Handle intent detection before sending a message.
     * Returns true if intent was affirmative (support flow started), false to continue normally.
     */
    const checkIntentAndRoute = useCallback(async (originalInput) => {
        if (!requireIntentCheck || !lastCrossQuestionContext) return false;

        setIsBotTyping(true);
        setMessages(prev => [...prev, {
            role: 'bot', content: '', hasReceivedContent: false, timestamp: new Date().toISOString(),
        }]);

        const intentResult = await detectIntent({
            message: originalInput,
            context: lastCrossQuestionContext,
            domain,
        });

        setRequireIntentCheck(false);
        setLastCrossQuestionContext('');
        setMessages(prev => prev.slice(0, -1));
        setIsBotTyping(false);

        if (intentResult.intent === 'affirmative') {
            setIntChat(false);
            setHasUserInteracted(true);
            startSupportFlow();
            return true;
        }

        return false;
    }, [requireIntentCheck, lastCrossQuestionContext, domain, setMessages, setIsBotTyping, setRequireIntentCheck, setLastCrossQuestionContext, setIntChat, setHasUserInteracted, startSupportFlow]);

    return { handleOptionClick, checkIntentAndRoute };
}
