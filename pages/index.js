import { useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  useEffect(() => {
    const PERSONAS = [
      { id: 'default',   emoji: '🤖', name: 'MindLogic AI',      desc: '기본 AI 어시스턴트',      persona_id: null },
      { id: 'counselor', emoji: '💆', name: '감성 상담사',         desc: '공감과 위로를 드립니다',   persona_id: 'counselor' },
      { id: 'tutor',     emoji: '📚', name: '학습 튜터',           desc: '개념을 쉽게 설명합니다',   persona_id: 'tutor' },
      { id: 'creative',  emoji: '✍️', name: '창작 파트너',         desc: '글쓰기와 아이디어 제안',   persona_id: 'creative' },
      { id: 'advisor',   emoji: '💼', name: '비즈니스 어드바이저',  desc: '업무 관련 조언 및 분석',   persona_id: 'advisor' },
    ]

    let apiKey = localStorage.getItem('ml_api_key') || ''
    let personaId = localStorage.getItem('ml_persona_id') || null
    let currentPersona = PERSONAS[0]
    let messages = []
    let isLoading = false

    const msgContainer = document.getElementById('messages')
    const userInput = document.getElementById('user-input')
    const sendBtn = document.getElementById('send-btn')

    function updateSendBtn() {
      sendBtn.disabled = !userInput.value.trim() || isLoading || !apiKey
    }

    function renderPersonaBar() {
      const bar = document.getElementById('persona-bar')
      bar.innerHTML = PERSONAS.map(p =>
        `<div class="persona-chip ${p.id === currentPersona.id ? 'active' : ''}" data-id="${p.id}">
          <span>${p.emoji}</span><span>${p.name}</span>
        </div>`
      ).join('')
      bar.querySelectorAll('.persona-chip').forEach(el => {
        el.addEventListener('click', () => {
          currentPersona = PERSONAS.find(p => p.id === el.dataset.id)
          document.getElementById('persona-label').textContent = currentPersona.name
          renderPersonaBar()
        })
      })
    }

    function renderPersonaList() {
      const list = document.getElementById('persona-list')
      list.innerHTML = PERSONAS.map(p =>
        `<div class="persona-item ${p.id === currentPersona.id ? 'selected' : ''}" data-id="${p.id}">
          <span class="persona-icon">${p.emoji}</span>
          <div class="persona-info">
            <div class="p-name">${p.name}</div>
            <div class="p-desc">${p.desc}</div>
          </div>
        </div>`
      ).join('')
      list.querySelectorAll('.persona-item').forEach(el => {
        el.addEventListener('click', () => {
          currentPersona = PERSONAS.find(p => p.id === el.dataset.id)
          document.getElementById('persona-label').textContent = currentPersona.name
          renderPersonaBar()
          renderPersonaList()
        })
      })
    }

    renderPersonaBar()
    renderPersonaList()

    // API Key modal
    document.getElementById('key-btn').addEventListener('click', () => {
      document.getElementById('api-key-input').value = apiKey
      document.getElementById('persona-id-input').value = personaId || ''
      document.getElementById('api-modal').classList.remove('hidden')
    })
    document.getElementById('api-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('api-modal'))
        document.getElementById('api-modal').classList.add('hidden')
    })
    document.getElementById('save-key-btn').addEventListener('click', () => {
      const newKey = document.getElementById('api-key-input').value.trim()
      const newPersonaId = document.getElementById('persona-id-input').value.trim() || null
      if (newKey) {
        apiKey = newKey
        personaId = newPersonaId
        localStorage.setItem('ml_api_key', apiKey)
        if (personaId) localStorage.setItem('ml_persona_id', personaId)
        else localStorage.removeItem('ml_persona_id')
        document.getElementById('api-modal').classList.add('hidden')
        updateSendBtn()
        const btn = document.getElementById('save-key-btn')
        btn.textContent = '✅ 저장됨!'
        setTimeout(() => { btn.textContent = '저장하기' }, 1500)
      } else {
        const input = document.getElementById('api-key-input')
        input.style.borderColor = '#ff4444'
        input.placeholder = 'API 키를 입력해 주세요!'
        setTimeout(() => {
          input.style.borderColor = ''
          input.placeholder = 'ml_xxxxxxxxxxxx'
        }, 1500)
      }
    })

    // Persona modal
    document.getElementById('persona-btn').addEventListener('click', () => {
      renderPersonaList()
      document.getElementById('persona-modal').classList.remove('hidden')
    })
    document.getElementById('persona-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('persona-modal'))
        document.getElementById('persona-modal').classList.add('hidden')
    })
    document.getElementById('close-persona-btn').addEventListener('click', () => {
      document.getElementById('persona-modal').classList.add('hidden')
    })

    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto'
      userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px'
      updateSendBtn()
    })
    userInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!sendBtn.disabled) sendMessage()
      }
    })
    sendBtn.addEventListener('click', sendMessage)

    if (!apiKey) {
      setTimeout(() => document.getElementById('api-modal').classList.remove('hidden'), 600)
    }

    function getTime() {
      return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }

    function appendMessage(role, text) {
      const welcome = document.getElementById('welcome')
      if (welcome) welcome.style.display = 'none'
      const div = document.createElement('div')
      div.className = `msg ${role}`
      div.innerHTML =
        (role === 'bot' ? `<div class="avatar">${currentPersona.emoji}</div>` : '') +
        `<div class="msg-wrap"><span class="time">${getTime()}</span>` +
        `<div class="bubble">${text.replace(/\n/g, '<br/>')}</div></div>` +
        (role === 'user' ? `<div class="avatar" style="background:var(--bg3);color:var(--text2);font-size:12px;">나</div>` : '')
      msgContainer.appendChild(div)
      msgContainer.scrollTop = msgContainer.scrollHeight
    }

    function showTyping() {
      const div = document.createElement('div')
      div.className = 'msg bot'
      div.id = 'typing'
      div.innerHTML =
        `<div class="avatar">${currentPersona.emoji}</div>` +
        `<div class="msg-wrap"><div class="bubble" style="padding:0;">` +
        `<div class="typing-dots"><span></span><span></span><span></span></div></div></div>`
      msgContainer.appendChild(div)
      msgContainer.scrollTop = msgContainer.scrollHeight
    }

    function hideTyping() {
      const el = document.getElementById('typing')
      if (el) el.remove()
    }

    async function sendMessage() {
      const text = userInput.value.trim()
      if (!text || isLoading || !apiKey) return
      isLoading = true
      userInput.value = ''
      userInput.style.height = 'auto'
      updateSendBtn()
      appendMessage('user', text)
      messages.push({ role: 'user', content: text })
      showTyping()
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            messages,
            personaId: currentPersona.persona_id || personaId || undefined
          })
        })
        const data = await res.json()
        hideTyping()
        if (data.error) {
          appendMessage('bot', `❌ 오류: ${data.error}`)
        } else {
          const reply = data.reply || data.message || data.content || '응답을 받지 못했습니다.'
          messages.push({ role: 'assistant', content: reply })
          appendMessage('bot', reply)
        }
      } catch (err) {
        hideTyping()
        appendMessage('bot', '❌ 서버 연결 오류가 발생했습니다.')
      }
      isLoading = false
      updateSendBtn()
    }
  }, [])

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#0f0f13" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MindLogic" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <title>MindLogic Chat</title>
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          :root{--bg:#0f0f13;--bg2:#18181f;--bg3:#22222d;--accent:#6c63ff;--accent2:#a78bfa;--text:#f0f0f5;--text2:#9090a8;--user-bubble:#6c63ff;--bot-bubble:#22222d;--border:rgba(255,255,255,0.07);--radius:20px;--safe-bottom:env(safe-area-inset-bottom,0px)}
          html,body{height:100%;height:100dvh;background:var(--bg);color:var(--text);font-family:'Noto Sans KR',sans-serif;font-size:15px;line-height:1.6;overflow:hidden}
          #app{display:flex;flex-direction:column;height:100%;height:100dvh;max-width:480px;margin:0 auto}
          header{display:flex;align-items:center;gap:12px;padding:16px 20px 14px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0}
          .logo-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#fff;letter-spacing:-1px;flex-shrink:0}
          .header-info{flex:1}
          .header-title{font-size:15px;font-weight:700;color:var(--text);letter-spacing:-0.3px}
          .header-sub{font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px}
          .status-dot{width:6px;height:6px;border-radius:50%;background:#34d399;animation:pulse 2s infinite}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
          .header-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
          #messages{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
          #messages::-webkit-scrollbar{display:none}
          .msg{display:flex;align-items:flex-end;gap:8px;animation:fadeUp 0.25s ease}
          @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          .msg.user{flex-direction:row-reverse}
          .avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
          .bubble{max-width:72%;padding:10px 14px;border-radius:var(--radius);font-size:14px;line-height:1.65;word-break:break-word}
          .msg.user .bubble{background:var(--user-bubble);color:#fff;border-bottom-right-radius:6px}
          .msg.bot .bubble{background:var(--bot-bubble);color:var(--text);border-bottom-left-radius:6px;border:1px solid var(--border)}
          .time{font-size:10px;color:var(--text2);margin-bottom:2px;padding:0 4px}
          .msg-wrap{display:flex;flex-direction:column}
          .msg.user .msg-wrap{align-items:flex-end}
          .msg.bot .msg-wrap{align-items:flex-start}
          .typing-dots{display:flex;gap:4px;padding:12px 16px}
          .typing-dots span{width:6px;height:6px;border-radius:50%;background:var(--text2);animation:bounce 1.2s infinite}
          .typing-dots span:nth-child(2){animation-delay:0.2s}
          .typing-dots span:nth-child(3){animation-delay:0.4s}
          @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
          #persona-bar{display:flex;gap:8px;padding:10px 16px;overflow-x:auto;flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border)}
          #persona-bar::-webkit-scrollbar{display:none}
          .persona-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);font-size:12px;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
          .persona-chip.active{background:rgba(108,99,255,0.2);border-color:var(--accent);color:var(--accent2)}
          #input-area{padding:12px 16px;padding-bottom:calc(12px + var(--safe-bottom));background:var(--bg);border-top:1px solid var(--border);flex-shrink:0}
          .input-row{display:flex;align-items:flex-end;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:8px 8px 8px 14px}
          .input-row:focus-within{border-color:rgba(108,99,255,0.5)}
          #user-input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-family:'Noto Sans KR',sans-serif;font-size:14px;line-height:1.5;resize:none;max-height:120px;overflow-y:auto}
          #user-input::placeholder{color:var(--text2)}
          #user-input::-webkit-scrollbar{display:none}
          #send-btn{width:36px;height:36px;border-radius:10px;background:var(--accent);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.15s,opacity 0.15s}
          #send-btn:active{transform:scale(0.93)}
          #send-btn:disabled{opacity:0.4;cursor:not-allowed}
          #api-modal{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;z-index:100;backdrop-filter:blur(4px)}
          #api-modal.hidden{display:none}
          .modal-sheet{background:var(--bg2);border-radius:24px 24px 0 0;padding:24px 20px 32px;width:100%;border-top:1px solid var(--border)}
          .modal-handle{width:36px;height:4px;background:var(--bg3);border-radius:2px;margin:0 auto 20px}
          .modal-title{font-size:17px;font-weight:700;margin-bottom:6px}
          .modal-desc{font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.6}
          .modal-label{font-size:12px;color:var(--text2);margin-bottom:6px;font-weight:500}
          .modal-input{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:12px 14px;color:var(--text);font-size:14px;font-family:'Space Mono',monospace;margin-bottom:16px;outline:none;transition:border-color 0.2s}
          .modal-input:focus{border-color:var(--accent)}
          .modal-save{width:100%;background:var(--accent);border:none;border-radius:12px;padding:14px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:opacity 0.2s}
          .modal-save:active{opacity:0.85}
          #persona-modal{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;z-index:100;backdrop-filter:blur(4px)}
          #persona-modal.hidden{display:none}
          .persona-list{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
          .persona-item{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--bg3);border-radius:14px;border:1px solid var(--border);cursor:pointer;transition:border-color 0.2s}
          .persona-item.selected{border-color:var(--accent)}
          .persona-icon{font-size:24px}
          .persona-info .p-name{font-size:14px;font-weight:700}
          .persona-info .p-desc{font-size:12px;color:var(--text2);margin-top:2px}
          .welcome-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;gap:12px}
          .welcome-logo{width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#fff}
          .welcome-title{font-size:18px;font-weight:700}
          .welcome-sub{font-size:13px;color:var(--text2);max-width:240px;line-height:1.6}
        `}</style>
      </Head>

      <div id="app">
        <header>
          <div className="logo-mark">ML</div>
          <div className="header-info">
            <div className="header-title" id="persona-label">MindLogic AI</div>
            <div className="header-sub">
              <span className="status-dot"></span>
              <span>온라인</span>
            </div>
          </div>
          <button className="header-btn" id="persona-btn">🎭</button>
          <button className="header-btn" id="key-btn">⚙️</button>
        </header>

        <div id="persona-bar"></div>

        <div id="messages">
          <div className="welcome-msg" id="welcome">
            <div className="welcome-logo">ML</div>
            <div className="welcome-title">안녕하세요!</div>
            <div className="welcome-sub">MindLogic AI 채팅에 오신 것을 환영합니다. 아래에서 대화를 시작하세요.</div>
          </div>
        </div>

        <div id="input-area">
          <div className="input-row">
            <textarea id="user-input" rows="1" placeholder="메시지를 입력하세요..."></textarea>
            <button id="send-btn" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div id="api-modal" className="hidden">
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <div className="modal-title">🔑 API 키 설정</div>
          <div className="modal-desc">MindLogic API 키를 입력해 주세요.<br/>키는 이 기기에만 저장됩니다.</div>
          <div className="modal-label">API 키</div>
          <input className="modal-input" type="password" id="api-key-input" placeholder="ml_xxxxxxxxxxxx" />
          <div className="modal-label">Persona ID (선택사항)</div>
          <input className="modal-input" type="text" id="persona-id-input" placeholder="persona_id" />
          <button className="modal-save" id="save-key-btn">저장하기</button>
        </div>
      </div>

      <div id="persona-modal" className="hidden">
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <div className="modal-title">🎭 페르소나 선택</div>
          <div className="modal-desc">대화 상대를 선택하세요</div>
          <div className="persona-list" id="persona-list"></div>
          <button className="modal-save" id="close-persona-btn">확인</button>
        </div>
      </div>
    </>
  )
}
