export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, messages, personaId } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API 키가 없습니다.' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '메시지가 없습니다.' });
  }

  try {
    const MINDLOGIC_API_URL = 'https://factchat-cloud.mindlogic.ai/v1/gateway/chat/completions/';

    const requestBody = {
      model: 'gpt-4o-mini',
      messages: messages,
      ...(personaId && { persona_id: personaId }),
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
    } else if (data.message) {
      reply = data.message;
    } else if (data.content) {
      reply = data.content;
    } else if (data.reply) {
      reply = data.reply;
    } else {
      reply = JSON.stringify(data);
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('MindLogic API error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다: ' + err.message });
  }
}
