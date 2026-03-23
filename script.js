// ===== Configuration =====
const API_URL = "/api/generate";

// ===== DOM Elements =====
const chatMessages = document.getElementById("chatMessages");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");

// ===== Event Listeners =====
promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// ===== Core Functions =====

/**
 * Handles the send button click / Enter press
 */
function handleSend() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Render user message
    appendUserMessage(prompt);

    // Clear input
    promptInput.value = "";
    promptInput.focus();

    // Disable input while generating
    setInputEnabled(false);

    // Show typing indicator
    const typingEl = showTypingIndicator();

    // Call API
    queryHuggingFace(prompt)
        .then((imageBlob) => {
            removeTypingIndicator(typingEl);
            appendBotImage(imageBlob, prompt);
        })
        .catch((error) => {
            removeTypingIndicator(typingEl);
            appendBotError(error.message || "Something went wrong. Please try again.");
        })
        .finally(() => {
            setInputEnabled(true);
        });
}

/**
 * Sends POST request to the local proxy which forwards to Hugging Face
 */
async function queryHuggingFace(prompt) {
    const response = await fetch(API_URL, {
        headers: {
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
        let errorMsg = `API returned ${response.status}`;
        try {
            const errorJson = await response.json();
            errorMsg = errorJson.error || errorMsg;
        } catch {
            errorMsg += `: ${response.statusText}`;
        }
        throw new Error(errorMsg);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("image")) {
        return await response.blob();
    }

    // Unexpected non-image response
    const text = await response.text();
    throw new Error(`Unexpected response: ${text.substring(0, 200)}`);
}

// ===== UI Helper Functions =====

/**
 * Appends user message bubble
 */
function appendUserMessage(text) {
    const messageEl = document.createElement("div");
    messageEl.className = "message user-message";
    messageEl.innerHTML = `
        <div class="message-avatar"><span>You</span></div>
        <div class="message-content">
            <div class="message-bubble">${escapeHTML(text)}</div>
        </div>
    `;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
}

/**
 * Appends bot message with generated image
 */
function appendBotImage(imageBlob, prompt) {
    const imageUrl = URL.createObjectURL(imageBlob);

    const messageEl = document.createElement("div");
    messageEl.className = "message bot-message";
    messageEl.innerHTML = `
        <div class="message-avatar"><span>✦</span></div>
        <div class="message-content">
            <div class="message-bubble">
                <p style="margin-bottom: 10px; color: var(--text-secondary); font-size: 13px;">
                    Here's your image for: <em>"${escapeHTML(prompt)}"</em>
                </p>
                <div class="generated-image-wrapper">
                    <img
                        class="generated-image"
                        src="${imageUrl}"
                        alt="AI generated: ${escapeHTML(prompt)}"
                        onload="this.style.animation='imageLoad 0.5s ease forwards'"
                    >
                    <button class="download-btn" onclick="downloadImage('${imageUrl}', '${escapeHTML(prompt).replace(/'/g, "")}')">
                        ⬇ Download
                    </button>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
}

/**
 * Appends bot error message
 */
function appendBotError(errorMsg) {
    const messageEl = document.createElement("div");
    messageEl.className = "message bot-message";
    messageEl.innerHTML = `
        <div class="message-avatar"><span>✦</span></div>
        <div class="message-content">
            <div class="message-bubble">
                <p class="error-text">⚠ ${escapeHTML(errorMsg)}</p>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 6px;">
                    Please try again with a different prompt.
                </p>
            </div>
        </div>
    `;
    chatMessages.appendChild(messageEl);
    scrollToBottom();
}

/**
 * Shows animated typing indicator
 */
function showTypingIndicator() {
    const typingEl = document.createElement("div");
    typingEl.className = "typing-indicator";
    typingEl.id = "typingIndicator";
    typingEl.innerHTML = `
        <div class="message-avatar"><span>✦</span></div>
        <div class="typing-bubble">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(typingEl);
    scrollToBottom();
    return typingEl;
}

/**
 * Removes typing indicator
 */
function removeTypingIndicator(typingEl) {
    if (typingEl && typingEl.parentNode) {
        typingEl.parentNode.removeChild(typingEl);
    }
}

/**
 * Enables/disables input controls
 */
function setInputEnabled(enabled) {
    promptInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    if (enabled) {
        promptInput.focus();
    }
}

/**
 * Scrolls chat to the bottom
 */
function scrollToBottom() {
    requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

/**
 * Fills input with suggestion text
 */
function useSuggestion(chipEl) {
    promptInput.value = chipEl.textContent;
    promptInput.focus();
}

/**
 * Downloads the generated image
 */
function downloadImage(url, prompt) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `imagigen-${prompt.substring(0, 30).replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
