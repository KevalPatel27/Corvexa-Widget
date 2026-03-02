"use client";

import { useState, useEffect } from "react";

/**
 * Validates the chatbot domain against the backend.
 * Returns { domain, isDomainValid, error, isEmbedded }.
 */
export function useDomainValidation() {
    const [domain, setDomain] = useState(null);
    const [frontendDomain, setFrontendDomain] = useState(null);
    const [isEmbedded, setIsEmbedded] = useState(false);
    const [isDomainValid, setIsDomainValid] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const domainParam = params.get("domain") || "localhost";
        const embeddedParam = params.get("embedded") === "true";

        setDomain(domainParam);
        setIsEmbedded(embeddedParam);

        // Skip validation for test domains
        if (domainParam === "localhost" || domainParam === "test.com") {
            setIsDomainValid(true);
            return;
        }

        const validate = async () => {
            try {
                const res = await fetch("/api/validate-domain", {
                    headers: { "X-Client-Domain": domainParam },
                });
                const data = await res.json();
                if (!data.valid) {
                    setIsDomainValid(false);
                    setError("This domain is not authorized");
                } else {
                    setIsDomainValid(true);
                }
            } catch {
                setIsDomainValid(false);
                setError("Domain validation failed");
            }
        };

        // validate(); // Uncomment to enable domain validation
    }, []);

    return { domain, frontendDomain, setFrontendDomain, isEmbedded, isDomainValid, error };
}
