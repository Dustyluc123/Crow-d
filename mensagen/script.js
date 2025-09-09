// mensagens/script.js — 100% compatível com suas regras atuais
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Containers
  const feedEl = $('#feed');
  const listEl = $('#conversations-items');
  const suggestionsContainer = $('#suggestions-container');
  const suggestionsList = $('#suggestions-list');

  // Entrada / ações
  const chatInput = $('#chatInput');
  const sendBtn = $('#sendBtn');
  const emojiBtn = $('#emojiBtn');
  const emojiPicker = $('#emojiPicker');

  // Navegação
  const backBtn = $('#backBtn');
  const logoutBtn = $('#logout-btn');

  // Toast
  function ensureToastContainer() {
    let c = $('#toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      Object.assign(c.style, {
        position: 'fixed', top: '80px', right: '16px', zIndex: 2000,
        display: 'flex', flexDirection: 'column', gap: '10px'
      });
      document.body.appendChild(c);
    }
    return c;
  }
  function toast(msg, type = 'info', ms = 2200) {
    const cont = ensureToastContainer();
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      background: type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#333',
      color: '#fff', padding: '12px 14px', borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0,0,0,.15)', maxWidth: '280px'
    });
    cont.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // Firebase
  function ensureFirebase() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      throw new Error('Firebase não inicializado. Garanta ../config/global.js antes desta página.');
    }
    return { auth: firebase.auth(), db: firebase.firestore() };
  }

  // Estado
  let currentUser = null;
  let selectedConversationId = null;
  let currentPeerUid = null;
  let messagesUnsub = null;
  const userCache = new Map(); // uid -> {displayName, photoURL}

  // Utils
  function htmlEscape(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
  function fmtTime(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date();
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }
  function scrollToBottom() {
    const el = document.getElementById('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  function setChatOpen(open) {
    if (open && isMobile()) document.body.classList.add('chat-open');
    else document.body.classList.remove('chat-open');
  }
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 769) setChatOpen(false);
  });

  function getChatHeaderEls() {
    return {
      chatHeaderEl: document.getElementById('chatHeader'),
      chatNameEl: document.getElementById('chatName'),
      chatAvatarEl: document.getElementById('chatAvatar'),
      chatStatusEl: document.getElementById('chatStatus'),
      chatMessagesEl: document.getElementById('chatMessages'),
    };
  }

  async function getUserProfile(uid) {
    if (userCache.has(uid)) return userCache.get(uid);
    const { db } = ensureFirebase();
    const snap = await db.collection('users').doc(uid).get();
    const d = snap.exists ? (snap.data() || {}) : {};
    const prof = {
      displayName: d.nickname || d.displayName || d.name || 'Usuário',
      photoURL: d.photoURL || '../img/Design sem nome2.png'
    };
    userCache.set(uid, prof);
    return prof;
  }

  // Conversas
  function otherParticipant(participants, myUid) {
    return (participants || []).find(p => p !== myUid) || myUid;
  }

  async function loadConversations() {
    if (listEl) {
      listEl.innerHTML = '<div class="loading-conversations"><i class="fas fa-spinner fa-spin"></i> Carregando conversas...</div>';
    }
    const { db } = ensureFirebase();

    try {
      const q = await db.collection('conversations')
        .where('participants', 'array-contains', currentUser.uid)
        .get();

      if (q.empty) {
        if (listEl) listEl.innerHTML = '<div class="no-conversations">Sem conversas. Inicie uma abaixo 👇</div>';
        if (suggestionsContainer) suggestionsContainer.style.display = 'block';
        await showUserSuggestions();
        return;
      }

      const items = q.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));

      if (listEl) listEl.innerHTML = '';
      for (const it of items) {
        const otherUid = otherParticipant(it.participants, currentUser.uid);
        const prof = await getUserProfile(otherUid);

        const el = document.createElement('div');
        el.className = 'conversation-item';
        el.dataset.id = it.id;
        el.innerHTML = `
          <img class="conversation-avatar" src="${htmlEscape(prof.photoURL)}" alt="">
          <div class="conversation-info">
            <h4 class="conversation-name">${htmlEscape(prof.displayName)}</h4>
            <p class="conversation-last-message">${htmlEscape(it.lastMessage || '')}</p>
          </div>
          <div class="conversation-time">${it.lastMessageAt ? fmtTime(it.lastMessageAt) : ''}</div>
        `;
        el.addEventListener('click', (ev) => {
          if (ev.target.closest('.delete-btn')) return;
          openConversation(it.id, otherUid, prof);
        });
        listEl.appendChild(el);
      }

      if (suggestionsContainer) suggestionsContainer.style.display = 'block';
      await showUserSuggestions();
    } catch (e) {
      console.error(e);
      if (listEl) listEl.innerHTML = '<div class="error-message">Erro ao carregar conversas.</div>';
      if (suggestionsContainer) suggestionsContainer.style.display = 'none';
    }
  }

  function markActiveConversation(id) {
    $$('.conversation-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
  }

async function openConversation(conversationId, peerUid, peerProfile) {
  const { db } = ensureFirebase();

  // ✅ Pré-cheque de permissão/consistência
  try {
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) {
      toast('Conversa não encontrada.', 'error');
      return;
    }
    const conv = convSnap.data() || {};
    if (!Array.isArray(conv.participants) || !conv.participants.includes(currentUser.uid)) {
      toast('Você não tem acesso a esta conversa.', 'error');
      return;
    }
  } catch (err) {
    console.error('Erro ao abrir conversa:', err);
    toast('Permissão insuficiente para abrir a conversa.', 'error');
    return;
  }

  selectedConversationId = conversationId;
  const { chatHeaderEl, chatNameEl, chatAvatarEl, chatStatusEl, chatMessagesEl } = getChatHeaderEls?.() || {};

  // carrega perfil do contato (nome/foto no topo)
  if (!peerProfile && peerUid) {
    try { peerProfile = await getUserProfile(peerUid); } catch {}
  }
  const displayName = peerProfile?.displayName || 'Conversando';
  const photo = peerProfile?.photoURL || '../img/Design sem nome2.png';

  chatNameEl && (chatNameEl.textContent = displayName);
  chatAvatarEl && (chatAvatarEl.src = photo);
  chatStatusEl && (chatStatusEl.innerHTML = `<span class="status-badge"></span> disponível`);

  // clique no header ⇒ perfil do contato
  const header = document.getElementById('chatHeader');
  if (header) {
    header.style.cursor = 'pointer';
    header.onclick = () => { if (peerUid) window.location.href = `../pages/user.html?uid=${encodeURIComponent(peerUid)}`; };
  }

  if (feedEl) feedEl.classList.add('chat-active');
  setChatOpen(true);

  if (typeof messagesUnsub === 'function' && messagesUnsub) { messagesUnsub(); messagesUnsub = null; }

  // Agora sim: liga o stream de mensagens
  const msgRef = db.collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc');

  if (chatMessagesEl) {
    chatMessagesEl.innerHTML = '<div class="loading-messages"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
  }

  messagesUnsub = msgRef.onSnapshot((snap) => {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (snap.empty) {
      container.innerHTML = '<div class="no-messages">Sem mensagens ainda. Diga um oi!</div>';
      return;
    }
    const pieces = [];
    snap.forEach(doc => {
      const m = doc.data();
      const isMine = m.senderId === currentUser.uid;
      const delBtn = isMine ? `
        <button class="message-delete-btn" data-message-id="${doc.id}" title="Apagar mensagem">
          <i class="fas fa-trash"></i>
        </button>` : '';
      pieces.push(`
        <div class="message ${isMine ? 'message-sent' : 'message-received'}">
          ${delBtn}
          <div class="message-content">${(m.text ?? '').toString()
            .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</div>
          <span class="message-time">${m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
        </div>
      `);
    });
    container.innerHTML = pieces.join('');
    const sc = document.getElementById('chatMessages'); if (sc) sc.scrollTop = sc.scrollHeight;
  }, (err) => {
    console.error(err);
    const container = document.getElementById('chatMessages');
    if (container) container.innerHTML = '<div class="error-message">Erro ao ler mensagens.</div>';
  });
}


 async function startOrOpenConversationWith(otherUid) {
  const { db } = ensureFirebase();

  const participants = [currentUser.uid, otherUid].sort();
  const conversationId = participants.join('_');
  const convRef = db.collection('conversations').doc(conversationId);

  let convDoc = await convRef.get();

  if (!convDoc.exists) {
    const newConvData = {
      participants,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await convRef.set(newConvData); // create: ok pelas suas regras
    } catch (e) {
      console.error('Erro ao criar conversa:', e);
      toast('Sem permissão para criar a conversa.', 'error');
      return;
    }
    // ✅ ESPERA ATIVA: aguarda o doc ficar visível para o avaliador de regras
    convDoc = await waitUntilConversationReady(convRef, currentUser.uid, 12, 150);
    if (!convDoc) {
      toast('Não foi possível abrir a conversa (tempo esgotado).', 'error');
      return;
    }
  } else {
    // Se já existia, ainda validamos os participants
    const data = convDoc.data() || {};
    if (!Array.isArray(data.participants) || !data.participants.includes(currentUser.uid)) {
      toast('Você não tem acesso a esta conversa.', 'error');
      return;
    }
  }

  const prof = await getUserProfile(otherUid);
  await openConversation(conversationId, otherUid, prof);
}

// helper: re-tenta ler a conversa até ver o usuário dentro de participants
async function waitUntilConversationReady(convRef, myUid, maxTries = 10, delayMs = 120) {
  for (let i = 0; i < maxTries; i++) {
    const snap = await convRef.get();
    if (snap.exists) {
      const d = snap.data() || {};
      if (Array.isArray(d.participants) && d.participants.includes(myUid)) {
        return snap;
      }
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}


  async function sendMessage() {
    const text = chatInput?.value.trim();
    if (!text || !selectedConversationId) return;
    const { db } = ensureFirebase();

    const msg = {
      text,
      senderId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      const convRef = db.collection('conversations').doc(selectedConversationId);
      const msgRef = convRef.collection('messages').doc();

      const batch = db.batch();
      batch.set(msgRef, msg);
      batch.update(convRef, {
        lastMessage: text,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      chatInput.value = '';
      chatInput.focus();
    } catch (e) {
      console.error(e);
      toast('Não foi possível enviar.', 'error');
    }
  }

  // -------- Sugestões (NÃO lê /users/{uid}/hobbies) --------
  const normalizeHobbies = (h) =>
    Array.isArray(h) ? h.map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean) : [];
  const countCommon = (a, b) => {
    const A = new Set(normalizeHobbies(a)), B = new Set(normalizeHobbies(b));
    let n = 0; for (const x of A) if (B.has(x)) n++; return n;
  };

  async function getUserHobbies(db, uid) {
    try {
      const snap = await db.collection('users').doc(uid).get(); // permitido pelas regras
      if (!snap.exists) return [];
      const d = snap.data() || {};
      if (Array.isArray(d.hobbies) && d.hobbies.length) {
        return d.hobbies.map(h => typeof h === 'string' ? h.trim() : '').filter(Boolean);
      }
      if (typeof d.hobbiesText === 'string' && d.hobbiesText.trim()) {
        return d.hobbiesText.split(/[,;\n]/g).map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('getUserHobbies fallback:', e);
    }
    return [];
  }

  function isAcceptedFriendData(d) {
    const s = d.status;
    return s === 'accepted' || s === true || s === 'friend' || s === 'aceito' || s === 'aprovado'
      || d.approved === true || d.isFriend === true || typeof s === 'undefined';
  }

  async function loadSuggestions() {
    const { db } = ensureFirebase();
    try {
      const fSnap = await db.collection('users').doc(currentUser.uid).collection('friends').get();
      const myHobbies = await getUserHobbies(db, currentUser.uid);
      const items = [];
      for (const d of fSnap.docs) {
        const data = d.data() || {};
        if (!isAcceptedFriendData(data)) continue;
        const friendUid = data.friendId || data.uid || d.id;
        if (!friendUid || friendUid === currentUser.uid) continue;
        const profile = await getUserProfile(friendUid);
        const friendHobbies = await getUserHobbies(db, friendUid);
        const common = countCommon(myHobbies, friendHobbies);
        items.push({ uid: friendUid, name: profile.displayName, photo: profile.photoURL, common });
      }
      items.sort((a, b) => b.common - a.common);

      if (suggestionsList) suggestionsList.innerHTML = '';
      const tpl = $('#suggestion-template');
      items.slice(0, 8).forEach(it => {
        const node = tpl.content.cloneNode(true);
        const link = $('.suggestion-item-link', node);
        const img = $('.suggestion-photo', node);
        const name = $('.suggestion-name', node);
        const sub = $('.suggestion-sub', node);
        const btn = $('.start-chat-btn', node);

        if (img) img.src = it.photo || '../img/Design sem nome2.png';
        if (name) name.textContent = it.name || 'Usuário';
        if (sub) sub.textContent = `${it.common} ${it.common === 1 ? 'hobby em comum' : 'hobbies em comum'}`;

        // Fallback acessível (HTML novo já aponta pro caminho certo)
        const messagesPath = '../mensagens/mensagens.html'; // correto
        if (link) link.href = `${messagesPath}?uid=${encodeURIComponent(it.uid)}`;

        const open = (e) => { e.preventDefault(); startOrOpenConversationWith(it.uid); };
        if (link) link.addEventListener('click', open);
        if (btn) btn.addEventListener('click', open);

        suggestionsList.appendChild(node);
      });

      if (!items.length && suggestionsList) {
        suggestionsList.innerHTML = '<div class="no-conversations">Sem sugestões por enquanto.</div>';
      }
    } catch (e) {
      console.error(e);
      if (suggestionsList) suggestionsList.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
    }
  }

  async function showUserSuggestions() {
    if (suggestionsContainer) suggestionsContainer.style.display = 'block';
    await loadSuggestions();
  }

  // Excluir conversa / mensagem
  async function deleteConversation(conversationId) {
    const { db } = ensureFirebase();
    try {
      await db.collection('conversations').doc(conversationId).delete();
      toast('Conversa excluída.', 'success');
      if (selectedConversationId === conversationId) {
        if (feedEl) feedEl.classList.remove('chat-active');
        setChatOpen(false);
        selectedConversationId = null;
        currentPeerUid = null;
        if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
        const { chatMessagesEl, chatNameEl, chatAvatarEl, chatStatusEl } = getChatHeaderEls();
        if (chatMessagesEl) chatMessagesEl.innerHTML = '<div class="no-messages">Selecione uma conversa para começar a conversar</div>';
        if (chatNameEl) chatNameEl.textContent = 'Selecione uma conversa';
        if (chatAvatarEl) chatAvatarEl.src = '../img/Design sem nome2.png';
        if (chatStatusEl) chatStatusEl.innerHTML = '<span class="status-badge"></span> offline';
      }
      await loadConversations();
    } catch (e) {
      console.error(e);
      toast('Não foi possível excluir a conversa.', 'error');
    }
  }

  async function deleteMessage(messageId) {
    if (!selectedConversationId) return;
    const { db } = ensureFirebase();
    try {
      await db.collection('conversations').doc(selectedConversationId)
        .collection('messages').doc(messageId).delete();
    } catch (e) {
      console.error(e);
      toast('Não foi possível excluir a mensagem.', 'error');
    }
  }

  document.addEventListener('click', (e) => {
    const deleteMsgBtn = e.target.closest('.message-delete-btn');
    if (deleteMsgBtn) {
      const messageId = deleteMsgBtn.dataset.messageId;
      if (messageId && confirm('Tem certeza que quer apagar esta mensagem?')) {
        deleteMessage(messageId);
      }
      return;
    }
    const deleteConvBtn = e.target.closest('.delete-btn[data-conversation-id]');
    if (deleteConvBtn) {
      const conversationId = deleteConvBtn.dataset.conversationId;
      if (conversationId && confirm('Tem certeza que quer apagar esta conversa?')) {
        deleteConversation(conversationId);
      }
      return;
    }
  });

  // Navegação / UI
  backBtn?.addEventListener('click', () => {
    if (feedEl) feedEl.classList.remove('chat-active');
    setChatOpen(false);
    selectedConversationId = null;
    currentPeerUid = null;
    if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
    const { chatMessagesEl, chatNameEl, chatAvatarEl, chatStatusEl } = getChatHeaderEls();
    if (chatMessagesEl) chatMessagesEl.innerHTML = '<div class="no-messages">Selecione uma conversa para começar a conversar</div>';
    if (chatNameEl) chatNameEl.textContent = 'Selecione uma conversa';
    if (chatAvatarEl) chatAvatarEl.src = '../img/Design sem nome2.png';
    if (chatStatusEl) chatStatusEl.innerHTML = '<span class="status-badge"></span> offline';
  });

  emojiBtn?.addEventListener('click', () => {
    if (!emojiPicker) return;
    emojiPicker.style.display = (emojiPicker.style.display === 'none' || !emojiPicker.style.display) ? 'block' : 'none';
  });
  emojiPicker?.addEventListener('emoji-click', (ev) => {
    const emoji = ev.detail?.unicode || ev.detail?.emoji?.unicode || '';
    if (!emoji) return;
    if (!chatInput) return;
    const start = chatInput.selectionStart ?? chatInput.value.length;
    const end = chatInput.selectionEnd ?? chatInput.value.length;
    chatInput.value = chatInput.value.slice(0, start) + emoji + chatInput.value.slice(end);
    chatInput.focus();
    chatInput.selectionStart = chatInput.selectionEnd = start + emoji.length;
  });

  sendBtn?.addEventListener('click', sendMessage);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  logoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { const { auth } = ensureFirebase(); await auth.signOut(); location.reload(); }
    catch (err) { console.error(err); toast('Erro ao sair.', 'error'); }
  });

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const { auth } = ensureFirebase();
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          if (listEl) listEl.innerHTML = '<div class="no-conversations">Faça login para ver suas conversas.</div>';
          if (suggestionsContainer) suggestionsContainer.style.display = 'none';
          setChatOpen(false);
          return;
        }
        currentUser = user;

        // Link do perfil na navbar
        const profileLink = document.querySelector('.profile-link');
        if (profileLink) profileLink.href = `../pages/user.html?uid=${encodeURIComponent(user.uid)}`;

        // Carrega conversas
        await loadConversations();

        // Deep-link ?uid=
        const urlParams = new URLSearchParams(window.location.search);
        const userToChatId = urlParams.get('uid');
        if (userToChatId && userToChatId !== currentUser.uid) {
          await startOrOpenConversationWith(userToChatId);
        }
      });
    } catch (e) {
      console.error(e);
      if (listEl) listEl.innerHTML = '<div class="error-message">Firebase não inicializado.</div>';
      if (suggestionsContainer) suggestionsContainer.style.display = 'none';
      setChatOpen(false);
    }
  });
})();
