"use client";

import { useEffect } from "react";

/**
 * Applies chatbot color theme variables to the document root.
 * Runs whenever chatbotColors changes.
 */
export function useTheme({ chatbotColors, isDomainValid }) {
    useEffect(() => {
        if (isDomainValid !== true || !chatbotColors) return;
        const colors = chatbotColors.colors || chatbotColors;
        Object.entries(colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}`, value);
        });
    }, [chatbotColors, isDomainValid]);
}
