export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['authorization']?.replace('Bearer ', '')
  if (!apiKey) return res.status(400).json({ error: 'API 키가 없습니다.' })

  try {
    const response = await fetch('https://factchat-cloud.mindlogic.ai/v1/gateway/models/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMsg = `API 오류 (${response.status})`
      try { const j = JSON.parse(errorText); errorMsg = j.message || j.error || errorMsg } catch (_) {}
      return res.status(response.status).json({ error: errorMsg })
    }

    const data = await response.json()
    // OpenAI 호환: data.data 배열, 또는 data.models 배열
    const models = data.data || data.models || data || []
    return res.status(200).json({ models })
  } catch (err) {
    return res.status(500).json({ error: '모델 목록 조회 실패: ' + err.message })
  }
}
