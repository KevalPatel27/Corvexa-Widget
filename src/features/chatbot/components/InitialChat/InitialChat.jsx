import React from "react";
import Image from "next/image";

const InitialChat = ({ onStartChat, logo, colors }) => (
    <div className="initchat">
        <div className="chatbotImage gap">
            <Image src={logo || "/chatbotlogo.png"} alt="Chatbot Icon" width={80} height={80} />
        </div>
        <div className="chatbotText gap">
            <h2>How can we <br /> help you today?</h2>
        </div>
        <div className="handshake">
            <Image src="/handshake.svg" alt="Handshake Icon" width={50} height={50} />
        </div>
        <div className="chatWithUs">
            <div className="chatwitus-content">
                <div className="chatbotlogo">
                    <Image src={logo || "/chatbotlogo.png"} alt="chatbot-Image" className="logoImage" width={34} height={34} />
                </div>
                <div className="chatbottext">
                    <p>Let me know if you have any questions!</p>
                </div>
            </div>
            <button
                className="btn"
                onClick={onStartChat}
                style={{ background: colors?.button_bg, color: colors?.button_text }}
            >
                Chat with us
            </button>
        </div>
    </div>
);

export default InitialChat;
