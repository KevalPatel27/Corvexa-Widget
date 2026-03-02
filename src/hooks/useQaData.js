"use client";

import { useState, useEffect } from "react";

/**
 * Fetches QA flow data from the backend.
 * Only runs when domain is valid and not a test domain.
 */
export function useQaData({ domain, isDomainValid }) {
    const [qaData, setQaData] = useState(null);
    const [qaLoading, setQaLoading] = useState(false);
    const [qaError, setQaError] = useState(null);

    useEffect(() => {
        if (isDomainValid !== true || !domain || domain === "localhost" || domain === "test.com") {
            return;
        }

        const fetchQAData = async () => {
            setQaLoading(true);
            try {
                const res = await fetch("/api/qa-proxy", {
                    headers: { "X-Client-Domain": domain },
                });
                if (res.ok) {
                    const data = await res.json();
                    setQaData(data);
                }
            } catch (err) {
                setQaError(err.message);
            } finally {
                setQaLoading(false);
            }
        };

        fetchQAData();
    }, [domain, isDomainValid]);

    return { qaData, qaLoading, qaError };
}
