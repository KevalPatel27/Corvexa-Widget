"use client";

import React from "react";

/**
 * Error boundary for the chatbot widget.
 * Catches render errors and shows a friendly fallback.
 */
class ChatbotErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // In production you'd send this to an error reporting service
        console.error("[ChatbotErrorBoundary]", error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        padding: "24px",
                        textAlign: "center",
                        gap: "12px",
                    }}
                >
                    <p style={{ fontSize: "32px" }}>😕</p>
                    <p style={{ fontWeight: 600 }}>Something went wrong</p>
                    <p style={{ fontSize: "13px", color: "#888" }}>
                        The chatbot encountered an unexpected error.
                    </p>
                    <button
                        onClick={this.handleReset}
                        style={{
                            marginTop: "8px",
                            padding: "8px 20px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--button_bg, #0070f3)",
                            color: "var(--button_text, #fff)",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ChatbotErrorBoundary;
