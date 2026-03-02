'use client';

import { useState, useCallback } from 'react';
import { FLOW_BOT_DELAY_MS } from '../constants/chatbot';

/**
 * Manages the bot message queue with typing animation.
 * Provides `delayedAppend` — appends user messages immediately,
 * then shows a typing placeholder before each bot message.
 *
 * @param {{ setMessages: Function, setIsBotTyping: Function }} options
 */
export function useMessageQueue({ setMessages, setIsBotTyping }) {
    /**
     * Append an array of messages with typing animation for bot messages.
     * User messages are appended immediately.
     * @param {Array<{ role: string, content: string, timestamp: string, [key: string]: any }>} arr
     */
    const delayedAppend = useCallback((arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return;

        const userMsgs = arr.filter(m => m.role === 'user');
        const botMsgs = arr.filter(m => m.role === 'bot');

        // Append user messages immediately
        if (userMsgs.length) {
            setMessages(prev => [...prev, ...userMsgs]);
        }
        if (!botMsgs.length) return;

        setIsBotTyping(true);

        const appendNextBot = (index) => {
            if (index >= botMsgs.length) {
                setIsBotTyping(false);
                return;
            }

            // Show typing placeholder
            setMessages(prev => [...prev, {
                role: 'bot',
                content: '',
                timestamp: botMsgs[index].timestamp || new Date().toISOString(),
                hasReceivedContent: false,
            }]);

            setTimeout(() => {
                setMessages(prev => {
                    const hasPlaceholder =
                        prev.length > 0 &&
                        prev[prev.length - 1].role === 'bot' &&
                        (prev[prev.length - 1].content || '') === '' &&
                        prev[prev.length - 1].hasReceivedContent === false;
                    const base = hasPlaceholder ? prev.slice(0, -1) : prev;
                    return [...base, botMsgs[index]];
                });

                if (index < botMsgs.length - 1) {
                    appendNextBot(index + 1);
                } else {
                    setIsBotTyping(false);
                }
            }, FLOW_BOT_DELAY_MS);
        };

        appendNextBot(0);
    }, [setMessages, setIsBotTyping]);

    return { delayedAppend };
}
