'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useChatStorage } from './useChatStorage';
import { FLOW_BOT_DELAY_MS } from '../constants/chatbot';
import { useMessageQueue } from './useMessageQueue';
import { useSupportFlow } from './useSupportFlow';
import { useStreamingChat } from './useStreamingChat';
import { useIdlePrompt } from './useIdlePrompt';
import { useChatActions } from './useChatActions';

/**
 * Master orchestrator hook for the chatbot.
 * Composes all sub-hooks and exposes a clean API to the ChatBot component.
 *
 * @param {{ chatbotApiData, onClose, domain, frontendDomain, hubspotTracking, qaData, qaLoading, qaError, logging, logo, headerIcon, user, colors, mail }} props
 */
export function useChatbot({
    chatbotApiData,
    onClose,
    domain,
    frontendDomain,
    hubspotTracking,
    requestFreshTracking,
    qaData,
    user,
    colors,
    mail,
}) {
    const { initialState, persistState } = useChatStorage(domain);

    // ── Core state ────────────────────────────────────────────────────────────
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState(initialState?.messages ?? []);
    const [IntChat, setIntChat] = useState(initialState?.IntChat ?? true);
    const [hasUserInteracted, setHasUserInteracted] = useState(initialState?.hasUserInteracted ?? false);
    const [dismissedSupportPromptIdx, setDismissedSupportPromptIdx] = useState(initialState?.dismissedSupportPromptIdx ?? []);
    const [supportPromptAnswered, setSupportPromptAnswered] = useState(initialState?.supportPromptAnswered ?? []);
    const [currentQaId, setCurrentQaId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [userScrolledUp, setUserScrolledUp] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [wasClosedDuringRequest, setWasClosedDuringRequest] = useState(false);
    const [showSupportPrompt, setShowSupportPrompt] = useState(false);
    const [supportPromptIdx, setSupportPromptIdx] = useState(null);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const messagesEndRef = useRef(null);
    const chatbotRef = useRef(null);
    const messagesContainerRef = useRef(null);

    // ── Sub-hooks ─────────────────────────────────────────────────────────────
    const { delayedAppend } = useMessageQueue({ setMessages, setIsBotTyping });

    const {
        supportStep, setSupportStep, supportInfo, isSubmitting,
        startSupportFlow, exitSupportFlow, handleSupportInput,
    } = useSupportFlow({
        domain, user, hubspotTracking, mail, storageKey: domain,
        setMessages, setIsBotTyping, delayedAppend,
        initialState, requestFreshTracking,
    });

    const {
        streamingState, isRequestActive, setIsRequestActive,
        requireIntentCheck, setRequireIntentCheck,
        lastCrossQuestionContext, setLastCrossQuestionContext,
        backgroundStreamingRef, startBackgroundStreaming, sendStreamingMessage,
    } = useStreamingChat({
        domain, frontendDomain, user,
        setMessages, setIsBotTyping, setIsLoading, startSupportFlow, delayedAppend,
    });

    const { idlePromptEverShown, markActivity } = useIdlePrompt({
        chatbotApiData, hasUserInteracted, isChatOpen,
        isLoading, isBotTyping, isRequestActive, messages, storageKey: domain, setMessages,
        initialIdlePromptEverShown: initialState?.idlePromptEverShown ?? false,
    });

    // ── Scroll ────────────────────────────────────────────────────────────────
    const scrollToBottom = useCallback((behavior = isBotTyping ? 'auto' : 'smooth') => {
        if (userScrolledUp && behavior !== 'smooth') return;
        messagesEndRef.current?.scrollIntoView({ block: 'end', behavior });
    }, [isBotTyping, userScrolledUp]);

    // ── Main send handler ─────────────────────────────────────────────────────
    const handleSend = useCallback(async (messageContent) => {
        if (!messageContent?.trim()) return;
        markActivity();

        const originalInput = messageContent;
        const lowerInput = messageContent.toLowerCase();

        // Session ID
        let sessionId = localStorage.getItem('chatbot_session_id');
        if (!sessionId) {
            sessionId = uuidv4();
            localStorage.setItem('chatbot_session_id', sessionId);
        }

        // Support flow takes priority
        if (supportStep) {
            setPrompt('');
            await handleSupportInput(originalInput.trim());
            return;
        }

        if (!hasUserInteracted) setHasUserInteracted(true);

        // Add user message
        setMessages(prev => [...prev, {
            role: 'user', content: originalInput, timestamp: new Date().toISOString(),
        }]);
        setPrompt('');

        // Intent check (if backend requested it)
        if (requireIntentCheck && lastCrossQuestionContext) {
            const routed = await checkIntentAndRoute(originalInput);
            if (routed) return;
        }

        // Normal streaming chat
        setIntChat(false);
        setIsLoading(true);
        setUserScrolledUp(false);

        // Bot placeholder is added inside sendStreamingMessage after the response arrives
        await sendStreamingMessage(lowerInput, originalInput, sessionId);
    }, [
        supportStep, hasUserInteracted, requireIntentCheck, lastCrossQuestionContext,
        handleSupportInput, sendStreamingMessage, markActivity, setMessages, setPrompt,
        setHasUserInteracted, setIntChat, setIsLoading, setUserScrolledUp, setIsBotTyping,
    ]);

    // ── Support prompt No handler ────────────────────────────────────────────
    const handleSupportPromptNo = useCallback((idx) => {
        setDismissedSupportPromptIdx(prev => [...prev, idx]);
        setSupportPromptAnswered(prev => [...prev, idx]);
        setIsBotTyping(true);
        setTimeout(() => {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: 'No', timestamp: new Date().toISOString() },
                { role: 'bot', content: 'No problem! Is there anything else I can help you with?', timestamp: new Date().toISOString() },
            ]);
            setIsBotTyping(false);
        }, FLOW_BOT_DELAY_MS);
    }, [setMessages, setIsBotTyping]);

    const { handleOptionClick, checkIntentAndRoute } = useChatActions({
        domain, setMessages, setIsBotTyping, setIntChat, setHasUserInteracted,
        startSupportFlow, setSupportStep, requireIntentCheck, lastCrossQuestionContext,
        setRequireIntentCheck, setLastCrossQuestionContext, delayedAppend, handleSend,
    });

    // ── QA option select ──────────────────────────────────────────────────────
    const handleQaOptionSelect = useCallback((option) => {
        if (!qaData) return;
        const nextItem = qaData.items.find(item => item.id === option.goto);
        setMessages(prev => [...prev,
        { role: 'user', content: option.label, timestamp: new Date().toISOString() },
        nextItem
            ? { role: 'bot', content: '', qaItem: nextItem, timestamp: new Date().toISOString() }
            : { role: 'bot', content: 'End of flow.', timestamp: new Date().toISOString() },
        ]);
        setCurrentQaId(nextItem ? nextItem.id : null);
    }, [qaData]);

    // ── Effects ───────────────────────────────────────────────────────────────

    // postMessage: open/close/focus/send-user-message
    useEffect(() => {
        const handleMessage = (event) => {
            const { type, message } = event.data || {};
            if (type === 'open-chatbot') setIsChatOpen(true);
            if (type === 'close-chatbot') setIsChatOpen(false);
            if (type === 'focus-input') {
                setTimeout(() => {
                    document.querySelector('.chatInputTextarea')?.focus();
                }, 100);
            }
            if (type === 'send-user-message' && message) {
                handleSend(message);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleSend]);

    // postMessage: close during active request → background streaming
    useEffect(() => {
        const handleParentMessage = (event) => {
            if (event.data?.type !== 'close-chatbot') return;
            if (isRequestActive) {
                setWasClosedDuringRequest(true);
                if (streamingState.isStreaming && backgroundStreamingRef.current.isActive &&
                    backgroundStreamingRef.current.reader && backgroundStreamingRef.current.decoder) {
                    const bg = backgroundStreamingRef.current;
                    startBackgroundStreaming(bg.reader, bg.decoder, bg.currentMessageIndex);
                }
            }
            onClose();
        };
        window.addEventListener('message', handleParentMessage);
        return () => window.removeEventListener('message', handleParentMessage);
    }, [onClose, isRequestActive, streamingState.isStreaming]);

    // Click outside → close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (chatbotRef.current && !chatbotRef.current.contains(event.target)) {
                if (isRequestActive) {
                    setWasClosedDuringRequest(true);
                    if (streamingState.isStreaming && backgroundStreamingRef.current.isActive &&
                        backgroundStreamingRef.current.reader && backgroundStreamingRef.current.decoder) {
                        const bg = backgroundStreamingRef.current;
                        startBackgroundStreaming(bg.reader, bg.decoder, bg.currentMessageIndex);
                    }
                }
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, isRequestActive, streamingState.isStreaming]);

    // Auto-focus input after bot finishes
    useEffect(() => {
        if (!isBotTyping && !isLoading) {
            setTimeout(() => {
                document.querySelector('.chatInputTextarea')?.focus();
            }, 100);
        }
    }, [isBotTyping, isLoading, messages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages, showSupportPrompt]);

    // CSS variables for theming
    useEffect(() => {
        if (colors) {
            Object.entries(colors).forEach(([key, value]) => {
                document.documentElement.style.setProperty(`--${key}`, value);
            });
        }
    }, [colors]);

    // Persist state to localStorage
    useEffect(() => {
        persistState({
            messages,
            IntChat,
            hasUserInteracted,
            dismissedSupportPromptIdx,
            supportStep,
            supportInfo,
            supportPromptAnswered,
            idlePromptEverShown,
        });
    }, [messages, IntChat, hasUserInteracted, dismissedSupportPromptIdx, supportStep, supportInfo, supportPromptAnswered, idlePromptEverShown]);

    // On chat start: show first QA item
    useEffect(() => {
        if (!IntChat && !hasUserInteracted && qaData?.items?.length > 0 && messages.length === 0) {
            const firstItem = qaData.items[0];
            setHasUserInteracted(true);
            setCurrentQaId(firstItem.id);
            setMessages([{ role: 'bot', content: '', qaItem: firstItem }]);
        }
    }, [IntChat, hasUserInteracted, qaData, messages.length]);

    // Fallback support prompt after "I couldn't find" message
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        if (
            lastMessage.role === 'bot' &&
            lastMessage.content?.includes("I couldn't found any contentssssss regarding this on the website.") &&
            !lastMessage.isFollowedUp
        ) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...lastMessage, isFollowedUp: true };
                return updated;
            });
            delayedAppend([{
                role: 'bot',
                content: "I'm sorry I couldn't help with that. Would you like to connect with support?",
                options: [
                    { label: 'Yes', value: 'Yes' },
                    { label: 'No', value: 'fallbacksupportno' },
                ],
                isSupportPrompt: true,
                timestamp: new Date().toISOString(),
            }]);
        }
    }, [messages]);

    // Notification when reopened after being closed during request
    useEffect(() => {
        if (wasClosedDuringRequest && !IntChat) {
            setMessages(prev => [...prev, {
                role: 'bot',
                content: 'Your previous request was interrupted when the chat was closed. Please try asking your question again.',
                isNotification: true,
                timestamp: new Date().toISOString(),
            }]);
            setWasClosedDuringRequest(false);
        }
    }, [wasClosedDuringRequest, IntChat]);

    return {
        // State
        prompt, setPrompt,
        messages, setMessages,
        IntChat, setIntChat,
        hasUserInteracted, setHasUserInteracted,
        isLoading, isBotTyping,
        isChatOpen, userScrolledUp, setUserScrolledUp,
        showSupportPrompt, supportPromptIdx, setSupportPromptIdx,
        dismissedSupportPromptIdx, setDismissedSupportPromptIdx,
        supportPromptAnswered, setSupportPromptAnswered,
        currentQaId,
        isSubmitting,
        supportStep,
        isRequestActive,
        wasClosedDuringRequest, setWasClosedDuringRequest,
        streamingState,
        backgroundStreamingRef,
        startBackgroundStreaming,
        // Refs
        messagesEndRef, chatbotRef, messagesContainerRef,
        // Handlers
        handleSend,
        handleOptionClick,
        handleQaOptionSelect,
        handleSupportInput,
        handleSupportPromptNo,
        exitSupportFlow,
        delayedAppend,
        markActivity,
        scrollToBottom,
    };
}
