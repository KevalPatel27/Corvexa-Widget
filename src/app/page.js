"use client";

import ChatBot from "@/components/ChatBot";
import { useDomainValidation } from "@/hooks/useDomainValidation";
import { useParentMessages } from "@/hooks/useParentMessages";
import { useTheme } from "@/hooks/useTheme";
import { useQaData } from "@/hooks/useQaData";
import "./page.css";

export default function Home() {
  const { domain, isEmbedded, isDomainValid, error } = useDomainValidation();

  const {
    user, logging, hubspotTracking, chatbotApiData,
    logo, headerIcon, chatbotColors, chatbotPosition, chatbotMail, frontendDomain,
  } = useParentMessages({ isDomainValid, domain });

  useTheme({ chatbotColors, isDomainValid });

  const { qaData, qaLoading, qaError } = useQaData({ domain, isDomainValid });

  // ── Error state ───────────────────────────────────────────────────────────
  if (isDomainValid === false || error) {
    return (
      <div className="mainContainer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", color: "red", textAlign: "center", padding: "20px" }}>
        <h2>⚠️ Access Denied</h2>
        <p>{error || "This domain is not authorized to use the chatbot."}</p>
        {domain && <p style={{ fontSize: "12px", color: "#666" }}>Domain: {domain}</p>}
      </div>
    );
  }

  // ── Not embedded ──────────────────────────────────────────────────────────
  if (!isEmbedded) {
    return (
      <div className="mainContainer" style={{ padding: "50px", textAlign: "center" }}>
        <h1>🤖 GoChatbot</h1>
        <p>This page should be embedded via the embed script.</p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <main className="mainContainer">
      <ChatBot
        chatbotApiData={chatbotApiData}
        onClose={() => window.parent !== window && window.parent.postMessage({ type: "close-chatbot" }, "*")}
        domain={domain}
        frontendDomain={frontendDomain}
        hubspotTracking={hubspotTracking}
        qaData={qaData}
        qaLoading={qaLoading}
        qaError={qaError}
        logo={logo || "/chatbotlogo.png"}
        headerIcon={headerIcon || "/chatbotlogo.png"}
        logging={logging}
        user={user}
        colors={chatbotColors}
        position={chatbotPosition}
        mail={chatbotMail}
      />
    </main>
  );
}
