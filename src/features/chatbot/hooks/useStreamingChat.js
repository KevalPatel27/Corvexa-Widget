'use client';

import { useState, useRef, useCallback } from 'react';
import { SSE_EVENTS } from '../constants/chatbot';
import { streamChat } from '../services/chatApi';

/**
 * Manages SSE streaming chat state.
 * Handles the full streaming lifecycle: request → token events → answer → done.
 *
 * @param {{ domain: string, frontendDomain: string, user: object, setMessages: Function, setIsBotTyping: Function, setIsLoading: Function, startSupportFlow: Function }} options
 */
export function useStreamingChat({
    domain,
    frontendDomain,
    user,
    setMessages,
    setIsBotTyping,
    setIsLoading,
    startSupportFlow,
    delayedAppend,
}) {
    const [streamingState, setStreamingState] = useState({
        isStreaming: false,
        hasReceivedContent: false,
        currentStreamingMessageIndex: null,
        abortController: null,
    });
    const [isRequestActive, setIsRequestActive] = useState(false);
    const [requireIntentCheck, setRequireIntentCheck] = useState(false);
    const [lastCrossQuestionContext, setLastCrossQuestionContext] = useState('');

    const backgroundStreamingRef = useRef({
        isActive: false,
        currentMessageIndex: null,
        fullResponse: '',
        domain: null,
        prompt: null,
        reader: null,
        decoder: null,
    });

    /** Continue reading an existing SSE reader in the background (after chat is closed). */
    const startBackgroundStreaming = useCallback(async (reader, decoder, currentMessageIndex) => {
        try {
            let done = false;
            let fullText = backgroundStreamingRef.current.fullResponse || '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    fullText += decoder.decode(value);
                    backgroundStreamingRef.current.fullResponse = fullText;
                    backgroundStreamingRef.current.hasReceivedContent = true;
                }
            }
            backgroundStreamingRef.current.isActive = false;
        } catch {
            backgroundStreamingRef.current.isActive = false;
        }
    }, []);

    /**
     * Send a message and stream the response.
     * @param {string} messageContent - The user's message (already lowercased)
     * @param {string} originalInput - The original casing for display
     * @param {string} sessionId
     */
    const sendStreamingMessage = useCallback(async (messageContent, originalInput, sessionId) => {
        const currentMessageIndex = -1; // Will be set after messages update

        setIsLoading(true);
        setIsRequestActive(true);

        const abortController = new AbortController();
        setStreamingState({
            isStreaming: true,
            hasReceivedContent: false,
            currentStreamingMessageIndex: null,
            abortController,
        });

        backgroundStreamingRef.current = {
            isActive: true,
            currentMessageIndex: null,
            fullResponse: '',
            domain,
            prompt: messageContent,
            reader: null,
            decoder: null,
        };
        let crossQuestion = '';
        let triggeredFlow = false;

        try {
            const response = await streamChat({
                prompt: messageContent,
                role: user?.role || 'all',
                domain,
                frontendDomain,
                sessionId,
            });

            // Handle rate limit specially (show options)
            if (response.status === 429) {
                // Replace the bot placeholder with the error message
                setMessages(prev => [...prev.slice(0, -1), {
                    role: 'bot',
                    content: "That's all the messages for today. How would you like to continue?",
                    options: [
                        { label: 'Connect Support', value: 'connect_support' },
                        { label: 'No, thanks', value: 'no_thanks' },
                    ],
                    isError: true,
                    showNotHelpful: true,
                    timestamp: new Date().toISOString(),
                }]);
                setIsBotTyping(false);
                setIsLoading(false);
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Replace the bot placeholder with the error message
                setMessages(prev => [...prev.slice(0, -1), {
                    role: 'bot',
                    content: `${errorData.detail || 'An error occurred. Please try again.'}`,
                    isError: true,
                    showNotHelpful: true,
                    timestamp: new Date().toISOString(),
                }]);
                setIsBotTyping(false);
                setIsLoading(false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let buffer = '';
            let streamingText = '';
            let finalAnswer = '';

            // Note: bot placeholder was already added in handleSend before the fetch
            backgroundStreamingRef.current.reader = reader;
            backgroundStreamingRef.current.decoder = decoder;

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const events = buffer.split('\n\n');
                    buffer = events.pop() || '';

                    for (const event of events) {
                        if (!event.trim()) continue;

                        const lines = event.split('\n');
                        let eventType = null;
                        let data = null;

                        for (const line of lines) {
                            if (line.startsWith('event:')) eventType = line.substring(6).trim();
                            else if (line.startsWith('data:')) data = line.substring(5).trim();
                        }

                        if (!eventType || data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            switch (eventType) {
                                case SSE_EVENTS.TOKEN:
                                    streamingText += parsed.content || '';
                                    backgroundStreamingRef.current.fullResponse = streamingText;
                                    backgroundStreamingRef.current.hasReceivedContent = true;
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        if (updated[updated.length - 1]?.role === 'bot') {
                                            updated[updated.length - 1] = {
                                                ...updated[updated.length - 1],
                                                content: streamingText,
                                                hasReceivedContent: true,
                                            };
                                        }
                                        return updated;
                                    });
                                    break;

                                case SSE_EVENTS.ANSWER:
                                    finalAnswer = parsed.content || '';
                                    backgroundStreamingRef.current.fullResponse = finalAnswer;
                                    backgroundStreamingRef.current.hasReceivedContent = true;
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        if (updated[updated.length - 1]?.role === 'bot') {
                                            updated[updated.length - 1] = {
                                                role: 'bot',
                                                content: finalAnswer,
                                                hasReceivedContent: true,
                                                showNotHelpful: true,
                                                timestamp: new Date().toISOString(),
                                            };
                                        }
                                        return updated;
                                    });
                                    break;

                                case SSE_EVENTS.CROSS_QUESTION:
                                    crossQuestion = parsed.content || '';
                                    // Don't append here — wait until streaming is done
                                    // to avoid overwriting the placeholder with ANSWER event.
                                    break;

                                case SSE_EVENTS.REQUIRE_INTENT_CHECK:
                                    if (parsed.trigger_type === 'sales_question') {
                                        triggeredFlow = true;
                                        done = true; // stop reading the stream
                                    } else {
                                        setRequireIntentCheck(true);
                                        setLastCrossQuestionContext(parsed.context || crossQuestion);
                                    }
                                    break;

                                case SSE_EVENTS.TRIGGER_LEAD:
                                    startSupportFlow();
                                    break;

                                case SSE_EVENTS.ERROR:
                                    finalAnswer = parsed.message || parsed.content || 'An error occurred. Please try again.';
                                    setMessages(prev => {
                                        const updated = [...prev];
                                        if (updated[updated.length - 1]?.role === 'bot') {
                                            updated[updated.length - 1] = {
                                                role: 'bot',
                                                content: `${finalAnswer}`,
                                                isError: true,
                                                showNotHelpful: true,
                                                timestamp: new Date().toISOString(),
                                            };
                                        }
                                        return updated;
                                    });
                                    break;

                                case SSE_EVENTS.DONE:
                                    done = true;
                                    break;
                            }
                        } catch {
                            // Ignore parse errors for individual SSE events
                        }
                    }
                }
            }

            // If the support flow was triggered, clean up the placeholder and launch the flow.
            // Skip all normal post-loop logic to avoid ghost error messages.
            if (triggeredFlow) {
                setMessages(prev => {
                    const updated = [...prev];
                    if (updated[updated.length - 1]?.role === 'bot' && !updated[updated.length - 1]?.content) {
                        return updated.slice(0, -1);
                    }
                    return updated;
                });
                // Don't setIsBotTyping(false) here — startSupportFlow/delayedAppend manages it
                startSupportFlow();
                return;
            }

            // Cross-question: show with typing animation AFTER streaming is done
            if (crossQuestion) {
                delayedAppend([{
                    role: 'bot',
                    content: crossQuestion,
                    isCrossQuestion: true,
                    crossQuestionContext: crossQuestion,
                    hasReceivedContent: true,
                    timestamp: new Date().toISOString(),
                }]);
            }

            // Fallback: if only streaming text and no final answer
            if (streamingText && !finalAnswer) {
                setMessages(prev => {
                    const updated = [...prev];
                    if (updated[updated.length - 1]?.role === 'bot') {
                        updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            content: streamingText,
                            hasReceivedContent: true,
                            showNotHelpful: true,
                        };
                    }
                    return updated;
                });
            }

            // Fallback: nothing received
            if (!streamingText && !finalAnswer) {
                setMessages(prev => {
                    const updated = [...prev];
                    if (updated[updated.length - 1]?.role === 'bot' && !updated[updated.length - 1].content) {
                        updated[updated.length - 1] = {
                            role: 'bot',
                            content: "❌ Couldn't fetch, connection was interrupted",
                            isError: true,
                            showNotHelpful: true,
                            timestamp: new Date().toISOString(),
                        };
                    }
                    return updated;
                });
            }

            // Only turn off typing if there's no cross-question —
            // delayedAppend manages its own isBotTyping lifecycle.
            if (!crossQuestion) setIsBotTyping(false);
            backgroundStreamingRef.current.isActive = false;
            backgroundStreamingRef.current.reader = null;
            backgroundStreamingRef.current.decoder = null;
        } catch (err) {
            const errorMessage = err.name === 'AbortError'
                ? 'Request timeout. Please try again.'
                : err.name === 'TypeError' && err.message.includes('fetch')
                    ? 'Network error. Please check your internet connection.'
                    : err.message || 'An unexpected error occurred.';

            setMessages(prev => [...prev.slice(0, -1), {
                role: 'bot',
                content: `${errorMessage}`,
                isError: true,
                showNotHelpful: true,
                timestamp: new Date().toISOString(),
            }]);

            backgroundStreamingRef.current.isActive = false;
            backgroundStreamingRef.current.reader = null;
            backgroundStreamingRef.current.decoder = null;
        } finally {
            // Don't kill typing if delayedAppend is managing it (cross-question or triggered flow)
            if (!crossQuestion && !triggeredFlow) setIsBotTyping(false);
            setIsLoading(false);
            setIsRequestActive(false);
            setStreamingState({
                isStreaming: false,
                hasReceivedContent: false,
                currentStreamingMessageIndex: null,
                abortController: null,
            });
        }
    }, [domain, frontendDomain, user, setMessages, setIsBotTyping, setIsLoading, startSupportFlow, delayedAppend]);

    return {
        streamingState,
        isRequestActive,
        setIsRequestActive,
        requireIntentCheck,
        setRequireIntentCheck,
        lastCrossQuestionContext,
        setLastCrossQuestionContext,
        backgroundStreamingRef,
        startBackgroundStreaming,
        sendStreamingMessage,
    };
}
