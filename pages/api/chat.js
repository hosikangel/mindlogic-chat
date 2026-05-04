const BASE = 'https://factchat-cloud.mindlogic.ai';

function resolveEndpoint(model) {
  const m = model.toLowerCase();
  if (m.includes('claude'))
    return { type: 'anthropic' };
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4'))
    return { type: 'openai_responses' };
  if (m.includes('gpt') || m.includes('gemini') || m.includes('llama') || m.includes('mistral'))
    return { type: 'openai' };
  return { type: 'unknown' };
}

function commonHeaders(apiKey, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
    ...extra,
  };
}

// 커스텀 챗봇 전용 요청 목록 (chatbotId가 있을 때 우선 시도)
function buildChatbotRequests(model, messages, apiKey, chatbotId) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  return [
    // 시도 1: chatbot_id 파라미터 + chat/completions
    {
      url: `${BASE}/v1/gateway/chat/completions/`,
      body: { model, messages, chatbot_id: chatbotId },
      headers: commonHeaders(apiKey),
      label: 'chatbot_id param',
    },
    // 시도 2: bot_id 파라미터
    {
      url: `${BASE}/v1/gateway/chat/completions/`,
      body: { model, messages, bot_id: chatbotId },
      headers: commonHeaders(apiKey),
      label: 'bot_id param',
    },
    // 시도 3: URL 경로에 chatbot_id 포함
    {
      url: `${BASE}/v1/gateway/chatbot/${chatbotId}/chat/`,
      body: { model, messages },
      headers: commonHeaders(apiKey),
      label: 'path chatbot_id',
    },
    // 시도 4: factchat 전용 엔드포인트
    {
      url: `${BASE}/v1/chatbot/${chatbotId}/messages/`,
      body: { messages },
      headers: commonHeaders(apiKey),
      label: 'factchat messages',
    },
    // 시도 5: chatbot_id를 model로 사용
    {
      url: `${BASE}/v1/gateway/chat/completions/`,
      body: { model: chatbotId, messages },
      headers: commonHeaders(apiKey),
      label: 'chatbot as model',
    },
  ];
}

function buildRequest(type, model, messages, apiKey, chatbotId) {
  const extra = chatbotId ? { chatbot_id: chatbotId } : {};

  if (type === 'anthropic') {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const chatMsgs   = messages.filter(m => m.role !== 'system');
    return {
      url: `${BASE}/v1/gateway/claude/v1/messages/`,
      body: { model, max_tokens: 4096, messages: chatMsgs,
        ...(systemMsgs.length > 0 && { system: systemMsgs.map(m => m.content).join('\n') }),
        ...extra },
      headers: commonHeaders(apiKey, { 'anthropic-version': '2023-06-01' }),
    };
  }
  if (type === 'openai_responses') {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return {
      url: `${BASE}/v1/gateway/responses/`,
      body: { model, input: lastUser?.content || '', ...extra },
      headers: commonHeaders(apiKey),
    };
  }
  return {
    url: `${BASE}/v1/gateway/chat/completions/`,
    body: { model, messages, ...extra },
    headers: commonHeaders(apiKey),
  };
}

function extractReply(data) {
  // OpenAI 형식
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  if (data.choices?.[0]?.text) return data.choices[0].text;
  // Anthropic 형식
  if (data.content?.[0]?.text) return data.content[0].text;
  // Responses API
  if (data.output?.[0]?.content?.[0]?.text) return data.output[0].content[0].text;
  if (data.output_text) return data.output_text;
  // 기타
  if (data.message) return data.message;
  if (data.reply) return data.reply;
  if (data.text) return data.text;
  return '';
}

async function doFetch(url, body, headers) {
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const msg = data.message || data.error || data.detail || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, messages, model, chatbotId } = req.body;
  if (!apiKey)        return res.status(400).json({ error: 'API 키가 없습니다.' });
  if (!model)         return res.status(400).json({ error: '모델을 선택해 주세요.' });
  if (!messages?.length) return res.status(400).json({ error: '메시지가 없습니다.' });

  const { type } = resolveEndpoint(model);

  try {
    // ── 커스텀 챗봇 (chatbotId 있고 모델 판별 불가) ──────────
    if (chatbotId && type === 'unknown') {
      const attempts = buildChatbotRequests(model, messages, apiKey, chatbotId);
      let lastError = '';
      for (const attempt of attempts) {
        try {
          const data = await doFetch(attempt.url, attempt.body, attempt.headers);
          const reply = extractReply(data);
          if (reply) return res.status(200).json({ reply });
        } catch (err) {
          lastError = `[${attempt.label}] ${err.message}`;
          continue;
        }
      }
      return res.status(500).json({ error: `커스텀 챗봇 연결 실패: ${lastError}` });
    }

    // ── 알려진 모델 직접 호출 ─────────────────────────────────
    if (type !== 'unknown') {
      const { url, body, headers } = buildRequest(type, model, messages, apiKey, chatbotId);
      const data = await doFetch(url, body, headers);
      const reply = extractReply(data);
      return res.status(200).json({ reply });
    }

    // ── 알 수 없는 모델 폴백 ─────────────────────────────────
    const FALLBACK = ['openai', 'anthropic', 'openai_responses'];
    let lastError = '';
    for (const fallbackType of FALLBACK) {
      try {
        const { url, body, headers } = buildRequest(fallbackType, model, messages, apiKey, chatbotId);
        const data = await doFetch(url, body, headers);
        const reply = extractReply(data);
        if (reply) return res.status(200).json({ reply });
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }
    return res.status(500).json({ error: `모든 엔드포인트 실패: ${lastError}` });

  } catch (err) {
    console.error('MindLogic API error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
