"use client";

import React from "react";
import Image from "next/image";

import Message from "../features/chatbot/components/Message/Message";
import ChatInput from "../features/chatbot/components/ChatInput/ChatInput";
import ChatbotHeader from "../features/chatbot/components/ChatbotHeader/ChatbotHeader";
import ChatbotErrorBoundary from "../features/chatbot/components/ChatbotErrorBoundary";
import { useChatbot } from "../features/chatbot/hooks/useChatbot";
import "./ChatBot.css";

// trying out the auto deployment

const ChatBot = ({
  chatbotApiData,
  onClose,
  domain,
  frontendDomain,
  hubspotTracking,
  requestFreshTracking,
  qaData,
  qaLoading,
  qaError,
  logging,
  logo,
  headerIcon,
  user,
  colors = {},
  mail,
}) => {
  const {
    prompt, setPrompt,
    messages, setMessages,
    IntChat,
    hasUserInteracted,
    isLoading, isBotTyping,
    userScrolledUp, setUserScrolledUp,
    dismissedSupportPromptIdx,
    isSubmitting,
    supportStep,
    currentQaId,
    messagesEndRef, chatbotRef, messagesContainerRef,
    handleSend,
    handleOptionClick,
    handleQaOptionSelect,
    delayedAppend,
    markActivity,
    // From streaming hook (passed through useChatbot)
    streamingState,
    backgroundStreamingRef,
    startBackgroundStreaming,
    isRequestActive,
    setWasClosedDuringRequest,
    // Support flow
    handleSupportInput,
    exitSupportFlow,
    // Support prompt
    handleSupportPromptNo,
    setSupportPromptIdx,
  } = useChatbot({
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
  });

  const placeholders = chatbotApiData?.data?.search_placeholders || ["Type your question here..."];

  return (
    <div className="chatbotContainer" ref={chatbotRef}>
      <ChatbotHeader
        logo={headerIcon || logo}
        title={chatbotApiData?.data?.chatbot_name || "Madison-TripMate"}
        marqueText={chatbotApiData?.data?.marque_text || []}
        onClose={onClose}
        isRequestActive={isRequestActive}
        setWasClosedDuringRequest={setWasClosedDuringRequest}
        streamingState={streamingState}
        backgroundStreamingRef={backgroundStreamingRef}
        startBackgroundStreaming={startBackgroundStreaming}
      />

      <div
        className="messagesContainer"
        ref={messagesContainerRef}
        onScroll={() => {
          const container = messagesContainerRef.current;
          if (!container) return;
          const isAtBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 100;
          setUserScrolledUp(!isAtBottom);
        }}
      >
        {/* Default welcome messages */}
        <div className="message Defaultmsg">
          <p style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {chatbotApiData?.data?.initial_welcome?.[0] ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: chatbotApiData?.data?.initial_welcome?.[0],
                }}
              />
            ) : (
              <>
                Hey{" "}
                {user?.first_name
                  ? `${user.first_name} ${user.last_name || ""}`.trim()
                  : user?.name || "there!"}
                <Image alt="Hi" src="/handshake.svg" width={20} height={20} />
                welcome <span>to DBmaestro!</span>
              </>
            )}
          </p>
        </div>
        <div className="message Defaultmsg">
          <p
            dangerouslySetInnerHTML={{
              __html:
                chatbotApiData?.data?.initial_welcome?.[1] ||
                "Looking for something specific? <br />Choose from the options below or ask me directly.",
            }}
          />
        </div>

        {/* Initial QA flow */}
        {!hasUserInteracted && !currentQaId && (
          qaLoading ? (
            <div className="chatbotReply">
              <div className="chatbotlogo">
                <Image
                  alt="chatbot-Image"
                  className="logoImage"
                  src={logo || "/chatbotlogo.png"}
                  width={40}
                  height={40}
                />
              </div>
              <div className="loading-spinner">
                <div className="spinner" />
              </div>
            </div>
          ) : qaData && Array.isArray(qaData.items) && qaData.items.length > 0 ? (
            <div className="chatbotReply">
              <div className="chatbotlogo">
                <Image
                  alt="chatbot-Image"
                  className="logoImage"
                  src={logo || "/chatbotlogo.png"}
                  width={40}
                  height={40}
                />
              </div>
              <div className="message">
                <strong>{qaData.items[0].q}</strong>
                {qaData.items[0].tp === "option" && (
                  <div className="dynamic-options-row">
                    {qaData.items[0].val.map((opt, oidx) => (
                      <button
                        key={oidx}
                        className="action-button"
                        style={{ background: colors?.button_bg, color: colors?.button_text }}
                        tabIndex={oidx + 1}
                        onClick={() => handleQaOptionSelect(opt)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                {qaData.items[0].tp === "content" && (
                  <div className="dynamic-content">
                    <p>{qaData.items[0].val}</p>
                  </div>
                )}
                {qaData.items[0].tp === "link" && (
                  <div className="dynamic-links-row">
                    {qaData.items[0].val.map((link, lidx) => (
                      <button
                        key={lidx}
                        className="action-button"
                        style={{ background: colors?.button_bg, color: colors?.button_text }}
                        tabIndex={lidx + 1}
                        onClick={() => window.open(link.url, link.target || "_blank")}
                      >
                        {link.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null
        )}

        {/* Message list */}
        {messages.map((msg, idx) => (
          <React.Fragment key={idx}>
            {msg.qaItem ? (
              <div className="chatbotReply">
                <div className="chatbotlogo">
                  <Image
                    alt="chatbot-Image"
                    className="logoImage"
                    src={logo || "/chatbotlogo.png"}
                    width={40}
                    height={40}
                  />
                </div>
                <div className="message">
                  <strong>{msg.qaItem.q}</strong>
                  {msg.qaItem.tp === "option" && (
                    <div className="dynamic-options-row">
                      {msg.qaItem.val.map((opt, oidx) => (
                        <button
                          key={oidx}
                          className="action-button"
                          style={{ background: colors?.button_bg, color: colors?.button_text }}
                          onClick={() => handleQaOptionSelect(opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.qaItem.tp === "content" && (
                    <div className="dynamic-content">
                      <p>{msg.qaItem.val}</p>
                    </div>
                  )}
                  {msg.qaItem.tp === "link" && (
                    <div className="dynamic-links-row">
                      {msg.qaItem.val.map((link, lidx) => (
                        <button
                          key={lidx}
                          className="action-link"
                          tabIndex={lidx + 1}
                          onClick={() =>
                            window.open(
                              link.url,
                              link.target === "_self" ? "_top" : link.target || "_blank"
                            )
                          }
                        >
                          {link.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Message
                message={msg}
                showSupportPrompt={
                  msg.role === "bot" &&
                  msg.content.includes("couldn't found any content regarding") &&
                  !dismissedSupportPromptIdx.includes(idx)
                }
                isStreaming={
                  msg.role === "bot" &&
                  idx === messages.length - 1 &&
                  isBotTyping
                }
                onInterestedElse={exitSupportFlow}
                sendSupportRequest={() => { }}
                isSubmitting={isSubmitting}
                onNoFeedback={() => handleSupportPromptNo?.(idx)}
                logging={logging}
                domain={domain}
                logo={logo}
                onOptionSelect={async (val) => {
                  markActivity();
                  await handleOptionClick(String(val), msg);
                }}
                colors={colors}
                isDisabled={isLoading || isBotTyping || isSubmitting}
              />
            )}
          </React.Fragment>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        value={prompt}
        onChange={setPrompt}
        onSend={supportStep
          ? async (val) => { await handleSupportInput(val); setPrompt(''); }
          : handleSend
        }
        disabled={isLoading || isBotTyping || isSubmitting}
        colors={colors}
        messages={placeholders}
      />
    </div>
  );
};

const ChatBotWithBoundary = (props) => (
  <ChatbotErrorBoundary>
    <ChatBot {...props} />
  </ChatbotErrorBoundary>
);

export default ChatBotWithBoundary;
