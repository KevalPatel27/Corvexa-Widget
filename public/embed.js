(function () {
  "use strict";

  if (window.GoChatbotWidget) {
    return;
  }

  // ==================== CONFIGURATIONS ====================
  const CONFIG = {
    WIDGET_URL: "https://chatwidget.corvexa.cloud",
    BUBBLE_ID: "gochatbot-bubble",
    ICON_ID: "gochatbot-icon",
    IFRAME_ID: "gochatbot-iframe",
  };

  const scriptTag =
    document.currentScript || document.querySelector('script[src*="embed.js"]');
  const config = {
    frontendDomain:
      (scriptTag && scriptTag.getAttribute("data-domain")) ||
      window.location.hostname,
    backendDomain: null, // Will be populated after validation
    position: (scriptTag && scriptTag.getAttribute("data-position")) || "right",
  };

  // ==================== STATE ====================
  const state = {
    isChatOpen: false,
    isBubbleVisible: false,
    settings: null,
    messages: null,
    logo: `${CONFIG.WIDGET_URL}/chatbotlogo.png`,
    headerIcon: `${CONFIG.WIDGET_URL}/chatbotlogo.png`,
    close: null,
    colors: { primary: "#007bff" },
    position: "right",
    mail: null,
    currentMessageIndex: 0,
    currentCharIndex: 0,
    typingInterval: null,
    bubbleTimer: null,
    bubbleDismissed: false,
    isValidDomain: false,
    isEnabled: false,
    activeDays: {},
    leadGenerationOptions: null,
  };

  // ==================== DOMAIN VALIDATION ====================
  async function validateDomain() {
    // Skip validation for localhost/test domains
    if (
      config.frontendDomain === "localhost" ||
      config.frontendDomain === "test.com"
    ) {
      config.backendDomain = config.frontendDomain;
      state.isValidDomain = true;
      return true;
    }

    try {
      const response = await fetch(`${CONFIG.WIDGET_URL}/api/validate-domain`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-domain": config.frontendDomain,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      if (data.valid && data.domain) {
        config.backendDomain = data.domain;
        state.isValidDomain = true;
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  // ==================== HUBSPOT TRACKING ====================
  function getHubSpotCookies() {
    const cookies = document.cookie.split(';');
    const hubspotData = {};

    cookies.forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      // HubSpot tracking cookies
      if (name === 'hubspotutk') hubspotData.hutk = value;
      if (name === '__hstc') hubspotData.hstc = value;
      if (name === '__hssc') hubspotData.hssc = value;
      if (name === '__hssrc') hubspotData.hssrc = value;
    });

    return hubspotData;
  }

  async function getIPAddress() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch {
      return null;
    }
  }

  // ==================== API CALLS ====================
  async function fetchChatbotData() {
    if (!state.isValidDomain) {
      return;
    }

    // Test mode fallback
    if (
      config.backendDomain === "localhost" ||
      config.backendDomain === "test.com"
    ) {
      state.messages = {
        default_messages: [
          "Hello! How can I help you?",
          "Feel free to ask me anything.",
        ],
      };
      state.leadGenerationOptions = [
        "Check how we are better than others",
        "Book a Demo",
        "Real estate investor portal",
        "Connect with a human"
      ];
      return;
    }

    try {
      // Use backendDomain for API calls
      const [settingsRes, messagesRes, leadGenRes] = await Promise.all([
        fetch(
          `https://${config.backendDomain}/wp-json/chatbot/v1/settings-frontend`
        ),
        fetch(
          `https://${config.backendDomain}/wp-json/chatbot/v1/chatbot-messages`
        ),
        fetch(
          `https://${config.backendDomain}/wp-json/chatbot/v1/lead-generation`
        )
      ]);

      // Process settings API
      if (settingsRes?.ok) {
        const settingsData = await settingsRes.json();
        state.settings = settingsData;

        if (settingsData.icons?.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * settingsData.icons.length
          );
          state.logo = settingsData.icons[randomIndex];
        }

        if (settingsData.header_icon) {
          state.headerIcon = settingsData.header_icon;
        }

        if (settingsData.colors) {
          state.colors = settingsData.colors;
        }

        if (settingsData.close) {
          state.close = settingsData.close;
        }

        if (settingsData.position) {
          state.position = settingsData.position;
          config.position = settingsData.position;
        }

        if (settingsData.mail) {
          state.mail = settingsData.mail;
        }

        // Store status and active days for gating
        state.isEnabled = settingsData.status === "yes";
        if (settingsData.days) {
          state.activeDays = settingsData.days;
        }
      }

      // Process messages API
      if (messagesRes?.ok) {
        const messagesData = await messagesRes.json();
        if (messagesData.success && messagesData.data) {
          state.messages = messagesData.data;
        }
      }

      // Process lead generation API
      if (leadGenRes?.ok) {
        const leadGenData = await leadGenRes.json();
        if (leadGenData.success && Array.isArray(leadGenData.data) && leadGenData.data.length > 0) {
          state.leadGenerationOptions = leadGenData.data;
        }
      }
    } catch (err) {
      state.messages = {
        default_messages: ["Hello! How can I help you?"],
      };
    }
  }

  // ==================== CSS INJECTION ====================
  function injectStyles() {
    const positionCSS =
      state.position === "left" ? "left: 20px;" : "right: 20px;";
    const primaryColor =
      state.colors?.chatbot_primary || state.colors?.primary || "#007bff";

    const css = `
    @import url('https://fonts.googleapis.com/css2?family=Work+Sans&display=swap');

    #${CONFIG.BUBBLE_ID} {
      position: fixed;
      bottom: 125px;
      ${positionCSS}
      z-index: 2147483647;
      display: none;
      flex-direction: column;
      align-items: center;
      width: max-content;
      animation: slideUp 0.3s ease-out;
      font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${CONFIG.BUBBLE_ID}.visible { display: flex; }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .chatbot-bubble-content {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 0 20px 0 rgba(0, 0, 0, 0.1);
      /* border: 1px solid #ED1566; */
      padding: 10px 15px 10px 10px;
      display: flex;
      align-items: center;
      position: relative;
      /* gap: 16px; */
      width: 250px;
      font-family: 'Work Sans', sans-serif;
    }

    .chatbot-avatar-wrapper {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chatbot-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.13);
    }

    .chatbot-message-text {
      color: #33475b;
      font-size: 13px;
      line-height: 1.5;
      max-width: 200px;
      font-family: 'Work Sans', sans-serif;
      font-weight: 400;
    }

    .chatbot-close-btn {
      background: transparent;
      border: none;
      width: 9px;
      height: 9px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      position: absolute;
      top: 10px;
      right: 15px;
      color: black;
      font-size: 18px;
    }

    .chatbot-close-btn:hover { filter: brightness(1.1); }
    .chatbot-close-btn img { width: 100%; height: 100%; object-fit: contain;filter: brightness(0) saturate(100%);}

    #${CONFIG.BUBBLE_ID}.has-options {
      align-items: ${state.position === "left" ? "flex-start" : "flex-end"};
      gap: 12px;
    }

    .chatbot-option-bubble {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      padding: 12px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      position: relative;
      transition: transform 0.2s, box-shadow 0.2s;
      width: max-content;
      max-width: 250px;
    }
    .chatbot-option-bubble:first-child {
      border-radius: 20px 20px 5px 20px;
    }

    .chatbot-option-bubble:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    .chatbot-option-bubble.has-close {
      padding-right: 40px; /* space for close btn */
    }

    .chatbot-option-text {
      color: #33475b;
      font-size: 14px;
      line-height: 1.4;
      font-weight: 500;
    }

    .chatbot-option-close-btn {
      background: #fff;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      position: absolute;
      top: -40px;
      right: 0;
      padding: 0;
    }

    .chatbot-option-close-btn:hover {
      background: #f1f1f1;
    }

    .chatbot-option-close-btn svg {
      width: 14px;
      height: 14px;
      stroke: #333;
    }

    #${CONFIG.ICON_ID} {
      position: fixed;
      bottom: 4%;
      ${positionCSS}
      width: 70px;
      height: 70px;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: transform 0.2s ease;
    }

    #${CONFIG.ICON_ID}.hidden { display: none; }
    #${CONFIG.ICON_ID}:hover { transform: scale(1.08); }
    
    #${CONFIG.ICON_ID}::after {
      content: "1";
      position: absolute;
      top: 0;
      right: -2px;
      width: 18px;
      height: 18px;
      background: #39b80f;
      border-radius: 50%;
      border: 2px solid #ffffff;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      filter: drop-shadow(0 0 34px rgba(0, 0, 0, 0.20));
      animation: pulseGreen 1.5s ease-in-out infinite;
    }

    @keyframes pulseGreen {
      0% { transform: scale(1); }
      50% { transform: scale(1.15); }
      100% { transform: scale(1); }
    }

    #${CONFIG.ICON_ID} img {
      width: 70px;
      height: 70px;
      object-fit: contain;
      border-radius: 50%;
    }



    #${CONFIG.IFRAME_ID} {
      position: fixed;
      bottom: 3%;
      ${positionCSS}
      width: 450px;
      height: 670px;
      border: none;
      border-radius: 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      z-index: 2147483645;
      display: none;
    }

    #${CONFIG.IFRAME_ID}.visible {
      display: block;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @media screen and (max-width: 575px) {
      #${CONFIG.IFRAME_ID}.visible {
        width: 100vw !important;
        height: 100dvh !important;
        bottom: 0 !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        border-radius: 0 !important;
      }
    }
  `;

    const styleEl = document.createElement("style");
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
  }

  // ==================== DOM CREATION ====================
  function createBubble() {
    const bubble = document.createElement("div");
    bubble.id = CONFIG.BUBBLE_ID;

    if (state.leadGenerationOptions && state.leadGenerationOptions.length > 0) {
      bubble.classList.add("has-options");
      let html = "";
      state.leadGenerationOptions.forEach((opt, idx) => {
        const isFirst = idx === 0;
        const classes = isFirst ? "chatbot-option-bubble has-close" : "chatbot-option-bubble";
        html += `
          <div class="${classes}" data-text="${opt.replace(/"/g, '&quot;')}">
            <span class="chatbot-option-text">${opt}</span>
            ${isFirst ? `
            <button class="chatbot-option-close-btn" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>` : ''}
          </div>
        `;
      });
      bubble.innerHTML = html;

      // Close button handler
      const closeBtn = bubble.querySelector(".chatbot-option-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          hideBubble();
          state.bubbleDismissed = true;
        });
      }

      // Option click handler
      const options = bubble.querySelectorAll(".chatbot-option-bubble");
      options.forEach(opt => {
        opt.addEventListener("click", (e) => {
          if (e.target.closest('.chatbot-option-close-btn')) return;
          const text = opt.getAttribute("data-text");
          openChat(text);
          hideBubble();
          state.bubbleDismissed = true;
        });
      });
    } else {
      bubble.innerHTML = `
        <div class="chatbot-bubble-content">
          <span class="chatbot-message-text" id="bubble-text"></span>
          <div class="chatbot-close-btn"><img src="${state.close}" alt="close"></img></div>
        </div>
      `;

      bubble.querySelector(".chatbot-close-btn").addEventListener("click", () => {
        hideBubble();
        state.bubbleDismissed = true;
      });
    }

    document.body.appendChild(bubble);

    return bubble;
  }

  function createIcon() {
    const icon = document.createElement("div");
    icon.id = CONFIG.ICON_ID;
    icon.innerHTML = `<img src=${state.headerIcon} alt="chatbot-logo" />`;
    document.body.appendChild(icon);

    icon.addEventListener("click", () => {
      if (!state.isChatOpen) {
        openChat();
      } else {
        closeChat();
      }
    });

    return icon;
  }

  function createIframe() {
    const iframe = document.createElement("iframe");
    iframe.id = CONFIG.IFRAME_ID;
    iframe.src = `${CONFIG.WIDGET_URL}/?domain=${config.backendDomain}&embedded=true`;
    iframe.title = "Chatbot";
    iframe.allow = "microphone";
    document.body.appendChild(iframe);

    const sendData = async () => {
      // Read user from localStorage
      let storedUser = null;

      try {
        storedUser = JSON.parse(localStorage.getItem("chatbot_user"));
      } catch (e) {
        storedUser = null;
      }

      // If no stored user: send only role
      const user = storedUser

      console.log("User Login:", user);

      // Capture HubSpot tracking data
      const hubspotCookies = getHubSpotCookies();
      const ipAddress = await getIPAddress();

      const payload = {
        type: "init-chatbot",
        user: user,
        config: {
          ...config,
          domain: config.backendDomain,
          frontendDomain: config.frontendDomain,
        },
        hubspotTracking: {
          cookies: hubspotCookies,
          ipAddress: ipAddress,
          pageUrl: window.location.href,
          pageName: document.title
        },
        settings: state.settings,
        messages: state.messages,
        colors: state.colors,
        position: state.position,
        mail: state.mail,
        headerIcon: state.headerIcon,
      };

      iframe.contentWindow.postMessage(payload, "*");
    };

    const handleIframeReady = (event) => {
      if (event.data.type === "iframe-ready") {
        sendData();
        window.removeEventListener("message", handleIframeReady);
      }
    };

    window.addEventListener("message", handleIframeReady);

    iframe.addEventListener("load", () => {
      setTimeout(() => {
        sendData();
      }, 2000);
    });

    window.addEventListener("message", (event) => {
      const { type } = event.data;

      if (type === "close-chatbot") {
        closeChat();
      }

      if (type === "open-chatbot") {
        openChat();
      }

      // Iframe requests fresh tracking data right before lead submission
      if (type === "request-tracking-data") {
        (async () => {
          const hubspotCookies = getHubSpotCookies();
          const ipAddress = await getIPAddress();
          iframe.contentWindow.postMessage({
            type: "tracking-data-response",
            hubspotTracking: {
              cookies: hubspotCookies,
              ipAddress,
              pageUrl: window.location.href,
              pageName: document.title,
            },
          }, "*");
        })();
      }
    });

    return iframe;
  }

  // ==================== TYPING ANIMATION ====================
  function startTypingAnimation() {
    const textEl = document.getElementById("bubble-text");
    if (!textEl || !state.messages?.default_messages) return;

    clearInterval(state.typingInterval);
    state.currentCharIndex = 0;

    const messages = state.messages.default_messages;
    const currentMessage = messages[state.currentMessageIndex];

    state.typingInterval = setInterval(() => {
      if (state.currentCharIndex < currentMessage.length) {
        textEl.textContent = currentMessage.slice(
          0,
          state.currentCharIndex + 1
        );
        state.currentCharIndex++;
      } else {
        clearInterval(state.typingInterval);
        setTimeout(() => {
          state.currentMessageIndex =
            (state.currentMessageIndex + 1) % messages.length;
          startTypingAnimation();
        }, 2000);
      }
    }, 30);
  }

  // ==================== CHAT CONTROLS ====================
  function openChat(text = null) {
    state.isChatOpen = true;
    const iframe = document.getElementById(CONFIG.IFRAME_ID);
    const icon = document.getElementById(CONFIG.ICON_ID);

    hideBubble();
    if (state.bubbleTimer) {
      clearTimeout(state.bubbleTimer);
      state.bubbleTimer = null;
    }

    icon.classList.add("hidden");
    iframe.classList.add("visible");

    setTimeout(() => {
      console.log('[embed.js] postMessage → open-chatbot');
      iframe.contentWindow.postMessage({ type: "open-chatbot" }, "*");

      if (text && typeof text === 'string') {
        setTimeout(() => {
          console.log('[embed.js] postMessage → send-user-message');
          iframe.contentWindow.postMessage({ type: "send-user-message", message: text }, "*");
        }, 500);
      } else {
        setTimeout(() => {
          console.log('[embed.js] postMessage → focus-input');
          iframe.contentWindow.postMessage({ type: "focus-input" }, "*");
        }, 200);
      }
    }, 100);
  }

  function closeChat() {
    state.isChatOpen = false;
    const iframe = document.getElementById(CONFIG.IFRAME_ID);
    const icon = document.getElementById(CONFIG.ICON_ID);

    iframe.classList.remove("visible");
    icon.classList.remove("hidden");

    if (!state.bubbleDismissed) {
      startBubbleTimer();
    }
  }

  // ==================== BUBBLE MANAGEMENT ====================
  function showBubble() {
    if (state.bubbleDismissed || state.isChatOpen) {
      return;
    }

    const bubble = document.getElementById(CONFIG.BUBBLE_ID);
    if (bubble) {
      bubble.classList.add("visible");
      state.isBubbleVisible = true;
      if (!state.leadGenerationOptions || state.leadGenerationOptions.length === 0) {
        startTypingAnimation();
      }
    }
  }

  function hideBubble() {
    const bubble = document.getElementById(CONFIG.BUBBLE_ID);
    if (bubble) {
      bubble.classList.remove("visible");
      state.isBubbleVisible = false;
      clearInterval(state.typingInterval);
    }
  }

  function startBubbleTimer() {
    if (state.bubbleTimer) {
      clearTimeout(state.bubbleTimer);
    }
    state.bubbleTimer = setTimeout(() => {
      showBubble();
    }, 5000);
  }

  // ==================== INIT ====================
  async function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    // Step 1: Validate domain first
    const isValid = await validateDomain();

    if (!isValid) {
      return;
    }

    // Step 2: Fetch chatbot data using validated backend domain
    await fetchChatbotData();

    // Step 3: Check if chatbot is enabled and today is an active day
    if (!state.isEnabled) {
      return;
    }

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayName = days[new Date().getDay()];
    if (state.activeDays[todayName] === false) {
      return;
    }

    // Step 4: Create UI elements
    injectStyles();
    createBubble();
    createIcon();
    createIframe();

    startBubbleTimer();
  }

  window.GoChatbotWidget = {
    open: openChat,
    close: closeChat,
    toggle: () => (state.isChatOpen ? closeChat() : openChat()),
  };

  init();
})();
