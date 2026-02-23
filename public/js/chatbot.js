/**
 * Local Volunteer Hub AI Chatbot
 * Powered by OpenRouter API
 * Knows about the opportunities schema and all platform features
 */

const OPENROUTER_API_KEY = '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `You are VolunteerBot 🤝, a friendly and knowledgeable AI assistant for Local Volunteer Hub — a local volunteer hub platform that connects volunteers with organizations and meaningful opportunities.

You have deep knowledge of the platform's database schema and can help users understand and navigate volunteer opportunities.

## Platform Overview
Local Volunteer Hub is a modern, clean SaaS platform with a professional **light-themed aesthetic** (white/light gray backgrounds).
- **Core Colors**: Vibrant **Purple** (#6c47ff) primary and **Orange** (#ff6b35) call-to-action accents.
- **Goal**: To connect volunteers with local non-profit organizations simply and effectively.
- **Features**: 
  - Browse and apply for volunteer opportunities
  - Register as volunteers or as organizations
  - Track impact via a personal dashboard
  - Direct messaging with organizations
  - AI assistance (that's you!)

## Database Schema You Know About

### opportunities table
Each volunteer opportunity has the following fields:
- **id** (uuid): Unique identifier for each opportunity
- **organization_id** (uuid): References the organization posting the opportunity (linked to organizations table)
- **title** (text, required): Name/title of the volunteer opportunity
- **description** (text, required): Full description of what the volunteer will do
- **location** (text): Where the opportunity takes place (can be remote or an address)
- **date** (date): The specific date of the opportunity
- **start_time** (time): When the volunteer shift begins
- **end_time** (time): When the volunteer shift ends
- **slots_available** (integer): How many volunteers can sign up
- **status** (text): Either 'active' (currently accepting volunteers) or 'closed' (no longer available)
- **created_at** (timestamp): When the opportunity was posted

### Key Business Rules
- Only opportunities with status = 'active' are shown to volunteers by default
- Each opportunity belongs to one organization (via organization_id foreign key)
- When an organization is deleted, all their opportunities are also deleted (CASCADE)
- Opportunities can have limited slots — once full, they'd be marked 'closed'

### Organizations Table (referenced)
- Organizations post opportunities and manage volunteers
- Linked via organization_id in opportunities

## How to Help Users
- Answer questions about how to find and apply for opportunities
- Explain what fields mean (e.g., "slots_available tells you how many people can join")
- Guide users to use filters by location, date, or organization
- Explain the difference between active and closed opportunities
- Help users understand time commitments based on start_time and end_time
- Encourage volunteering and community involvement!

## Tone & Style
- Be warm, encouraging, and enthusiastic about volunteering 🌟
- Use emojis sparingly but effectively
- Keep responses concise but helpful
- If asked about something outside the platform, gently redirect to volunteering topics
- Always be supportive of users wanting to make a community difference

Remember: Your goal is to help people find meaningful volunteer work and understand how the platform works!`;

class VolunteerChatbot {
    constructor() {
        this.messages = [];
        this.isOpen = false;
        this.isTyping = false;
        this.init();
    }

    init() {
        this.injectHTML();
        this.injectCSS();
        this.bindEvents();
        this.addWelcomeMessage();
    }

    injectHTML() {
        const chatbotHTML = `
        <!-- AI Chatbot Widget -->
        <div id="chatbot-container" class="chatbot-container" role="complementary" aria-label="AI Volunteer Assistant">
            <!-- Toggle Button -->
            <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Open AI Assistant" title="Chat with VolunteerBot">
                <span class="chatbot-toggle-icon chatbot-icon-open">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </span>
                <span class="chatbot-toggle-icon chatbot-icon-close" style="display:none;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </span>
                <span class="chatbot-notif-dot" id="chatbot-notif-dot"></span>
            </button>

            <!-- Chat Window -->
            <div id="chatbot-window" class="chatbot-window" role="dialog" aria-label="Chat with VolunteerBot" aria-hidden="true">
                <!-- Header -->
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">🤝</div>
                        <div>
                            <div class="chatbot-name">VolunteerBot</div>
                            <div class="chatbot-status">
                                <span class="status-dot"></span>
                                AI Assistant · Always Online
                            </div>
                        </div>
                    </div>
                    <button class="chatbot-close-btn" id="chatbot-close-btn" aria-label="Close chat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <!-- Messages -->
                <div class="chatbot-messages" id="chatbot-messages" role="log" aria-live="polite">
                    <!-- Messages inserted here -->
                </div>

                <!-- Quick Suggestions -->
                <div class="chatbot-suggestions" id="chatbot-suggestions">
                    <button class="suggestion-chip" data-msg="What volunteer opportunities are available?">🔍 Find opportunities</button>
                    <button class="suggestion-chip" data-msg="How do I apply for a volunteering slot?">📝 How to apply</button>
                    <button class="suggestion-chip" data-msg="What does 'slots available' mean?">❓ Slots explained</button>
                    <button class="suggestion-chip" data-msg="How do I register as a volunteer?">🙋 Register as volunteer</button>
                </div>

                <!-- Input Area -->
                <div class="chatbot-input-area">
                    <div class="chatbot-input-wrapper">
                        <textarea 
                            id="chatbot-input" 
                            class="chatbot-input" 
                            placeholder="Ask me about volunteering opportunities..." 
                            rows="1"
                            aria-label="Type your message"
                            maxlength="500"
                        ></textarea>
                        <button id="chatbot-send" class="chatbot-send-btn" aria-label="Send message" disabled>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                    <div class="chatbot-footer-text">Powered by AI · Local Volunteer Hub</div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    injectCSS() {
        // CSS is in the main stylesheet (chatbot section)
        // This is here as a fallback check
    }

    bindEvents() {
        const toggleBtn = document.getElementById('chatbot-toggle');
        const closeBtn = document.getElementById('chatbot-close-btn');
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        const suggestionsContainer = document.getElementById('chatbot-suggestions');

        toggleBtn.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.closeChat());

        sendBtn.addEventListener('click', () => this.sendMessage());

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        input.addEventListener('input', () => {
            this.autoResize(input);
            sendBtn.disabled = input.value.trim() === '';
        });

        // Suggestion chips
        suggestionsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.suggestion-chip');
            if (chip) {
                const msg = chip.dataset.msg;
                input.value = msg;
                sendBtn.disabled = false;
                this.sendMessage();
                // Hide suggestions after first use
                suggestionsContainer.style.display = 'none';
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            const container = document.getElementById('chatbot-container');
            if (this.isOpen && !container.contains(e.target)) {
                this.closeChat();
            }
        });
    }

    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        const notifDot = document.getElementById('chatbot-notif-dot');
        const openIcon = toggle.querySelector('.chatbot-icon-open');
        const closeIcon = toggle.querySelector('.chatbot-icon-close');

        window.classList.add('open');
        window.setAttribute('aria-hidden', 'false');
        toggle.classList.add('active');
        openIcon.style.display = 'none';
        closeIcon.style.display = 'block';
        notifDot.style.display = 'none';

        this.isOpen = true;
        this.scrollToBottom();

        // Focus input
        setTimeout(() => {
            document.getElementById('chatbot-input').focus();
        }, 300);
    }

    closeChat() {
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        const openIcon = toggle.querySelector('.chatbot-icon-open');
        const closeIcon = toggle.querySelector('.chatbot-icon-close');

        window.classList.remove('open');
        window.setAttribute('aria-hidden', 'true');
        toggle.classList.remove('active');
        openIcon.style.display = 'block';
        closeIcon.style.display = 'none';

        this.isOpen = false;
    }

    addWelcomeMessage() {
        const welcomeMsg = `👋 Hi there! I'm **VolunteerBot**, your AI guide to finding amazing volunteer opportunities on Local Volunteer Hub!

I can help you:
• 🔍 Understand available opportunities
• 📅 Learn about dates, times & locations
• 🏢 Find out about organizations
• 📝 Know how to apply & register

What would you like to know?`;

        this.appendMessage('bot', welcomeMsg);

        // Show notification dot initially
        setTimeout(() => {
            const notifDot = document.getElementById('chatbot-notif-dot');
            if (notifDot && !this.isOpen) {
                notifDot.style.display = 'block';
            }
        }, 1500);
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const text = input.value.trim();

        if (!text || this.isTyping) return;

        // Clear input
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('chatbot-send').disabled = true;

        // Hide suggestions
        document.getElementById('chatbot-suggestions').style.display = 'none';

        // Add user message
        this.appendMessage('user', text);
        this.messages.push({ role: 'user', content: text });

        // Show typing indicator
        this.showTyping();

        try {
            const response = await this.callOpenRouter(text);
            this.hideTyping();

            if (response) {
                this.appendMessage('bot', response);
                this.messages.push({ role: 'assistant', content: response });

                // Keep conversation history to last 20 messages (10 exchanges)
                if (this.messages.length > 20) {
                    this.messages = this.messages.slice(-20);
                }
            }
        } catch (error) {
            this.hideTyping();
            console.error('Chatbot error:', error);
            this.appendMessage('bot', '⚠️ Sorry, I\'m having trouble connecting right now. Please try again in a moment!');
        }
    }

    async callOpenRouter(userMessage) {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Local Volunteer Hub AI Assistant'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...this.messages
                ],
                max_tokens: 500,
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('OpenRouter error:', err);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    }

    appendMessage(role, text) {
        const container = document.getElementById('chatbot-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-msg chatbot-msg-${role}`;

        const bubble = document.createElement('div');
        bubble.className = 'chatbot-bubble';

        // Render markdown-like formatting
        bubble.innerHTML = this.formatText(text);

        if (role === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'chatbot-msg-avatar';
            avatar.textContent = '🤝';
            msgDiv.appendChild(avatar);
        }

        msgDiv.appendChild(bubble);

        // Add timestamp
        const time = document.createElement('div');
        time.className = 'chatbot-msg-time';
        time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msgDiv.appendChild(time);

        container.appendChild(msgDiv);
        this.scrollToBottom();
    }

    formatText(text) {
        return text
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Bullet points: • or -
            .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
            // Wrap consecutive <li> in <ul>
            .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    showTyping() {
        this.isTyping = true;
        const container = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chatbot-msg chatbot-msg-bot';
        typingDiv.id = 'chatbot-typing';

        typingDiv.innerHTML = `
            <div class="chatbot-msg-avatar">🤝</div>
            <div class="chatbot-bubble chatbot-typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;

        container.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        const typingEl = document.getElementById('chatbot-typing');
        if (typingEl) typingEl.remove();
    }

    scrollToBottom() {
        const container = document.getElementById('chatbot-messages');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        }
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.volunteerBot = new VolunteerChatbot();
});
