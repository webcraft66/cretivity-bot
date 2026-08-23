// CerevityAI Partnership Assistant — vanilla JS chat client.
// Talks to /api/chat (a Vercel serverless function) which securely calls
// the Gemini API using a server-side GEMINI_API_KEY. No frameworks, no
// build step — just fetch().

const WELCOME_MESSAGE =
  "Hi there! 👋 I'm the CerevityAI Partnership Assistant. Ask me anything about our AI & Robotics education partnership program — curriculum, pricing, timelines, or what's included. How can I help?";

const SUGGESTED_REPLIES = [
  "What's included in the partnership?",
  "What does it cost?",
  "How is the curriculum structured?",
  "How is CerevityAI different from other vendors?",
];

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("composerInput");
const sendBtn = document.getElementById("sendBtn");
const resetBtn = document.getElementById("resetBtn");

// In-memory conversation history: [{ role: 'user'|'assistant', content }]
let history = [];
let isSending = false;

function timeNow() {
  return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Tiny markdown-lite renderer: **bold**, "- " bullet lists, paragraphs.
function renderContent(container, text) {
  const blocks = text.split(/\n{2,}/);
  blocks.forEach((block) => {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()));

    if (isList) {
      const ul = document.createElement("ul");
      lines.forEach((line) => {
        const li = document.createElement("li");
        renderInline(li, line.replace(/^[-*]\s+/, ""));
        ul.appendChild(li);
      });
      container.appendChild(ul);
    } else {
      const p = document.createElement("p");
      lines.forEach((line, j) => {
        renderInline(p, line);
        if (j < lines.length - 1) p.appendChild(document.createElement("br"));
      });
      container.appendChild(p);
    }
  });
}

function renderInline(container, line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      container.appendChild(strong);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function addBubble({ role, content, isError }) {
  const row = document.createElement("div");
  row.className = "row" + (role === "user" ? " user" : "");

  const avatar = document.createElement("div");
  if (role === "user") {
    avatar.className = "avatar-user";
    avatar.textContent = "You";
  } else {
    avatar.className = "avatar-mini";
    avatar.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M24 12c-3.6 0-6.2 2.1-6.9 5-2.6.4-4.6 2.6-4.6 5.2 0 1 .3 1.9.8 2.7-.9.8-1.5 2-1.5 3.3 0 2.4 2 4.4 4.5 4.5.6 1.8 2.4 3.1 4.4 3.1.9 0 1.7-.2 2.4-.7M24 12c3.6 0 6.2 2.1 6.9 5 2.6.4 4.6 2.6 4.6 5.2 0 1-.3 1.9-.8 2.7.9.8 1.5 2 1.5 3.3 0 2.4-2 4.4-4.5 4.5-.6 1.8-2.4 3.1-4.4 3.1-.9 0-1.7-.2-2.4-.7" stroke="#5B8CFF" stroke-width="1.8" stroke-linecap="round"/><circle cx="24" cy="18" r="1.6" fill="#22D3EE"/><circle cx="24" cy="30.5" r="1.6" fill="#22D3EE"/></svg>';
  }

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble " + (role === "user" ? "user" : isError ? "error" : "assistant");
  renderContent(bubble, content);

  const ts = document.createElement("span");
  ts.className = "timestamp";
  ts.textContent = timeNow();

  wrap.appendChild(bubble);
  wrap.appendChild(ts);
  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "row typing";
  row.id = "typingRow";
  row.innerHTML =
    '<div class="avatar-mini"><svg width="16" height="16" viewBox="0 0 48 48" fill="none"><path d="M24 12c-3.6 0-6.2 2.1-6.9 5-2.6.4-4.6 2.6-4.6 5.2 0 1 .3 1.9.8 2.7-.9.8-1.5 2-1.5 3.3 0 2.4 2 4.4 4.5 4.5.6 1.8 2.4 3.1 4.4 3.1.9 0 1.7-.2 2.4-.7M24 12c3.6 0 6.2 2.1 6.9 5 2.6.4 4.6 2.6 4.6 5.2 0 1-.3 1.9-.8 2.7.9.8 1.5 2 1.5 3.3 0 2.4-2 4.4-4.5 4.5-.6 1.8-2.4 3.1-4.4 3.1-.9 0-1.7-.2-2.4-.7" stroke="#5B8CFF" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
    '<div class="bubble-wrap"><div class="bubble assistant"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-label">CerevityAI is typing...</span></div></div>';
  messagesEl.appendChild(row);
  scrollToBottom();
}

function removeTyping() {
  const el = document.getElementById("typingRow");
  if (el) el.remove();
}

function renderSuggestedChips() {
  const existing = document.getElementById("chips");
  if (existing) existing.remove();

  const chips = document.createElement("div");
  chips.className = "chips";
  chips.id = "chips";
  SUGGESTED_REPLIES.forEach((text) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.textContent = text;
    btn.addEventListener("click", () => {
      if (isSending) return;
      sendMessage(text);
    });
    chips.appendChild(btn);
  });
  messagesEl.appendChild(chips);
  scrollToBottom();
}

function setSending(state) {
  isSending = state;
  sendBtn.disabled = state || inputEl.value.trim().length === 0;
  document.querySelectorAll(".chip").forEach((c) => (c.disabled = state));
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || isSending) return;

  document.getElementById("chips")?.remove();

  addBubble({ role: "user", content: trimmed });
  history.push({ role: "user", content: trimmed });
  inputEl.value = "";
  inputEl.style.height = "auto";
  setSending(true);
  addTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore parse errors, handled below */
    }

    removeTyping();

    if (!res.ok) {
      const errText =
        (data && data.error) ||
        "Something went wrong while contacting CerevityAI Partnership Assistant. Please try again.";
      addBubble({ role: "assistant", content: errText, isError: true });
      return;
    }

    addBubble({ role: "assistant", content: data.reply });
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    removeTyping();
    addBubble({
      role: "assistant",
      content: "We couldn't reach CerevityAI Partnerships right now. Please check your connection and try again.",
      isError: true,
    });
  } finally {
    setSending(false);
  }
}

function resetChat() {
  history = [];
  messagesEl.innerHTML = "";
  addBubble({ role: "assistant", content: WELCOME_MESSAGE });
  renderSuggestedChips();
}

// Composer behavior
inputEl.addEventListener("input", () => {
  sendBtn.disabled = isSending || inputEl.value.trim().length === 0;
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage(inputEl.value);
  }
});
sendBtn.addEventListener("click", () => sendMessage(inputEl.value));
resetBtn.addEventListener("click", resetChat);

// Init
resetChat();
