import { useState, useEffect } from 'react';

export const usePlaceholderTyping = (messages, options = {}) => {
  const {
    typingSpeed = 50,
    initialDelay = 5000,
    delayBetweenMessages = 2000, // pause before moving to next
  } = options;

  const [placeholder, setPlaceholder] = useState('');
  const [messageIdx, setMessageIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (messages?.length === 0) return;

    if (!hasStarted) {
      const timer = setTimeout(() => {
        setHasStarted(true);
      }, initialDelay);
      return () => clearTimeout(timer);
    }

    const currentMessage = messages[messageIdx];
    let timer = null;

    // Typing forward
    if (charIdx < currentMessage?.length) {
      timer = setTimeout(() => {
        setPlaceholder(currentMessage.slice(0, charIdx + 1));
        setCharIdx(charIdx + 1);
      }, typingSpeed);
    } 
    // Message complete - pause then move to next
    else if (charIdx === currentMessage?.length) {
      timer = setTimeout(() => {
        // Move to next message
        setMessageIdx((messageIdx + 1) % messages.length);
        setCharIdx(0);
        setPlaceholder('');
      }, delayBetweenMessages);
    }

    return () => clearTimeout(timer);
  }, [
    charIdx,
    messageIdx,
    messages,
    hasStarted,
    typingSpeed,
    delayBetweenMessages,
    initialDelay,
  ]);

  return placeholder;
};
