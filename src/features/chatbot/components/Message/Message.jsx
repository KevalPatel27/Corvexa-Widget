import React from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import styles from "../../../../components/Markdown.module.css";


const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    if (diffInHours < 168) {
        return date.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: true });
    }
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

const BotMessage = ({
    content, chatboticon, showSupportPrompt, isStreaming,
    sendSupportRequest, onNoFeedback, isSubmitting, logging,
    onInterestedElse, domain, logo, options, onOptionSelect, isDisabled, timestamp,
}) => (
    <div className="chatbotReply">
        {!chatboticon && (
            <div className="chatbotlogo">
                <Image alt="chatbot-Image" className="logoImage" src={logo || "/chatbotlogo.png"} width={40} height={40} />
            </div>
        )}
        <div className={`message ${chatboticon ? "Defaultmsg" : ""}`}>
            <div className={styles.markdownBody}>
                <ReactMarkdown
                    components={{
                        a: ({ href, children, ...props }) => {
                            if (href === "interested" && onInterestedElse) {
                                return (
                                    <button
                                        type="button"
                                        style={{ background: "none", border: "none", padding: 0, margin: 0, color: "var(--button_bg)", cursor: "pointer", font: "inherit" }}
                                        disabled={isDisabled}
                                        onClick={(e) => { e.preventDefault(); !isDisabled && onInterestedElse(); }}
                                        tabIndex={0}
                                    >
                                        {children}
                                    </button>
                                );
                            }
                            return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
            {timestamp && <div className="message-timestamp">{formatTime(timestamp)}</div>}
            {Array.isArray(options) && options.length > 0 && (
                <div className="dynamic-options-row">
                    {options.map((opt, i) => (
                        <button
                            key={i}
                            className="action-button"
                            disabled={isDisabled}
                            onClick={() => !isDisabled && onOptionSelect && onOptionSelect(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
);

const TypingIndicator = ({ logo }) => (
    <div className="chatbotReply">
        <div className="chatbotlogo logoImage">
            <Image alt="chatbot-Image" className="logoImage" src={logo || "/chatbotlogo.png"} width={40} height={40} />
        </div>
        <div>
            <div className="dot-ellipsis-anim" aria-label="Bot is typing">
                <span /><span /><span />
            </div>
        </div>
    </div>
);

const UserMessage = ({ content, timestamp }) => (
    <div className="message user">
        <div className={styles.markdownBody}>
            <ReactMarkdown
                components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
            >
                {content}
            </ReactMarkdown>
        </div>
        {timestamp && <div className="message-timestamp">{formatTime(timestamp)}</div>}
    </div>
);

const Message = ({
    message, showSupportPrompt, isStreaming, sendSupportRequest,
    onNoFeedback, isSubmitting, logging, domain, logo,
    onInterestedElse, onOptionSelect, isDisabled,
}) => {
    if (message.role === "bot" && isStreaming && (!message.content || message.content.length < 2)) {
        return <TypingIndicator logo={logo} />;
    }
    return message.role === "bot" ? (
        <BotMessage
            content={message.content}
            chatboticon={message.chaticon}
            showSupportPrompt={showSupportPrompt}
            isStreaming={isStreaming}
            sendSupportRequest={sendSupportRequest}
            onNoFeedback={onNoFeedback}
            isSubmitting={isSubmitting}
            logging={logging}
            domain={domain}
            logo={logo}
            options={message.options}
            onInterestedElse={onInterestedElse}
            onOptionSelect={onOptionSelect}
            isDisabled={isDisabled}
            timestamp={message.timestamp}
        />
    ) : (
        <UserMessage content={message.content} timestamp={message.timestamp} />
    );
};

export default Message;
