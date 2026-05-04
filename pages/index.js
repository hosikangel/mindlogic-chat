import { useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  useEffect(() => {
    const PERSONAS = [
      { id: 'default', emoji: '🤖', name: '일반 AI',         chatbotId: null },
      { id: '39053',   emoji: '🛡️', name: 'YU Shield AI',    chatbotId: '39053' },
      { id: '39013',   emoji: '📋', name: '규정 안내',        chatbotId: '39013' },
      { id: '39049',   emoji: '💰', name: '예산편성 안내',    chatbotId: '39049' },
    ]

    let apiKey       = localStorage.getItem('ml_api_key') || ''
    let currentModel = localStorage.getItem('ml_model')   || ''
    let currentPersona = PERSONAS[0]
    let messages     = []
    let isLoading    = false
    let modelList    = []

    const msgContainer = document.getElementById('messages')
    const userInput    = document.getElementById('user-input')
    const sendBtn      = document.getElementById('send-btn')
    const modelLabel   = document.getElementById('model-label')
    const modelBadge   = document.getElementById('model-badge')

    // ── 모델 배지 색상 ─────────────────────────────────────
    function getBadgeStyle(id) {
      if (!id) return { label: '', color: '#888' }
      const idl = id.toLowerCase()
      if (idl.includes('gpt') || idl.includes('o1') || idl.includes('o3'))
        return { label: 'OpenAI', color: '#10a37f' }
      if (idl.includes('claude'))
        return { label: 'Anthropic', color: '#c17b3e' }
      if (idl.includes('gemini'))
        return { label: 'Google', color: '#4285f4' }
      if (idl.includes('llama') || idl.includes('meta'))
        return { label: 'Meta', color: '#0866ff' }
      if (idl.includes('mistral'))
        return { label: 'Mistral', color: '#ff6b35' }
      return { label: '커스텀', color: '#6c63ff' }
    }

    function updateModelDisplay(id) {
      if (!id) {
        modelLabel.textContent = '모델 선택'
        modelBadge.textContent = ''
        modelBadge.style.display = 'none'
        return
      }
      const { label, color } = getBadgeStyle(id)
      // id가 길면 앞부분만 표시
      modelLabel.textContent = id.length > 22 ? id.slice(0, 22) + '…' : id
      modelBadge.textContent = label
      modelBadge.style.display = 'inline-block'
      modelBadge.style.background = color + '22'
      modelBadge.style.color = color
      localStorage.setItem('ml_model', id)
    }

    function updateSendBtn() {
      sendBtn.disabled = !userInput.value.trim() || isLoading || !apiKey || !currentModel
    }

    function getTime() {
      return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }

    // ── 모델 목록 불러오기 ─────────────────────────────────
    async function fetchModels() {
      if (!apiKey) return
      const listEl  = document.getElementById('model-list')
      const loadEl  = document.getElementById('model-loading')
      const errorEl = document.getElementById('model-error')
      loadEl.style.display  = 'flex'
      errorEl.style.display = 'none'
      listEl.innerHTML = ''

      try {
        const res = await fetch('/api/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        const data = await res.json()
        loadEl.style.display = 'none'

        if (data.error) {
          errorEl.textContent = '❌ ' + data.error
          errorEl.style.display = 'block'
          return
        }

        modelList = Array.isArray(data.models) ? data.models : []
        if (modelList.length === 0) {
          errorEl.textContent = '사용 가능한 모델이 없습니다.'
          errorEl.style.display = 'block'
          return
        }

        // 첫 로드 시 기본 모델 설정
        if (!currentModel && modelList.length > 0) {
          const firstId = modelList[0].id || modelList[0]
          currentModel = firstId
          updateModelDisplay(currentModel)
          updateSendBtn()
        }

        renderModelList()
      } catch (err) {
        loadEl.style.display = 'none'
        errorEl.textContent = '❌ 모델 목록을 불러오지 못했습니다.'
        errorEl.style.display = 'block'
      }
    }

    // ── 렌더: 모델 목록 ────────────────────────────────────
    function renderModelList() {
      const listEl = document.getElementById('model-list')

      // 카테고리별 그룹핑
      const groups = {}
      modelList.forEach(m => {
        const id = typeof m === 'string' ? m : (m.id || m.name || '')
        if (!id) return
        const { label } = getBadgeStyle(id)
        if (!groups[label]) groups[label] = []
        groups[label].push(id)
      })

      let html = ''
      Object.entries(groups).forEach(([groupName, ids]) => {
        html += `<div class="model-group-label">${groupName}</div>`
        ids.forEach(id => {
          const { color } = getBadgeStyle(id)
          const selected = id === currentModel
          const displayName = id.length > 30 ? id.slice(0, 30) + '…' : id
          html += `
            <div class="model-item ${selected ? 'selected' : ''}" data-id="${id}">
              <div class="model-item-info">
                <span class="model-item-name">${displayName}</span>
                <span class="model-item-badge" style="background:${color}22;color:${color}">${groupName}</span>
              </div>
              ${selected ? '<span class="model-check">✓</span>' : ''}
            </div>`
        })
      })
      listEl.innerHTML = html

      listEl.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', () => {
          currentModel = el.dataset.id
          updateModelDisplay(currentModel)
          renderModelList()
          document.getElementById('model-modal').classList.add('hidden')
          appendSystem(`모델이 <strong>${currentModel}</strong>로 변경되었습니다.`)
          updateSendBtn()
        })
      })
    }

    // ── 렌더: 페르소나 바 ──────────────────────────────────
    function renderPersonaBar() {
      const bar = document.getElementById('persona-bar')
      bar.innerHTML = PERSONAS.map(p =>
        `<div class="persona-chip ${p.id===currentPersona.id?'active':''}" data-id="${p.id}">
          <span>${p.emoji}</span><span>${p.name}</span>
        </div>`
      ).join('')
      bar.querySelectorAll('.persona-chip').forEach(el => {
        el.addEventListener('click', () => {
          currentPersona = PERSONAS.find(p => p.id === el.dataset.id)
          renderPersonaBar()
        })
      })
    }

    renderPersonaBar()
    updateModelDisplay(currentModel)

    // ── 메시지 출력 ────────────────────────────────────────
    function appendMessage(role, text) {
      document.getElementById('welcome').style.display = 'none'
      const div = document.createElement('div')
      div.className = `msg ${role}`
      div.innerHTML =
        (role==='bot' ? `<div class="avatar">${currentPersona.emoji}</div>` : '') +
        `<div class="msg-wrap">
          <span class="time">${getTime()}</span>
          <div class="bubble">${text.replace(/\n/g,'<br/>')}</div>
        </div>` +
        (role==='user' ? `<div class="avatar" style="background:var(--bg3);color:var(--text2);font-size:12px;">나</div>` : '')
      msgContainer.appendChild(div)
      msgContainer.scrollTop = msgContainer.scrollHeight
    }

    function appendSystem(html) {
      document.getElementById('welcome').style.display = 'none'
      const div = document.createElement('div')
      div.className = 'msg system'
      div.innerHTML = `<div class="system-bubble">${html}</div>`
      msgContainer.appendChild(div)
      msgContainer.scrollTop = msgContainer.scrollHeight
    }

    function showTyping() {
      const div = document.createElement('div')
      div.className = 'msg bot'; div.id = 'typing'
      div.innerHTML =
        `<div class="avatar">${currentPersona.emoji}</div>` +
        `<div class="msg-wrap"><div class="bubble" style="padding:0;">
          <div class="typing-dots"><span></span><span></span><span></span></div>
        </div></div>`
      msgContainer.appendChild(div)
      msgContainer.scrollTop = msgContainer.scrollHeight
    }
    function hideTyping() { const el=document.getElementById('typing'); if(el) el.remove() }

    // ── 이벤트 ────────────────────────────────────────────
    document.getElementById('key-btn').addEventListener('click', () => {
      document.getElementById('api-key-input').value = apiKey
      document.getElementById('api-modal').classList.remove('hidden')
    })
    document.getElementById('model-btn').addEventListener('click', () => {
      document.getElementById('model-modal').classList.remove('hidden')
      if (apiKey) fetchModels()
      else {
        document.getElementById('model-error').textContent = '⚙️ 먼저 API 키를 설정해 주세요.'
        document.getElementById('model-error').style.display = 'block'
        document.getElementById('model-loading').style.display = 'none'
      }
    })
    ;['api-modal','model-modal'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => {
        if (e.target === document.getElementById(id))
          document.getElementById(id).classList.add('hidden')
      })
    })

    document.getElementById('save-key-btn').addEventListener('click', () => {
      const v = document.getElementById('api-key-input').value.trim()
      if (v) {
        apiKey = v
        localStorage.setItem('ml_api_key', apiKey)
        document.getElementById('api-modal').classList.add('hidden')
        updateSendBtn()
        const btn = document.getElementById('save-key-btn')
        btn.textContent = '✅ 저장됨!'
        setTimeout(() => { btn.textContent = '저장하기' }, 1500)
        // 키 저장 후 모델 목록 자동 로드
        if (!currentModel) fetchModels()
      } else {
        const inp = document.getElementById('api-key-input')
        inp.style.borderColor = '#ff4444'
        setTimeout(() => { inp.style.borderColor = '' }, 1500)
      }
    })

    document.getElementById('close-model-btn').addEventListener('click', () => {
      document.getElementById('model-modal').classList.add('hidden')
    })
    document.getElementById('refresh-model-btn').addEventListener('click', fetchModels)

    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto'
      userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px'
      updateSendBtn()
    })
    userInput.addEventListener('keydown', e => {
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage() }
    })
    sendBtn.addEventListener('click', sendMessage)

    // 초기 실행
    if (!apiKey) {
      setTimeout(() => document.getElementById('api-modal').classList.remove('hidden'), 600)
    } else {
      fetchModels()
    }

    // ── 전송 ──────────────────────────────────────────────
    async function sendMessage() {
      const text = userInput.value.trim()
      if (!text || isLoading || !apiKey || !currentModel) return
      isLoading = true
      userInput.value = ''; userInput.style.height = 'auto'
      updateSendBtn()
      appendMessage('user', text)
      messages.push({ role: 'user', content: text })
      showTyping()
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, messages, model: currentModel, chatbotId: currentPersona.chatbotId || undefined })
        })
        const data = await res.json()
        hideTyping()
        if (data.error) {
          appendMessage('bot', `❌ 오류: ${data.error}`)
        } else {
          const reply = data.reply || '응답을 받지 못했습니다.'
          messages.push({ role: 'assistant', content: reply })
          appendMessage('bot', reply)
        }
      } catch (err) {
        hideTyping()
        appendMessage('bot', '❌ 서버 연결 오류가 발생했습니다.')
      }
      isLoading = false; updateSendBtn()
    }
  }, [])

  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#0a0f1e;--bg2:#0f172a;--bg3:#1a2540;--accent:#003366;--accent2:#4a90d9;--gold:#c8a951;--text:#f0f4ff;--text2:#8899bb;--border:rgba(255,255,255,0.07);--radius:20px;--safe-bottom:env(safe-area-inset-bottom,0px)}
    html,body{height:100%;height:100dvh;background:var(--bg);color:var(--text);font-family:'Noto Sans KR',sans-serif;font-size:15px;line-height:1.6;overflow:hidden}
    #app{display:flex;flex-direction:column;height:100%;height:100dvh;max-width:480px;margin:0 auto}
    header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0}
    .logo-mark{width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,#003366,#1a5fa8);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-weight:700;color:#fff;flex-shrink:0;gap:1px}
    .logo-mark span:first-child{font-size:13px;letter-spacing:-0.5px;line-height:1}
    .logo-sub{font-size:7px;letter-spacing:0.3px;opacity:0.9;font-family:'Noto Sans KR',sans-serif;line-height:1}
    .header-info{flex:1;min-width:0}
    .header-title-row{display:flex;align-items:center;gap:6px}
    .header-title{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
    #model-badge{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:600;white-space:nowrap;flex-shrink:0}
    .header-sub{font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px;margin-top:1px}
    .status-dot{width:6px;height:6px;border-radius:50%;background:#34d399;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .header-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);width:34px;height:34px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:background .15s}
    .header-btn:active{background:#253558}
    #persona-bar{display:flex;gap:8px;padding:8px 14px;overflow-x:auto;flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border)}
    #persona-bar::-webkit-scrollbar{display:none}
    .persona-chip{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-size:11px;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
    .persona-chip.active{background:rgba(0,51,102,0.4);border-color:#1a5fa8;color:#4a90d9}
    #messages{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
    #messages::-webkit-scrollbar{display:none}
    .msg{display:flex;align-items:flex-end;gap:8px;animation:fadeUp .25s ease}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .msg.user{flex-direction:row-reverse}
    .msg.system{justify-content:center}
    .system-bubble{font-size:12px;color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:6px 12px;text-align:center}
    .avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#003366,#1a5fa8);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
    .bubble{max-width:74%;padding:10px 14px;border-radius:var(--radius);font-size:14px;line-height:1.65;word-break:break-word}
    .msg.user .bubble{background:linear-gradient(135deg,#003366,#1a5fa8);color:#fff;border-bottom-right-radius:6px}
    .msg.bot .bubble{background:var(--bg3);color:var(--text);border-bottom-left-radius:6px;border:1px solid var(--border)}
    .time{font-size:10px;color:var(--text2);margin-bottom:2px;padding:0 4px}
    .msg-wrap{display:flex;flex-direction:column}
    .msg.user .msg-wrap{align-items:flex-end}
    .msg.bot .msg-wrap{align-items:flex-start}
    .typing-dots{display:flex;gap:4px;padding:12px 16px}
    .typing-dots span{width:6px;height:6px;border-radius:50%;background:var(--text2);animation:bounce 1.2s infinite}
    .typing-dots span:nth-child(2){animation-delay:.2s}
    .typing-dots span:nth-child(3){animation-delay:.4s}
    @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    #input-area{padding:10px 14px;padding-bottom:calc(10px + var(--safe-bottom));background:var(--bg);border-top:1px solid var(--border);flex-shrink:0}
    .input-row{display:flex;align-items:flex-end;gap:8px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:8px 8px 8px 14px}
    .input-row:focus-within{border-color:rgba(26,95,168,0.6)}
    #user-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'Noto Sans KR',sans-serif;font-size:14px;line-height:1.5;resize:none;max-height:120px;overflow-y:auto}
    #user-input::placeholder{color:var(--text2)}
    #user-input::-webkit-scrollbar{display:none}
    #send-btn{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#003366,#1a5fa8);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s,opacity .15s}
    #send-btn:active{transform:scale(0.93)}
    #send-btn:disabled{opacity:0.4;cursor:not-allowed}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;z-index:100;backdrop-filter:blur(4px)}
    .modal-overlay.hidden{display:none}
    .modal-sheet{background:var(--bg2);border-radius:24px 24px 0 0;padding:20px 18px 28px;width:100%;border-top:1px solid var(--border);max-height:85vh;overflow-y:auto}
    .modal-sheet::-webkit-scrollbar{display:none}
    .modal-handle{width:36px;height:4px;background:var(--bg3);border-radius:2px;margin:0 auto 18px}
    .modal-title{font-size:16px;font-weight:700;margin-bottom:4px}
    .modal-desc{font-size:13px;color:var(--text2);margin-bottom:16px;line-height:1.6}
    .modal-label{font-size:12px;color:var(--text2);margin-bottom:5px;font-weight:500}
    .modal-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:11px 13px;color:var(--text);font-size:14px;font-family:'Space Mono',monospace;margin-bottom:14px;outline:none;transition:border-color .2s}
    .modal-input:focus{border-color:#1a5fa8}
    .modal-save{width:100%;background:linear-gradient(135deg,#003366,#1a5fa8);border:none;border-radius:12px;padding:13px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR',sans-serif}
    .modal-save:active{opacity:0.85}
    .modal-secondary{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:11px;color:var(--text2);font-size:14px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-bottom:10px}
    .model-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .model-count{font-size:12px;color:var(--text2)}
    .refresh-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:5px 10px;border-radius:8px;font-size:12px;cursor:pointer}
    .refresh-btn:active{opacity:0.7}
    .model-loading{display:flex;align-items:center;gap:10px;padding:20px;color:var(--text2);font-size:13px;justify-content:center}
    .spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:#1a5fa8;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    .model-error{font-size:13px;color:#ff6b6b;padding:12px;text-align:center;background:rgba(255,107,107,0.08);border-radius:10px;margin-bottom:12px;display:none}
    .model-group-label{font-size:11px;color:var(--text2);font-weight:600;padding:8px 4px 4px;letter-spacing:.5px;text-transform:uppercase}
    .model-list{display:flex;flex-direction:column;gap:4px;margin-bottom:16px}
    .model-item{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);cursor:pointer;transition:border-color .2s}
    .model-item.selected{border-color:#1a5fa8;background:rgba(0,51,102,0.2)}
    .model-item-info{display:flex;align-items:center;gap:8px;min-width:0}
    .model-item-name{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}
    .model-item-badge{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600;flex-shrink:0}
    .model-check{color:#4a90d9;font-size:16px;font-weight:700;flex-shrink:0}
    .btn-row{display:flex;gap:8px}
    .welcome-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;gap:8px}
    .welcome-logo{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,#003366,#1a5fa8);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:24px;font-weight:700;color:#fff;letter-spacing:-1px}
    .welcome-univ{font-size:11px;color:#c8a951;font-weight:600;letter-spacing:1.5px;text-transform:uppercase}
    .welcome-title{font-size:17px;font-weight:700}
    .welcome-sub{font-size:13px;color:var(--text2);max-width:260px;line-height:1.7}
  `

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#003366" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="YU 챗봇" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <title>영남대학교 AI 챗봇</title>
        <style>{css}</style>
      </Head>

      <div id="app">
        <header>
          <div className="logo-mark"><span>YU</span><span className="logo-sub">AI챗봇</span></div>
          <div className="header-info">
            <div className="header-title-row">
              <span className="header-title" id="model-label">모델 선택</span>
              <span id="model-badge" style={{display:'none'}}></span>
            </div>
            <div className="header-sub">
              <span className="status-dot"></span>
              <span>영남대학교 AI 챗봇</span>
            </div>
          </div>
          <button className="header-btn" id="model-btn" title="모델 선택">🧠</button>
          <button className="header-btn" id="key-btn"   title="API 키">⚙️</button>
        </header>

        <div id="persona-bar"></div>

        <div id="messages">
          <div className="welcome-msg" id="welcome">
            <div className="welcome-logo">YU</div>
            <div className="welcome-univ">Yeungnam University</div>
            <div className="welcome-title">영남대학교 AI 챗봇</div>
            <div className="welcome-sub">🧠 모델을 선택하고 영남대 챗봇으로<br/>궁금한 것을 무엇이든 물어보세요.</div>
          </div>
        </div>

        <div id="input-area">
          <div className="input-row">
            <textarea id="user-input" rows="1" placeholder="모델을 먼저 선택해 주세요..."></textarea>
            <button id="send-btn" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* API 키 모달 */}
      <div id="api-modal" className="modal-overlay hidden">
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <div className="modal-title">⚙️ API 키 설정</div>
          <div className="modal-desc">MindLogic API 키를 입력하세요.<br/>저장 후 사용 가능한 모델이 자동으로 불러와집니다.</div>
          <div className="modal-label">API 키</div>
          <input className="modal-input" type="password" id="api-key-input" placeholder="ml_xxxxxxxxxxxx" />
          <button className="modal-save" id="save-key-btn">저장 및 모델 불러오기</button>
        </div>
      </div>

      {/* 모델 선택 모달 */}
      <div id="model-modal" className="modal-overlay hidden">
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <div className="modal-title">🧠 모델 선택</div>
          <div className="modal-desc">영남대 계정에서 사용 가능한 모델과<br/>커스텀 챗봇 전체 목록입니다.</div>
          <div className="model-toolbar">
            <span className="model-count" id="model-count"></span>
            <button className="refresh-btn" id="refresh-model-btn">🔄 새로고침</button>
          </div>
          <div className="model-loading" id="model-loading" style={{display:'none'}}>
            <div className="spinner"></div>
            <span>모델 목록 불러오는 중...</span>
          </div>
          <div className="model-error" id="model-error"></div>
          <div className="model-list" id="model-list"></div>
          <button className="modal-secondary" id="close-model-btn">닫기</button>
        </div>
      </div>
    </>
  )
}
