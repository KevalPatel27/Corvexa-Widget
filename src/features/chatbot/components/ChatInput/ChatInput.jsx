import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { usePlaceholderTyping } from "../../../../hooks/usePlaceholderTyping";


/**
 * Chat input with animated placeholder, auto-resize, and send on Enter.
 */
const ChatInput = ({ value, onChange, onSend, disabled, messages, colors }) => {
    const textareaRef = useRef();

    const animatedPlaceholder = usePlaceholderTyping(messages, {
        typingSpeed: 30,
        delayBetweenMessages: 1500,
        initialDelay: 0,
    });

    // Auto-resize height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "45px";
            const scrollHeight = textareaRef.current.scrollHeight;
            const maxHeight = 155;
            if (scrollHeight <= maxHeight) {
                textareaRef.current.style.overflowY = "hidden";
                textareaRef.current.style.height = scrollHeight + "px";
            } else {
                textareaRef.current.style.overflowY = "auto";
                textareaRef.current.style.height = maxHeight + "px";
            }
        }
    }, [value]);

    // Auto-focus on click anywhere in the chat (but not on message text)
    useEffect(() => {
        const handleDocumentClick = (e) => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            const isMessageArea = e.target.closest('.message-content, .bot-message, .chatbot-messages, [class*="message"]');
            if (isMessageArea) return;
            if (textareaRef.current && !disabled) textareaRef.current.focus();
        };
        document.addEventListener("click", handleDocumentClick);
        return () => document.removeEventListener("click", handleDocumentClick);
    }, [disabled]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault();
            if (value.trim() && !disabled) onSend(value.trim());
        }
    };

    return (
        <>
            <div className="chat-input-outer">
                <div className="inputForm">
                    <textarea
                        name="message"
                        id="chatMessage"
                        ref={textareaRef}
                        className="input chatInputTextarea"
                        value={value}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={animatedPlaceholder}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className="sendbtn"
                        type="button"
                        onClick={() => !disabled && value.trim() && onSend(value.trim())}
                        disabled={disabled || !value.trim()}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" viewBox="0 0 18 17" fill="none">
                            <path
                                d="M16.1828 0.0644416L1.00406 4.70516C0.722892 4.7788 0.473334 4.94007 0.292529 5.16494C0.111725 5.38982 0.0093386 5.6663 0.000608567 5.95322C-0.00812147 6.24015 0.0772712 6.52219 0.244078 6.75736C0.410885 6.99254 0.65019 7.16828 0.926378 7.25844L7.81059 9.53457C7.83569 9.54399 7.85864 9.55821 7.87813 9.57643C7.89762 9.59465 7.91325 9.6165 7.92413 9.64071L10.4579 16.1271C10.5604 16.3877 10.7414 16.611 10.9765 16.7671C11.2115 16.9231 11.4894 17.0043 11.7726 16.9998H11.8085C12.0965 16.9989 12.3769 16.9084 12.6097 16.7411C12.8425 16.5738 13.0159 16.3383 13.1052 16.0681L17.9337 1.7627C18.0094 1.53366 18.0205 1.2886 17.9658 1.05382C17.911 0.819041 17.7925 0.603401 17.623 0.430038C17.4417 0.242189 17.2106 0.108332 16.956 0.0436987C16.7014 -0.0209342 16.4335 -0.0137473 16.1828 0.0644416Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>
                <div className="powered-by">
                    Powered by
                    <a href="https://corvexa.ai" target="_blank" rel="noopener noreferrer">
                        <p>Corvexa</p>
                    </a>
                </div>
            </div>
        </>
    );
};

export default ChatInput;
