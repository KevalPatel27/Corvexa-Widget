"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Listens for postMessage events from the parent (embed.js).
 * Returns all chatbot configuration data received from the parent.
 */
export function useParentMessages({ isDomainValid, domain }) {
    const [user, setUser] = useState(null);
    const [logging, setLogging] = useState(false);
    const [hubspotTracking, setHubspotTracking] = useState(null);
    const [chatbotApiData, setChatbotApiData] = useState(null);
    const [logo, setLogo] = useState(null);
    const [headerIcon, setHeaderIcon] = useState(null);
    const [chatbotColors, setChatbotColors] = useState(null);
    const [chatbotPosition, setChatbotPosition] = useState("right");
    const [chatbotMail, setChatbotMail] = useState(null);
    const [frontendDomain, setFrontendDomain] = useState(null);

    useEffect(() => {
        if (isDomainValid !== true) return;

        function handleMessage(event) {
            const { type } = event.data;

            if (type === "init-chatbot") {
                const {
                    user: userData,
                    config,
                    hubspotTracking: hubspotTrackingData,
                    settings,
                    messages,
                    colors,
                    position,
                    mail,
                    headerIcon: headerIconData,
                } = event.data;

                if (config?.frontendDomain) setFrontendDomain(config.frontendDomain);
                if (hubspotTrackingData) setHubspotTracking(hubspotTrackingData);

                if (userData) {
                    setUser(userData);
                    setLogging(true);
                }

                if (settings) {
                    if (settings.colors) setChatbotColors(settings.colors);
                    if (settings.position) setChatbotPosition(settings.position);
                    if (settings.mail) setChatbotMail(settings.mail);
                    if (settings.icons?.length > 0) {
                        const randomIndex = Math.floor(Math.random() * settings.icons.length);
                        setLogo(settings.icons[randomIndex]);
                    }
                }

                if (headerIconData) setHeaderIcon(headerIconData);
                if (messages) setChatbotApiData({ data: messages });
                if (colors) setChatbotColors(colors);
                if (position) setChatbotPosition(position);
                if (mail) setChatbotMail(mail);
            }

            if (type === "focus-input") {
                setTimeout(() => {
                    document.querySelector(".chatInputTextarea")?.focus();
                }, 100);
            }
        }

        window.addEventListener("message", handleMessage);

        // Tell parent we're ready
        if (window.parent !== window) {
            window.parent.postMessage({ type: "iframe-ready" }, "*");
        }

        return () => window.removeEventListener("message", handleMessage);
    }, [isDomainValid]);

    /**
     * Ask the parent (embed.js) for fresh HubSpot cookies + IP right now.
     * Resolves with the fresh tracking object, or null if the parent doesn't
     * respond within 3 seconds (e.g. direct-page load, no embed.js).
     */
    const requestFreshTracking = useCallback(() => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(null); // fallback — use stored tracking
            }, 3000);

            function handler(event) {
                if (event.data?.type === 'tracking-data-response') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    resolve(event.data.hubspotTracking);
                }
            }

            window.addEventListener('message', handler);

            if (window.parent !== window) {
                window.parent.postMessage({ type: 'request-tracking-data' }, '*');
            } else {
                // Not in an iframe — resolve immediately with null
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                resolve(null);
            }
        });
    }, []);

    return {
        user, logging, hubspotTracking, chatbotApiData,
        logo, headerIcon, chatbotColors, chatbotPosition, chatbotMail, frontendDomain,
        requestFreshTracking,
    };
}
