/**
 * Education Analyst Agent Logic
 */

// --- System Prompt Configuration ---
const SYSTEM_PROMPT = `
你是一名资深的教育行业数据分析师 Agent，长期服务于在线教育与成人教育公司。
始终使用中文以专业、清晰的语气回复用户。

你的核心目标是：
通过数据分析，帮助业务负责人和管理层理解业务现状、识别关键问题，并给出可执行的决策建议。

你不只是计算指标，而是：
- 理解教育行业的业务逻辑
- 判断哪些数据“重要”，哪些只是噪音
- 用业务语言解释数据结论
- 主动发现风险与结构性问题

如果信息不足，你必须先提问，而不是做假设。

你的分析必须严格遵循以下流程，不可跳步：

Step 1 明确业务问题
- 当前业务目标是什么？
- 这是增长问题、效率问题，还是结构问题？

Step 2 明确数据口径
- 指标定义是否清晰？
- 时间范围、用户范围、产品范围是否一致？

Step 3 提出分析假设
- 至少提出 2 到 3 个可能假设
- 明确每个假设需要用什么数据验证

Step 4 进行分析
- 使用合适的分析方法（对比、拆分、趋势、分层、漏斗等）
- 避免过度复杂模型

Step 5 得出结论
- 区分：数据事实 与 推断结论
- 明确不确定性

Step 6 业务解释
- 站在教育业务负责人的视角解释“为什么会这样”

Step 7 决策建议
- 给出可执行建议
- 说明预期收益与潜在风险

在教育行业分析中，请始终优先考虑以下维度：

1. 用户分层
- 新用户 vs 老用户
- 首次付费 vs 续费用户
- 高客单 vs 低客单

2. 单位经济模型
- 单用户获客成本
- 单用户生命周期价值（LTV）
- 是否存在“规模越大亏得越多”的情况

3. 转化链路
- 线索 → 到课 → 成单 → 续费
- 哪一环是真正瓶颈？

4. 时间滞后
- 教育效果往往不是即时反馈
- 避免短期指标误导长期决策

【输出格式要求】

【业务背景】
（用 2 到 3 句话复述你理解的业务问题）

【核心结论】
1.
2.
3.

【关键数据事实】
- 数据点 A
- 数据点 B

【可能原因分析】
- 原因 1
- 原因 2

【业务风险与不确定性】
- 风险 1
- 风险 2

【建议行动】
- 建议 1（短期）
- 建议 2（中期）

你需要在分析过程中维护以下状态，并随分析进展更新（在回答的最后附上）：

- 当前业务目标：
- 已确认指标：
- 已验证假设：
- 未验证假设：
- 当前最关键风险：
`;

// --- State Management ---
const state = {
  provider: localStorage.getItem('edu_agent_provider') || 'openai',
  apiKey: '', // Will be loaded from provider-specific key
  baseUrl: localStorage.getItem('edu_agent_base_url') || 'https://api.openai.com/v1',
  model: localStorage.getItem('edu_agent_model') || 'gpt-4o',
  fileContent: null,
  fileName: null,
  abortController: null, // Controller for fetch requests
  // Session Management
  currentSessionId: null,
  sessions: [], // Array of { id, title, messages, timestamp }
  messages: [] // Current active messages (synced with currentSession)
};

// Provider-specific API Keys initialization
const PROVIDER_KEYS = {
  openai: localStorage.getItem('edu_agent_api_key_openai') || '',
  deepseek: localStorage.getItem('edu_agent_api_key_deepseek') || 'sk-59960803cd354da289cd40a1717a66f1',
  gemini: localStorage.getItem('edu_agent_api_key_gemini') || '',
  custom: localStorage.getItem('edu_agent_api_key_custom') || ''
};
state.apiKey = PROVIDER_KEYS[state.provider] || '';

// --- DOM Elements ---
const elements = {
  chatContainer: document.getElementById('chat-container'),
  paramForm: {
    provider: document.getElementById('provider-select'),
    apiKey: document.getElementById('api-key'),
    baseUrl: document.getElementById('base-url'),
    model: document.getElementById('model-name'),
    saveBtn: document.getElementById('save-settings')
  },
  chatForm: {
    input: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'), // Added stopBtn
    fileInput: document.getElementById('file-input'),
    uploadBtn: document.getElementById('upload-btn'),
    filePreview: document.getElementById('file-preview')
  },
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  // History UI
  newChatBtn: document.getElementById('new-chat-btn'),
  historyList: document.getElementById('history-list')
};

// --- Initialization ---
function init() {
  // Load settings into inputs
  elements.paramForm.provider.value = state.provider;
  elements.paramForm.apiKey.value = state.apiKey;
  elements.paramForm.baseUrl.value = state.baseUrl;
  elements.paramForm.model.value = state.model;

  updateStatus();

  // Welcome message
  addMessage('system', '欢迎使用教育行业数据分析师 Agent。\n请在设置栏配置 API Key，然后输入您的业务背景或数据问题。');

  // Event Listeners
  elements.paramForm.provider.addEventListener('change', handleProviderChange);
  elements.paramForm.saveBtn.addEventListener('click', saveSettings);
  elements.chatForm.sendBtn.addEventListener('click', handleUserMessage);
  elements.chatForm.stopBtn.addEventListener('click', () => {
    if (state.abortController) {
      state.abortController.abort();
      // Optional: Visual feedback or just let the error handler cleanup
    }
  });

  elements.chatForm.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage();
    }
  });

  elements.chatForm.uploadBtn.addEventListener('click', () => {
    elements.chatForm.fileInput.click();
  });

  elements.chatForm.fileInput.addEventListener('change', handleFileSelect);

  // New Chat & History Events
  elements.newChatBtn.addEventListener('click', () => createNewSession());

  // Load Sessions
  loadSessionsFromStorage();
}

// --- Session Management Logic ---

function loadSessionsFromStorage() {
  try {
    const stored = localStorage.getItem('edu_agent_sessions');
    if (stored) {
      state.sessions = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load sessions', e);
    state.sessions = [];
  }

  // Check for any "New Chat" sessions that actually have user messages and fix their titles retroactively
  let sessionsChanged = false;
  state.sessions.forEach(session => {
    if (session.title === 'New Chat' || session.title === '新对话') { // Covering potential defaults
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        let title = firstUserMsg.content.trim().slice(0, 20);
        title = title.split('\n')[0];
        if (title.length > 0) {
          session.title = title;
          sessionsChanged = true;
        }
      }
    }
  });

  if (sessionsChanged) {
    saveSessionsToStorage();
  }

  // If no sessions, create one. If prompt exists, load most recent.
  if (state.sessions.length === 0) {
    createNewSession();
  } else {
    // Load the most recent one (first in list usually if sorted, but let's just take index 0)
    // Actually, let's sort by timestamp desc
    state.sessions.sort((a, b) => b.timestamp - a.timestamp);
    loadSession(state.sessions[0].id);
  }
}

function saveSessionsToStorage() {
  localStorage.setItem('edu_agent_sessions', JSON.stringify(state.sessions));
  renderHistoryList();
}

function createNewSession() {
  const newId = Date.now().toString();
  const session = {
    id: newId,
    title: 'New Chat',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    timestamp: Date.now()
  };

  state.sessions.unshift(session); // Add to top
  state.currentSessionId = newId;
  state.messages = [...session.messages]; // Clone

  saveSessionsToStorage();
  renderChatUI(); // Clear UI and show welcome
  updateStatus();
}

function loadSession(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;

  state.currentSessionId = id;
  state.messages = [...session.messages]; // Clone to state

  renderChatUI();
  renderHistoryList(); // Update active class
}

function deleteSession(id, event) {
  event.stopPropagation(); // Prevent triggering loadSession
  if (!confirm('确定要删除这条对话吗？')) return;

  state.sessions = state.sessions.filter(s => s.id !== id);
  saveSessionsToStorage();

  // If we deleted the active one, load another or create new
  if (state.currentSessionId === id) {
    if (state.sessions.length > 0) {
      loadSession(state.sessions[0].id);
    } else {
      createNewSession();
    }
  }
}

function updateCurrentSession() {
  if (!state.currentSessionId) return;

  const sessionIndex = state.sessions.findIndex(s => s.id === state.currentSessionId);
  if (sessionIndex === -1) return;

  // Sync state messages to session
  const session = state.sessions[sessionIndex];
  session.messages = [...state.messages];
  // We update timestamp but we WONT move it to top anymore to keep stable order
  session.timestamp = Date.now();

  // Auto-title if it's "New Chat" (or default) and we have user messages
  const firstUserMsg = state.messages.find(m => m.role === 'user');
  if (firstUserMsg && (session.title === 'New Chat' || session.title === '新对话')) {
    // Take first 20 chars
    let title = firstUserMsg.content.trim().slice(0, 20);
    // Remove attachment tag/newlines
    title = title.split('\n')[0];
    if (title.length === 0) title = 'Image/File';
    session.title = title;
  }

  saveSessionsToStorage();
}

function renderHistoryList() {
  elements.historyList.innerHTML = '';

  // Sort by ID (Creation Time) Descending
  // Since ID is Date.now(), string comparison works for length, but safe to subtract
  const sortedSessions = [...state.sessions].sort((a, b) => b.id - a.id);

  sortedSessions.forEach(session => {
    const div = document.createElement('div');
    div.className = `history-item ${session.id === state.currentSessionId ? 'active' : ''}`;
    div.onclick = () => loadSession(session.id);

    div.innerHTML = `
      <div class="history-title">${session.title}</div>
      <div class="delete-btn" onclick="deleteSession('${session.id}', event)">×</div>
    `;
    elements.historyList.appendChild(div);
  });
}

function renderChatUI() {
  elements.chatContainer.innerHTML = '';
  // Re-render messages
  state.messages.forEach(msg => {
    if (msg.role === 'system') return; // Don't show system prompt

    // For reasoning messages, we might need special handling if we saved them fully
    // But currently we save flat content.
    // Wait, we generate reasoning separately in UI. 
    // If we want to restore reasoning UI, we need to save it in structure.
    // For now, standard messages.

    // If the content contains the "Thought" split we used in streaming?
    // Actually our streaming logic pushes {content: fullResponse} to state.messages. 
    // It does NOT lose the reasoning content if it was part of the string.
    // BUT deepseek reasoning content is usually separate. 
    // Let's check handleUserMessage: 
    // state.messages.push({ role: 'assistant', content: fullResponse || fullReasoning });

    // If it's mixed, markdown renders it.
    // We should probably optimize addMessage to support existing messages.
    addMessage(msg.role === 'assistant' ? 'agent' : 'user', msg.content);
  });

  if (state.messages.length <= 1) {
    addMessage('system', '欢迎使用教育行业数据分析师 Agent。\n请在左侧新建对话或选择历史记录。');
  }

  scrollToBottom();
}

function saveSettings() {
  const newProvider = elements.paramForm.provider.value;
  const newKey = elements.paramForm.apiKey.value.trim();
  const newUrl = elements.paramForm.baseUrl.value.trim();
  const newModel = elements.paramForm.model.value.trim();

  if (!newKey) {
    alert('请输入有效的 API Key');
    return;
  }

  state.provider = newProvider;
  state.apiKey = newKey;
  state.baseUrl = newUrl;
  state.model = newModel;

  // Save current key to provider-specific storage
  PROVIDER_KEYS[state.provider] = newKey;
  localStorage.setItem(`edu_agent_api_key_${state.provider}`, newKey);

  localStorage.setItem('edu_agent_provider', state.provider);
  localStorage.setItem('edu_agent_base_url', state.baseUrl);
  localStorage.setItem('edu_agent_model', state.model);

  updateStatus();
  alert('设置已保存');
}

function updateStatus() {
  if (state.apiKey) {
    elements.statusDot.classList.add('active');
    elements.statusText.textContent = 'API 已配置';
  } else {
    elements.statusDot.classList.remove('active');
    elements.statusText.textContent = 'API 未配置';
  }
}

function handleProviderChange() {
  const provider = elements.paramForm.provider.value;

  // Switch API Key to the new provider's key
  elements.paramForm.apiKey.value = PROVIDER_KEYS[provider] || '';
  state.apiKey = PROVIDER_KEYS[provider] || '';

  switch (provider) {
    case 'openai':
      elements.paramForm.baseUrl.value = 'https://api.openai.com/v1';
      elements.paramForm.model.value = 'gpt-4o';
      break;
    case 'deepseek':
      elements.paramForm.baseUrl.value = 'https://api.deepseek.com';
      elements.paramForm.model.value = 'deepseek-chat';
      break;
    case 'gemini':
      elements.paramForm.baseUrl.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
      elements.paramForm.model.value = 'gemini-1.5-flash';
      break;
    case 'zhipu':
      elements.paramForm.baseUrl.value = 'https://open.bigmodel.cn/api/paas/v4';
      elements.paramForm.model.value = 'glm-4';
      break;
    case 'custom':
      // Do not clear, let user edit
      break;
  }

  // Show/Hide Search Config
  const searchContainer = document.getElementById('search-config-container');
  const zhipuConfig = document.getElementById('zhipu-search-config');
  const geminiConfig = document.getElementById('gemini-search-config');

  // Default to hidden, reveal based on provider
  searchContainer.style.display = 'none';
  zhipuConfig.style.display = 'none';
  geminiConfig.style.display = 'none';

  if (provider === 'zhipu') {
    searchContainer.style.display = 'block';
    zhipuConfig.style.display = 'block';
  } else if (provider === 'gemini') {
    searchContainer.style.display = 'block';
    geminiConfig.style.display = 'block';
  }

  // Update Deep Thinking Checkbox Behavior/Text if needed
  // For DeepSeek, it toggles model. For others, it's prompt.
  updateStatus();
}

function getEffectiveModel() {
  const provider = elements.paramForm.provider.value;
  const isReasoning = document.getElementById('reasoning-enable').checked;
  let model = state.model; // usage of UI value logic might be needed here, or state.model is raw

  // Override model for DeepSeek if Reasoning is ON
  if (provider === 'deepseek') {
    return isReasoning ? 'deepseek-reasoner' : 'deepseek-chat';
  }
  return model;
}

function setGenerationState(isGenerating) {
  if (isGenerating) {
    elements.chatForm.sendBtn.style.display = 'none';
    elements.chatForm.stopBtn.style.display = 'flex';
    elements.chatForm.input.disabled = true;
  } else {
    elements.chatForm.sendBtn.style.display = 'flex';
    elements.chatForm.stopBtn.style.display = 'none';
    elements.chatForm.input.disabled = false;
    elements.chatForm.input.focus();
    state.abortController = null;
  }
}

// --- Session Management Helpers ---
function safeSwitchSession() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
}

// Re-write handleUserMessage with Safe Session Logic + Real-time Sync
async function handleUserMessage() {
  const targetSessionId = state.currentSessionId;
  if (!targetSessionId) {
    alert("请先选择或新建一个对话");
    return;
  }

  // Auto-save settings
  state.provider = elements.paramForm.provider.value;
  state.apiKey = elements.paramForm.apiKey.value.trim();
  state.baseUrl = elements.paramForm.baseUrl.value.trim();
  state.model = elements.paramForm.model.value.trim();

  PROVIDER_KEYS[state.provider] = state.apiKey;
  localStorage.setItem(`edu_agent_api_key_${state.provider}`, state.apiKey);
  localStorage.setItem('edu_agent_provider', state.provider);
  localStorage.setItem('edu_agent_base_url', state.baseUrl);
  localStorage.setItem('edu_agent_model', state.model);
  updateStatus();

  const text = elements.chatForm.input.value.trim();
  const file = elements.chatForm.fileInput.files[0];

  if (!text && !file) {
    alert('请输入内容或上传文件');
    return;
  }

  // Handle File
  let fileContentStr = '';
  if (file) {
    if (state.fileContent) {
      fileContentStr = `\n\n[Attachment: ${state.fileName}]\n${state.fileContent}\n\n`;
    }
  }
  const displayContent = text + (state.fileName ? `\n[文件: ${state.fileName}]` : '');
  const finalText = text + fileContentStr;

  // Clear Input UI
  elements.chatForm.input.value = '';
  elements.chatForm.fileInput.value = '';
  elements.chatForm.filePreview.innerHTML = '';
  state.fileContent = null;
  state.fileName = null;

  // 1. Update Session Data
  const sessionObj = state.sessions.find(s => s.id === targetSessionId);
  if (!sessionObj) return;

  sessionObj.messages.push({ role: 'user', content: finalText });
  // Placeholder for Agent
  const agentMsg = { role: 'assistant', content: '' };
  sessionObj.messages.push(agentMsg);

  // 2. Sync Global State if active
  if (state.currentSessionId === targetSessionId) {
    state.messages = [...sessionObj.messages];
    addMessage('user', displayContent);
  }

  saveSessionsToStorage(); // Initial Save
  setGenerationState(true);

  // Prepare Payload
  const apiMessages = sessionObj.messages.slice(0, -1);
  // ... (Prompt Injection omitted for brevity, assume simple append if needed)
  if (state.provider !== 'deepseek' && document.getElementById('reasoning-enable').checked) {
    apiMessages[apiMessages.length - 1].content += "\n\n(请进行深度思考，一步步分析。)";
  }

  const effectiveModel = getEffectiveModel();
  const payload = {
    model: effectiveModel,
    messages: apiMessages,
    temperature: 0.7,
    stream: true
  };

  // Zhipu Search
  if (state.provider === 'zhipu' && document.getElementById('zhipu-search-enable').checked) {
    payload.tools = [{ type: "web_search", web_search: { enable: true, search_result: true } }];
  }

  state.abortController = new AbortController();
  const signal = state.abortController.signal;

  try {
    let fullResponse = '';
    let fullReasoning = '';
    let currentDivId = null;

    const onStreamChunk = (chunk, isReasoning) => {
      // A. Update Data (Always)
      if (isReasoning) {
        fullReasoning += chunk;
      } else {
        fullResponse += chunk;
      }

      let savedContent = fullResponse;
      if (fullReasoning) {
        savedContent = `> **思维过程**\n> ${fullReasoning.replace(/\n/g, '\n> ')}\n\n${fullResponse}`;
      }
      agentMsg.content = savedContent;
      // Real-time save throttle could be added here, but saving on every chunk is safe for localStorage text
      // For performance, maybe throttle saving? Let's save every 50 chunks or on finish?
      // Actually, user wants real-time safety. Let's just update object reference.
      // We call saveSessionsToStorage() at end. 
      // But if user aborts/switches, we need intermediate save? 
      // We will call saveSessionsToStorage() in finally block.

      // B. Update UI (Only if active)
      if (state.currentSessionId === targetSessionId) {
        if (!currentDivId) {
          currentDivId = addMessage('agent', '');
        }
        const msgDiv = document.getElementById(currentDivId);
        if (msgDiv) {
          const bodyDiv = msgDiv.querySelector('.message-body');

          // Render Logic supporting Reasoning Block
          let html = '';

          // Simple Reasoning UI Render
          if (fullReasoning) {
            // Check if we strictly need accordion or just quote
            // User mentioned "Garbled" -> Stick to simple Blockquote for now to be safe?
            // Or standard markdown quote.
            html += `<blockquote class="reasoning-block" style="border-left: 3px solid #6b7280; padding-left: 1rem; color: #4b5563; background: #f9fafb; margin-bottom: 10px;"><strong style="font-size:0.85em">思维过程</strong><br/>${fullReasoning.replace(/\n/g, '<br/>')}</blockquote>`;
          }

          if (window.markdownit) {
            const md = window.markdownit({ html: true, breaks: true });
            html += md.render(fullResponse);
          } else {
            html += fullResponse; // text fallback
          }

          bodyDiv.innerHTML = html;

          // Conditional Scroll: Only if near bottom?
          // Simple fix: Check if user is scrolling up?
          // For now, let's just scroll to bottom to ensure they see new content as requested.
          scrollToBottom();
        }
      }
    };

    if (state.provider === 'gemini' && document.getElementById('gemini-search-enable').checked) {
      await callGeminiNativeStream(apiMessages, signal, (text) => onStreamChunk(text, false));
    } else {
      // FIX: Pass apiMessages (Array), NOT payload (Object)
      await callApiStream(apiMessages, signal, onStreamChunk);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      if (state.currentSessionId === targetSessionId) addMessage('system', '生成已停止。');
    } else {
      console.error(error);
      if (state.currentSessionId === targetSessionId) addMessage('system', `Error: ${error.message}`);
    }
  } finally {
    setGenerationState(false);
    saveSessionsToStorage(); // Ensure everything is saved
  }
}



function addErrorMessage(text, showRetry) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message system error';

  const content = document.createElement('div');
  content.className = 'message-body';
  content.style.backgroundColor = '#fef2f2';
  content.style.borderColor = '#fee2e2';
  content.style.color = '#ef4444';

  content.innerHTML = `<strong>⚠️ ${text}</strong>`;

  if (showRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '🔄 Retry';
    retryBtn.className = 'btn';
    retryBtn.style.backgroundColor = '#fff';
    retryBtn.style.border = '1px solid #ef4444';
    retryBtn.style.color = '#ef4444';
    retryBtn.style.marginTop = '0.5rem';
    retryBtn.style.padding = '0.25rem 0.75rem';
    retryBtn.style.fontSize = '0.75rem';
    retryBtn.onclick = () => retryLastMessage(msgDiv);
    content.appendChild(document.createElement('br'));
    content.appendChild(retryBtn);
  }

  msgDiv.appendChild(content);
  elements.chatContainer.appendChild(msgDiv);
  scrollToBottom();
}

async function retryLastMessage(errorElement) {
  if (errorElement) errorElement.remove();

  const lastUserMsg = state.messages[state.messages.length - 1];
  if (!lastUserMsg || lastUserMsg.role !== 'user') {
    alert('No message to retry');
    return;
  }

  elements.chatForm.sendBtn.disabled = true;

  const agentMsgId = addMessage('agent', '');
  const agentMsgBody = document.querySelector(`#${agentMsgId} .message-body`);
  let fullResponse = '';

  try {
    // FIX: Pass (messages, signal, onChunk) structure
    // Since retry doesn't easily support AbortController here without rework, we pass null signal or a temporary one.
    // Let's just create a temp controller.
    const controller = new AbortController();

    await callApiStream(state.messages, controller.signal, (chunk, isReasoning) => {
      // Retry Logic usually doesn't need DeepSeek reasoning separation as it's a quick fix?
      // Actually, if we retry, we might get reasoning.
      // But for simplicity in retryLastMessage, let's just dump everything to text.
      if (isReasoning) {
        fullResponse += chunk; // Merging reasoning into response for simple retry display
      } else {
        fullResponse += chunk;
      }

      if (window.markdownit) {
        agentMsgBody.innerHTML = window.markdownit({ html: true }).render(fullResponse);
      } else {
        agentMsgBody.textContent = fullResponse;
      }
      scrollToBottom();
    });

    state.messages.push({ role: 'assistant', content: fullResponse });

  } catch (error) {
    if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
      addErrorMessage('Rate Limit Exceeded (HTTP 429). Please wait a moment and try again.', true);
    } else {
      addErrorMessage(`Error: ${error.message}`, true);
    }
    console.error(error);
    if (!fullResponse) {
      document.getElementById(agentMsgId)?.remove();
    }
  } finally {
    elements.chatForm.sendBtn.disabled = false;
  }
}

async function callApiStream(messages, signal, onChunk) {
  const url = `${state.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const effectiveModel = getEffectiveModel();

  // Create a copy of messages to avoid mutating state directly
  let apiMessages = [...messages];

  // If Reasoning is enabled and NOT DeepSeek (DeepSeek handles it via model change), 
  // inject prompt instruction.
  const isReasoning = document.getElementById('reasoning-enable').checked;
  if (isReasoning && state.provider !== 'deepseek') {
    // Check if last message is user
    const lastMsg = apiMessages[apiMessages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      // Clone it to modify content
      // Note: We prepend a System hint instead of appending to user message to prevent
      // specific models from echoing the user's "last words".
      // OR we insert a system message if one exists.

      const sysIndex = apiMessages.findIndex(m => m.role === 'system');
      if (sysIndex !== -1) {
        apiMessages[sysIndex] = {
          ...apiMessages[sysIndex],
          content: apiMessages[sysIndex].content + "\n\n【重要指令】请对用户的问题进行深度思考，并在回答开头简要说明你的推理过程（可以以“我的思考：”开头），然后再给出最终答案。"
        };
      } else {
        // Fallback to appending to user if no system prompt (unlikely)
        apiMessages[apiMessages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + "\n\n(请进行深度思考，一步步分析。)"
        };
      }
    }
  }

  const payload = {
    model: effectiveModel,
    messages: apiMessages,
    temperature: 0.7,
    stream: true
  };

  // Add Zhipu Web Search Tool if enabled
  if (state.provider === 'zhipu') {
    const enableSearch = document.getElementById('zhipu-search-enable').checked;
    if (enableSearch) {
      payload.tools = [{
        type: "web_search",
        web_search: {
          enable: true,
          search_result: true
        }
      }];
    }
  }

  // Inject Search Hint into system prompt if Zhipu + Search enabled
  // (We already handle system prompt modification above, let's merge logic if possible or just run sequential)
  if (state.provider === 'zhipu' && document.getElementById('zhipu-search-enable').checked) {
    const sysIndex = apiMessages.findIndex(m => m.role === 'system');
    if (sysIndex !== -1) {
      // It might have been modified by reasoning already, so take the potentially modified one
      apiMessages[sysIndex] = {
        ...apiMessages[sysIndex],
        content: apiMessages[sysIndex].content + "\n\n[注意：你可以使用联网搜索工具获取最新信息。即便你记得截止日期，也请尝试搜索最新数据来回答。]"
      };
    }
  }

  // Gemini Search logic handled in callGeminiNativeStream wrapper/divert logic
  // but if we are here, we are doing standard OpenAI-compat call.
  // We removed the partial gemini check here as it's now diverted in handleUserMessage

  console.log('API Request (Stream):', { url, payload });

  // Note: callGeminiNativeStream divert logic removed from here as it's now in handleUserMessage

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify(payload),
    signal: signal
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status} at ${url}`;
    try {
      const errorData = await res.json();
      if (errorData.error?.message) {
        errorMsg = errorData.error.message;
      }
    } catch (e) { }
    throw new Error(errorMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunkValue = decoder.decode(value, { stream: true });

    buffer += chunkValue;
    const lines = buffer.split('\n');

    // Keep the last line in the buffer if it's potentially incomplete
    // (unless we are done, in which case we process everything)
    buffer = !done ? lines.pop() : '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

      if (trimmedLine.startsWith('data: ')) {
        const dataStr = trimmedLine.replace('data: ', '').trim();
        try {
          const data = JSON.parse(dataStr);
          // Handle standard content
          const content = data.choices[0]?.delta?.content || '';
          // Handle DeepSeek reasoning_content if present (optional support)
          const reasoning = data.choices[0]?.delta?.reasoning_content || '';

          if (content || reasoning) {
            if (reasoning) {
              onChunk(reasoning, true);
            }
            if (content) {
              onChunk(content, false);
            }
          }
        } catch (e) {
          // ensure we don't crash on bad json
          console.warn('Error parsing JSON:', e);
        }
      }
    }
  }
}

// --- File Handling ---

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Max 50MB
  if (file.size > 50 * 1024 * 1024) {
    alert('文件大小不能超过 50MB');
    e.target.value = '';
    return;
  }

  state.fileName = file.name;
  updateFilePreview(true, 'Reading file...');

  try {
    let content = '';
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'pdf') {
      content = await parsePDF(file);
    } else if (['docx', 'doc'].includes(ext)) {
      content = await parseDocx(file);
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      content = await parseExcel(file);
    } else {
      content = await parseText(file);
    }

    state.fileContent = content;
    updateFilePreview(false, file.name);
  } catch (err) {
    console.error(err);
    alert('解析文件失败: ' + err.message);
    clearFile();
  }
}

function updateFilePreview(isLoading, text) {
  if (!state.fileName && !isLoading) {
    elements.chatForm.filePreview.innerHTML = '';
    return;
  }

  elements.chatForm.filePreview.innerHTML = `
    <div class="file-tag">
        <span>${isLoading ? '⏳' : '📎'} ${text}</span>
        ${!isLoading ? '<span class="file-remove" onclick="clearFile()">×</span>' : ''}
    </div>
  `;
}

// Make clearFile global so onclick works
window.clearFile = function () {
  state.fileContent = null;
  state.fileName = null;
  elements.chatForm.fileInput.value = '';
  updateFilePreview(false);
};

// Native Gemini API Support for Grounding
async function callGeminiNativeStream(messages, onChunk, signal) {
  // Translate OpenAI messages to Gemini Content format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // Construct URL (Native API)
  // Base URL might be "https://generativelanguage.googleapis.com/v1beta/openai" from default
  // We need "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent"
  // We'll attempt to derive it or rely on user having set a suitable base or just hardcode/replace standard base.
  // Exception: If user set a custom proxy in Base URL, we should respect it.

  let baseUrl = state.baseUrl;
  // If it contains "openai", strip it to find root, or just replace /v1beta/openai...
  // Simple heuristic: If it ends in /openai, remove it.
  baseUrl = baseUrl.replace(/\/openai\/?$/, '');
  // If no /v1beta, add it? Let's assume user put a clean root if custom.
  // For default "https://generativelanguage.googleapis.com/v1beta/openai", it becomes ".../v1beta"

  const model = state.model || 'gemini-1.5-flash';
  const url = `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${state.apiKey}`;

  const payload = {
    contents: contents,
    tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: "dynamic", dynamic_threshold: 0.3 } } }],
    generationConfig: { temperature: 0.7 }
  };

  console.log('Gemini Native Request:', { url, payload });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: signal
  });

  if (!res.ok) throw new Error(`Gemini Native Error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    const chunkValue = decoder.decode(value, { stream: true });
    buffer += chunkValue;
    const lines = buffer.split('\n');
    buffer = !done ? lines.pop() : '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.replace('data: ', '').trim();
        if (dataStr === '[DONE]') return;
        try {
          const data = JSON.parse(dataStr);
          const p = data.candidates?.[0]?.content?.parts?.[0];
          if (p && p.text) {
            onChunk(p.text);
          }
        } catch (e) { }
      }
    }
  }
}

// --- Parsers ---

function parseText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const context = await page.getTextContent();
    text += context.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

async function parseDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  return result.value;
}

async function parseExcel(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let text = '';

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    text += `Sheet: ${sheetName}\n`;
    text += XLSX.utils.sheet_to_csv(sheet);
    text += '\n\n';
  });
  return text;
}

// --- UI Rendering ---

function addMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'user' ? 'U' : (role === 'agent' ? 'A' : 'S');

  const name = document.createElement('div');
  name.className = 'message-name';
  name.textContent = role === 'user' ? 'User' : (role === 'agent' ? 'Education Analyst' : 'System');

  headerDiv.appendChild(avatar);
  headerDiv.appendChild(name);

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'message-body markdown-body';

  // Render Markdown using markdown-it (assumed loaded globally from index.html)
  // Render Markdown using markdown-it (assumed loaded globally from index.html)
  if (window.markdownit) {
    try {
      const md = window.markdownit({ html: true, breaks: true });
      const rendered = md.render(text || '');
      // If render returns empty but text wasn't, fallback (unlikely but safe)
      if (!rendered && text) {
        bodyDiv.textContent = text;
      } else {
        bodyDiv.innerHTML = rendered;
      }
    } catch (e) {
      console.error('Markdown Render Error:', e);
      bodyDiv.textContent = text;
    }
  } else {
    bodyDiv.textContent = text;
  }

  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(bodyDiv);

  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(bodyDiv);

  // Use a random suffix to ensure uniqueness even if called in same millisecond
  msgDiv.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  elements.chatContainer.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv.id;
}

function addLoadingIndicator() {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message agent loading-msg';
  msgDiv.id = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';

  const avatar = document.createElement('div');
  avatar.className = 'avatar agent';
  avatar.textContent = 'A';

  const name = document.createElement('div');
  name.className = 'message-name';
  name.textContent = 'Analysing...';

  headerDiv.appendChild(avatar);
  headerDiv.appendChild(name);

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'message-body';

  const indicators = document.createElement('div');
  indicators.className = 'typing-indicator';
  indicators.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;

  bodyDiv.appendChild(indicators);
  msgDiv.appendChild(headerDiv);
  msgDiv.appendChild(bodyDiv);

  elements.chatContainer.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv.id;
}

function removeLoadingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  // Only scroll if user is near bottom or it's a new message
  // Simple check: strict scroll
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// Start
document.addEventListener('DOMContentLoaded', init);
