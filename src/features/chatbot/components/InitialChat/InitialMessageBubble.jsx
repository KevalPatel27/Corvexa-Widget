import Image from "next/image";
import { usePlaceholderTyping } from "../../../../hooks/usePlaceholderTyping";


export default function InitialMessageBubble({ message, avatarSrc, onClose }) {
    const animatedMessage = usePlaceholderTyping(message, {
        typingSpeed: 30,
        delayBetweenMessages: 2000,
        initialDelay: 0,
    });

    return (
        <div className="chatbot-message-bubble">
            <div className="chatbot-bubble-content">
                <span className="chatbot-message-text">{animatedMessage}</span>
                <button className="chatbot-close-btn" aria-label="Close" onClick={onClose}>
                    <Image src="/close.svg" alt="close" width={16} height={16} />
                </button>
            </div>
        </div>
    );
}
