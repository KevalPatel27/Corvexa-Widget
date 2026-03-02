import React, { useEffect } from "react";
import Image from "next/image";
import "../../../../components/ChatbotHeader.css";


const ChatbotHeader = ({
    logo = "/chatbotlogo.png",
    title = "Chatbot Agent",
    marqueText = [],
    onClose,
    isRequestActive,
    setWasClosedDuringRequest,
    streamingState,
    backgroundStreamingRef,
    startBackgroundStreaming,
}) => {
    const handleClose = () => {
        if (isRequestActive) {
            setWasClosedDuringRequest(true);
            if (
                streamingState?.isStreaming &&
                backgroundStreamingRef?.current?.isActive &&
                backgroundStreamingRef?.current?.reader &&
                backgroundStreamingRef?.current?.decoder
            ) {
                const bg = backgroundStreamingRef.current;
                startBackgroundStreaming(bg.reader, bg.decoder, bg.currentMessageIndex);
            }
        }
        onClose();
    };

    const hasClonedRef = React.useRef(false);

    useEffect(() => {
        if (marqueText.length > 0 && !hasClonedRef.current) {
            const parent = document.querySelector(".chatbot-marquee .scroll-wrapper");
            const ul = parent?.querySelector(".scrolling-list");
            if (parent && ul) {
                for (let i = 0; i < 2; i++) {
                    parent.appendChild(ul.cloneNode(true));
                }
                hasClonedRef.current = true;
            }
        }
    }, [marqueText]);

    return (
        <>
            <div className="chatbot-header">
                <div className="chatbot-header-left">
                    <div className="agent-avatar">
                        <Image className="logoImage" alt="Agent Icon" src={logo} width={40} height={40} />
                    </div>
                    <span className="agent-title">{title}</span>
                </div>
                <div className="chatbot-header-right">
                    <div
                        className="closeIcon"
                        onClick={handleClose}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleClose()}
                        aria-label="Close chat"
                    >
                        <Image src="/close.svg" alt="close" width={20} height={20} />
                    </div>
                </div>
            </div>

            {marqueText.length !== 0 && (
                <div className="chatbot-marquee">
                    <div className="icon-box">
                        <Image src="/bell.svg" alt="image" width={20} height={20} />
                    </div>
                    <div className="scroll-wrapper">
                        <ul className="scrolling-list">
                            {marqueText.map((text, index) => (
                                <li key={index}>{text}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotHeader;
