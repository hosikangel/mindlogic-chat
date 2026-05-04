export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, messages, model, ragContext } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'API 키가 없습니다.' });
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: '메시지가 없습니다.' });

  try {
    const MINDLOGIC_API_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';

    // RAG 컨텍스트가 있으면 시스템 메시지로 주입
    let finalMessages = [...messages];
    if (ragContext && ragContext.trim()) {
      const systemMsg = {
        role: 'system',
        content: `아래는 참고 문서입니다. 사용자 질문에 답변할 때 이 내용을 우선 참고하세요.\n\n---\n${ragContext}\n---`
      };
      finalMessages = [systemMsg, ...messages];
    }

    const requestBody = {
      model: model || 'gpt-4o-mini',
      messages: finalMessages,
    };

    const response = await fetch(MINDLOGIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `API 오류 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch (_) {}
      return res.status(response.status).json({ error: errorMsg });
    }

    const data = await response.json();
    let reply = '';
    if (data.choices && data.choices[0]) {
      reply = data.choices[0].message?.content || data.choices[0].text || '';
    } else if (data.message) { reply = data.message; }
    else if (data.content) { reply = data.content; }
    else { reply = JSON.stringify(data); }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('MindLogic API error:', err);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
