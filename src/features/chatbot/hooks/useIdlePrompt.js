'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { IDLE_TOUR_PROMPT_DELAY_MS, IDLE_CHECK_INTERVAL_MS } from '../constants/chatbot';
import { patchState } from '../../../lib/storage';

/**
 * Manages the idle tour prompt — shows a first-visit prompt after inactivity.
 *
 * @param {{ chatbotApiData: object, hasUserInteracted: boolean, isChatOpen: boolean, isLoading: boolean, isBotTyping: boolean, isRequestActive: boolean, messages: Array, storageKey: string, setMessages: Function }} options
 */
export function useIdlePrompt({
    chatbotApiData,
    hasUserInteracted,
    isChatOpen,
    isLoading,
    isBotTyping,
    isRequestActive,
    messages,
    storageKey,
    setMessages,
    initialIdlePromptEverShown = false,
}) {
    const [idlePromptShown, setIdlePromptShown] = useState(false);
    const [idlePromptEverShown, setIdlePromptEverShown] = useState(initialIdlePromptEverShown);
    const lastActivityRef = useRef(Date.now());
    const idleTimerRef = useRef(null);

    const markActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        setIdlePromptShown(false);
        setMessages(prev => prev.filter(m => !m.isTourPrompt));
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    }, [setMessages]);

    const showIdleTourPrompt = useCallback(() => {
        if (idlePromptShown || idlePromptEverShown || hasUserInteracted) return;

        const firstVisitData = chatbotApiData?.data?.first_visit;
        if (!firstVisitData) return;

        setIdlePromptShown(true);
        setIdlePromptEverShown(true);

        try {
            patchState(storageKey, { idlePromptEverShown: true });
        } catch { }

        const messageContent = firstVisitData.message || "While you're here, want a super-quick tour of our platforms?";
        const options = firstVisitData.buttons?.map(label => ({ label, value: label })) || [
            { label: 'Release Automation', value: 'Release Automation' },
            { label: 'Source Control', value: 'Source Control' },
            { label: 'Governance (Security & Compliance)', value: 'Governance (Security & Compliance)' },
        ];

        setMessages(prev => [...prev, {
            role: 'bot',
            content: messageContent,
            timestamp: new Date().toISOString(),
            options,
            isTourPrompt: true,
        }]);
    }, [idlePromptShown, idlePromptEverShown, hasUserInteracted, chatbotApiData, storageKey, setMessages]);

    // Idle timer — fires after inactivity when chat is open
    useEffect(() => {
        if (!isChatOpen || idlePromptEverShown || isLoading || isBotTyping || isRequestActive) return;

        const hasTypedMessage = messages.some(msg => msg.sender === 'user');
        if (hasTypedMessage) return;

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        idleTimerRef.current = setTimeout(() => {
            showIdleTourPrompt();
        }, IDLE_TOUR_PROMPT_DELAY_MS);

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        };
    }, [isChatOpen]);

    // Secondary idle check — fires after message activity settles
    useEffect(() => {
        if (isLoading || isBotTyping || isRequestActive) return;

        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            const elapsed = Date.now() - lastActivityRef.current;
            if (elapsed >= IDLE_CHECK_INTERVAL_MS) {
                showIdleTourPrompt();
            }
        }, IDLE_CHECK_INTERVAL_MS);

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
                idleTimerRef.current = null;
            }
        };
    }, [messages, isLoading, isBotTyping, isRequestActive]);

    return {
        idlePromptEverShown,
        markActivity,
        showIdleTourPrompt,
    };
}
