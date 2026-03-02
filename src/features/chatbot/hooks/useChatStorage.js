'use client';

import { useState, useEffect, useRef } from 'react';
import { loadState, saveState } from '../../../lib/storage';

/**
 * Manages chatbot state persistence to/from localStorage.
 * Returns the initial state and a save function.
 *
 * @param {string} domain
 * @returns {{ initialState: object|null, persistState: (state: object) => void }}
 */
export function useChatStorage(domain) {
    const initialState = useRef(loadState(domain)).current;

    /**
     * Persist the full chatbot state to localStorage.
     * Call this from a useEffect in the parent whenever relevant state changes.
     * @param {object} state
     */
    function persistState(state) {
        saveState(domain, state);
    }

    return { initialState, persistState };
}
