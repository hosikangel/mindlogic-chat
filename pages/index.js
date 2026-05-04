const BASE = 'https://factchat-cloud.mindlogic.ai';

function resolveEndpoint(model) {
  const m = model.toLowerCase();
  if (m.includes('claude'))
    return { url: `${BASE}/v1/gateway/claude/v1/messages/`, type: 'anthropic' };
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4'))
    return { url: `${BASE}/v1/gateway/responses/`, type: 'openai_responses' };
  if (m.includes('gpt') || m.includes('gemini') || m.includes('llama') || m.includes('mistral'))
    return { url: `${BASE}/v1/gateway/chat/completions/`, type: 'openai' };
  // 커스텀 모델 — 판별 불가, 폴백 사용
  return { url: null, type: 'unknown' };
}

// 엔드포인트 + 요청바디 + 헤더 생성
function buildRequest(type, model, messages, apiKey, chatbotId) {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
  };

  if (type === 'anthropic') {
    const systemMsgs = messages.filter(m => m.role === 'system');
    const chatMsgs   = messages.filter(m => m.role !== 'system');
    return {
      url: `${BASE}/v1/gateway/claude/v1/messages/`,
      body: {
        model, max_tokens: 4096, messages: chatMsgs,
        ...(systemMsgs.length > 0 && { system: systemMsgs.map(m => m.content).join('\n') }),
        ...(chatbotId && { chatbot_id: chatbotId }),
      },
      headers: { ...commonHeaders, 'anthropic-version': '2023-06-01' },
    };
  }

  if (type === 'openai_responses') {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return {
      url: `${BASE}/v1/gateway/responses/`,
      body: {
        model, input: lastUser?.content || '',
        ...(chatbotId && { chatbot_id: chatbotId }),
      },
      headers: commonHeaders,
    };
  }

  // openai (기본)
  return {
    url: `${BASE}/v1/gateway/chat/completions/`,
    body: {
      model, messages,
      ...(chatbotId && { chatbot_id: chatbotId }),
    },
    headers: commonHeaders,
  };
}

// 응답에서 텍스트 추출
function extractReply(type, data) {
  if (type === 'anthropic')
    return data.content?.[0]?.text || '';
  if (type === 'openai_responses')
    return data.output?.[0]?.content?.[0]?.text || data.output_text || data.choices?.[0]?.message?.content || '';
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}

// 단일 엔드포인트 시도
async function tryRequest(type, model, messages, apiKey, chatbotId) {
  const { url, body, headers } = buildRequest(type, model, messages, apiKey, chatbotId);
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const msg = data.message || data.error || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return extractReply(type, data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, messages, model, ragContext, chatbotId } = req.body;
  if (!apiKey)  return res.status(400).json({ error: 'API 키가 없습니다.' });
  if (!model)   return res.status(400).json({ error: '모델을 선택해 주세요.' });
  if (!messages?.length) return res.status(400).json({ error: '메시지가 없습니다.' });

  // RAG 주입
  let finalMessages = [...messages];
  if (ragContext?.trim()) {
    finalMessages = [
      { role: 'system', content: `아래 참고 문서를 우선 활용해 답변하세요.\n\n---\n${ragContext}\n---` },
      ...messages,
    ];
  }

  const { type } = resolveEndpoint(model);

  try {
    if (type !== 'unknown') {
      // 알려진 모델 — 직접 호출
      const reply = await tryRequest(type, model, finalMessages, apiKey, chatbotId);
      return res.status(200).json({ reply });
    }

    // ── 커스텀 모델: 자동 폴백 ──────────────────────────────
    const FALLBACK_ORDER = ['openai', 'anthropic', 'openai_responses'];
    let lastError = '';

    for (const fallbackType of FALLBACK_ORDER) {
      try {
        const reply = await tryRequest(fallbackType, model, finalMessages, apiKey, chatbotId);
        if (reply) return res.status(200).json({ reply, _usedEndpoint: fallbackType });
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    // 모든 폴백 실패
    return res.status(500).json({ error: `모든 엔드포인트 시도 실패: ${lastError}` });

  } catch (err) {
    console.error('MindLogic API error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
