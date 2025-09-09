// scripts.js — Amigos (corrigido + Instagram Notes - Bug de exclusão resolvido)
(function () {
  // ---------------------- Utilidades ----------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const htmlEscape = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  function toast(msg, type = "info", ms = 2800) {
    const cont = $("#toast-container") || createToastContainer();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    Object.assign(el.style, {
      margin: "8px", padding: "10px 14px", borderRadius: "8px",
      background: type === "error" ? "#ff4d4f" : type === "success" ? "#4caf50" : "var(--bg-secondary)",
      color: "white", boxShadow: "0 2px 8px rgba(0,0,0,.2)"
    });
    cont.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  function createToastContainer() {
    const c = document.createElement("div");
    c.id = "toast-container";
    Object.assign(c.style, { position: "fixed", top: "12px", right: "12px", zIndex: "9999" });
    document.body.appendChild(c);
    return c;
  }

  function ensureFirebase() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      throw new Error("Firebase não inicializado. Carregue ../config/global.js antes de scripts.js (com defer).");
    }
    return { auth: firebase.auth(), db: firebase.firestore() };
  }

  // ---------------------- DOM refs ----------------------
  const refs = {
    gridAll: () => $("#allFriendsGrid"),
    suggestions: () => $("#suggestionsContainer"),
    addFriendBtn: () => $("#addFriendBtn"),
    searchInput: () => $("#searchFriends"),
    modal: () => $("#addFriendModal"),
    modalCloseBtns: () => $$(".close-modal, .close-modal-btn"),
    modalForm: () => $("#addFriendModal form"),
    modalFriendInput: () => $("#friendEmail"), // Assumindo que este input é para o nickname
    logoutBtn: () => $("#logout-btn"),
    leftSidebarToggle: () => $("#left-sidebar-toggle"),
    leftSidebar: () => $(".left-sidebar"),

    notesSection: () => $(".notes-section"),
    notesBar: () => $("#notesBar"),
    addNoteBtn: () => $("#addNoteBtn"),
    noteModal: () => $("#noteModal"),
    noteTextArea: () => $("#noteText"),
    noteSubmitBtn: () => $("#submitNoteBtn"),
    noteCloseBtns: () => $$(".note-close, .close-note-modal"),
  };

  // ---------------------- Estado ----------------------
  let currentUser = null;
  let currentUserProfile = null;
  let lastVisibleFriend = null;
  let isFetchingFriends = false;
  let _friendsCache = [];

  // ================= INÍCIO DAS ALTERAÇÕES =================

  // Função para encontrar usuário por nickname no Firestore
  async function findUserByNickname(db, nickname) {
    const usersSnap = await db.collection('users').where('nickname', '==', nickname).limit(1).get();
    if (usersSnap.empty) {
      return null;
    }
    const doc = usersSnap.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Função para controlar o modal e o formulário de adicionar amigo
  function wireAddFriendModal(auth, db) {
    const form = refs.modalForm();
    const modal = refs.modal();
    if (!form || !modal) return;

    // Lógica do formulário de submissão
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nickname = refs.modalFriendInput()?.value.trim();
      if (!nickname) {
        toast('Por favor, insira um apelido.', 'error');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Buscando...';

      try {
        const userToFind = await findUserByNickname(db, nickname);
        if (!userToFind) {
          throw new Error(`Usuário "${htmlEscape(nickname)}" não encontrado.`);
        }
        
        // Utiliza a função `createFriendRequest` já existente no seu script
        await createFriendRequest(auth, db, userToFind.id);
        toast('Solicitação de amizade enviada!', 'success');
        
        modal.style.display = 'none';
        form.reset();

      } catch (err) {
        console.error(err);
        toast(err.message || 'Falha ao enviar solicitação.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Solicitação';
      }
    });

    // Lógica para abrir e fechar o modal
    refs.addFriendBtn()?.addEventListener('click', () => { modal.style.display = 'flex'; });
    refs.modalCloseBtns().forEach(b => b.addEventListener('click', () => { modal.style.display = 'none'; }));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  }

  // ================= FIM DAS ALTERAÇÕES =================

  // ---------------------- Amigos: lista ----------------------
  async function loadFriendsList(auth, db) {
    const grid = refs.gridAll();
    if (!grid) return;
    
    grid.innerHTML = `<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>`;

    const user = auth.currentUser;
    if (!user) {
        grid.innerHTML = `<div class="no-friends">Faça login para ver seus amigos.</div>`;
        return;
    }

    try {
      const friendsSnap = await db.collection('users').doc(user.uid).collection('friends').get();
      const friendIds = friendsSnap.docs.map(d => d.id);

      if (!friendIds.length) {
        grid.innerHTML = `<div class="no-friends">Você ainda não adicionou amigos.</div>`;
        _friendsCache = [];
        return;
      }

      const profiles = await Promise.all(friendIds.map(async (fid) => {
        try {
          const udoc = await db.collection('users').doc(fid).get();
          const u = udoc.data() || {};
          const displayName = u.nickname || u.displayName || u.name || 'Usuário';
          const photoURL = u.photoURL || '../img/corvo.png';
          return { uid: udoc.id, displayName, photoURL, hobbies: u.hobbies || [] };
        } catch (e) {
          console.debug('perfil amigo falhou:', e?.message);
          return null;
        }
      }));

      _friendsCache = [];
      profiles.filter(Boolean).forEach(({ uid, displayName, photoURL, hobbies }) => {
            _friendsCache.push({ uid, displayName, photoURL, hobbies: hobbies || [] });
        });
        
        grid.innerHTML = _friendsCache.map(friendCardHtml).join("");
        wireFriendCardClicks();

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="error-message">Erro ao carregar amigos: ${htmlEscape(err.message || String(err))}</div>`;
    }
  }

  function friendCardHtml({ uid, displayName, photoURL, hobbies }) {
    const hasHobbies = Array.isArray(hobbies) && hobbies.length > 0;
    const hobbiesHtml = hasHobbies ? hobbies.slice(0,4).map(h => `<span class="hobby-tag">${htmlEscape(String(h))}</span>`).join("") : `<span class="hobby-tag">Sem hobbies</span>`;
    return `
      <div class="friend-card" data-uid="${htmlEscape(uid)}">
        <img class="friend-avatar" src="${htmlEscape(photoURL || '../img/corvo.png')}" alt="${htmlEscape(displayName)}">
        <div class="friend-info">
          <h3 class="friend-name">${htmlEscape(displayName)}</h3>
          <div class="friend-hobbies">${hobbiesHtml}</div>
          <div class="friend-actions">
            <button class="friend-btn profile-btn" data-uid="${htmlEscape(uid)}">Ver perfil</button>
          </div>
        </div>
      </div>`;
  }
  function wireFriendCardClicks() {
    $$(".friend-card .friend-avatar, .friend-card .friend-name, .friend-card .profile-btn").forEach(el => {
      el.addEventListener('click', (e) => {
        const card = e.currentTarget.closest('.friend-card');
        const uid = card?.dataset?.uid;
        if (uid) window.location.href = `../pages/user.html?uid=${uid}`; 
      });
    });
  }
  function wireSearch() {
    const input = refs.searchInput(); const grid = refs.gridAll(); if (!input || !grid) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const filtered = !q ? _friendsCache : _friendsCache.filter(f => (f.displayName || '').toLowerCase().includes(q));
      grid.innerHTML = filtered.map(friendCardHtml).join("");
      wireFriendCardClicks();
    });
  }

  // ---------------------- Sugestões ----------------------
  async function loadSuggestions(auth, db) {
    const box = refs.suggestions(); if (!box) return;
    box.innerHTML = `<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>`;

    const me = auth.currentUser; if (!me) { box.innerHTML = `<div class="no-suggestions">Faça login para ver sugestões.</div>`; return; }

    try {
      const usersSnap = await db.collection('users').get();
      const myHobbies = normalizeHobbies(currentUserProfile?.hobbies);

      const exclusion = new Set([me.uid, ..._friendsCache.map(f => f.uid)]);
      const sentSnap = await db.collection('friendRequests').where('from', '==', me.uid).get();
      sentSnap.forEach(doc => exclusion.add(doc.data().to));

      const scored = [];
      usersSnap.forEach(udoc => {
        if (exclusion.has(udoc.id)) return;
        const u = udoc.data() || {};
        const hobbies = normalizeHobbies(u.hobbies);
        const common = intersectionCount(myHobbies, hobbies);
        if (common > 0) {
          scored.push({ id: udoc.id, nickname: u.nickname || u.displayName || u.name || 'Usuário', photoURL: u.photoURL || '../img/Design sem nome2.png', common });
        }
      });

      scored.sort((a, b) => b.common - a.common);
      if (!scored.length) { box.innerHTML = `<div class="no-suggestions">Sem sugestões com hobbies em comum por enquanto.</div>`; return; }

      box.innerHTML = scored.slice(0, 10).map(suggestionCardHtml).join("");
      wireSuggestionActions(auth, db);

    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="error-message">Erro ao carregar sugestões.</div>`;
    }
  }
  function suggestionCardHtml({ id, nickname, photoURL, common }) {
    return `
      <div class="suggestion" data-user-id="${htmlEscape(id)}">
        <img class="profile-pic small suggestion-photo" src="${htmlEscape(photoURL || '../img/Design sem nome2.png')}" alt="${htmlEscape(nickname)}">
        <div class="suggestion-info">
          <h4>${htmlEscape(nickname)}</h4>
          <p>${common} ${common === 1 ? 'hobby em comum' : 'hobbies em comum'}</p>
        </div>
        <button class="follow-btn">Seguir</button>
      </div>`
  }
// Substitua a função antiga por esta em amigos.js
function wireSuggestionActions(auth, db) {
  $$(".suggestion .follow-btn").forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget; // Pega a referência do botão clicado
      const card = button.closest('.suggestion');
      const toUid = card?.dataset?.userId;
      if (!toUid) return;

      // Desabilita o botão imediatamente para evitar cliques duplos e mostra um feedback
      button.disabled = true;
      button.textContent = 'Enviando...';

      try {
        // Envia a solicitação de amizade
        await createFriendRequest(auth, db, toUid);
        toast('Solicitação enviada!', 'success');

        // ALTERAÇÃO PRINCIPAL:
        // Em vez de remover o card, apenas mudamos o texto do botão
        // e o mantemos desabilitado.
        button.textContent = 'Pendente';

      } catch (err) {
        console.error(err);
        toast(err?.message || 'Falha ao enviar solicitação.', 'error');

        // Em caso de erro, reabilita o botão para que o usuário possa tentar novamente.
        button.disabled = false;
        button.textContent = 'Seguir';
      }
    });
  });
}

  function normalizeHobbies(h) {
    if (!Array.isArray(h)) return [];
    return h.map(x => String(x).trim()).filter(Boolean);
  }
  function intersectionCount(a, b) {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a);
    let c = 0;
    for (const x of b) if (setA.has(x)) c++;
    return c;
  }
  async function getUserHobbies(db, uid) {
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) {
        const data = snap.data();
        if (Array.isArray(data.hobbies) && data.hobbies.length > 0) {
            return data.hobbies.map(h => String(h).trim()).filter(Boolean);
        }
      }
    } catch (e) { console.debug('getUserHobbies:', e?.message); }
    return [];
  }

  async function fetchUserProfile(db, uid) {
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) return { uid, nickname: 'Usuário', photoURL: null };
      const d = snap.data() || {};
      return { uid, nickname: d.nickname || d.displayName || d.name || 'Usuário', photoURL: d.photoURL || null };
    } catch (e) { console.debug('fetchUserProfile:', e?.message); return { uid, nickname: 'Usuário', photoURL: null }; }
  }

  async function createFriendRequest(auth, db, toUid) {
    const me = auth.currentUser; if (!me) throw new Error('É preciso estar logado.');
    if (toUid === me.uid) throw new Error('Você não pode enviar solicitação para si mesmo.');

    const from = me.uid;
    const to = toUid;
    const requestId = [from, to].sort().join("_");
    const reqRef = db.collection('friendRequests').doc(requestId);

    // Tenta criar sem leitura prévia para respeitar as regras (create permitido ao from)
    try {
      await reqRef.set({
        from, to,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: false });
    } catch (err) {
      // Se falhou com permission-denied, é muito provável que o doc já exista
      // (um SET viraria UPDATE, e o 'from' não tem permissão de update nas suas regras)
      if (err && err.code === 'permission-denied') {
        try {
          const snap = await reqRef.get();
          if (snap.exists) {
            const r = snap.data() || {};
            if (r.status === 'pending') {
              if (r.from === from) throw new Error('Solicitação já enviada.');
              if (r.to === from) throw new Error('Este usuário já lhe enviou um pedido — abra as notificações para aceitar.');
              throw new Error('Já existe uma solicitação pendente.');
            }
            if (r.status === 'accepted') {
              throw new Error('Vocês já são amigos.');
            }
            if (r.status === 'declined') {
              throw new Error('Pedido já foi recusado. O remetente precisa cancelar antes de reenviar.');
            }
            throw new Error('Já existe um histórico deste pedido.');
          }
        } catch (e2) {
          // Não conseguimos ler; repasse o erro original
          throw err;
        }
      }
      // Outros erros: propaga
      throw err;
    }

    // Cria notificação para o destinatário (suas regras permitem create por qualquer logado)
    try {
      await db.collection('users').doc(to).collection('notifications').add({
        type: 'friend_request',
        requestId,
        fromUserId: from,
        content: 'enviou uma solicitação de amizade',
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
      });
    } catch (e) {
      console.warn('Aviso: falha ao criar notificação de friend_request:', e);
    }
  }

  // ---------------------- NOTAS (Apenas Texto) ---------------------
  const NOTE_MAX_LEN = 60;
  const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

  function setupNotesUI() {
    const addBtn = refs.addNoteBtn();
    const modal = refs.noteModal();
    if (!addBtn || !modal) return;

    addBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    refs.noteCloseBtns().forEach(b => b.addEventListener('click', () => { modal.style.display = 'none'; }));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    refs.noteSubmitBtn()?.addEventListener('click', async () => {
      try {
        const { auth, db } = ensureFirebase();
        const me = auth.currentUser; if (!me) { toast('Faça login para postar notas.', 'error'); return; }
        const text = (refs.noteTextArea()?.value || '').trim();
        if (!text) { toast('Escreva algo.', 'error'); return; }
        if (text.length > NOTE_MAX_LEN) { toast(`Máximo de ${NOTE_MAX_LEN} caracteres.`, 'error'); return; }

        const now = Date.now();
        await firebase.firestore().collection('users').doc(me.uid).collection('notes').doc('latest').set({
          text,
          createdAt: now,
          expireAt: now + NOTE_TTL_MS,
        });

        refs.noteTextArea().value = '';
        refs.noteModal().style.display = 'none';
        toast('Nota publicada!', 'success');
        await loadNotesBar();
      } catch (e) {
        console.error(e);
        toast('Não foi possível postar a nota.', 'error');
      }
    });
  }

  let noteListeners = [];
  let activeNotesCache = {};

  function setupRealtimeNotesListener() {
    // limpa listeners anteriores
    noteListeners.forEach(unsubscribe => unsubscribe());
    noteListeners = [];

    const { auth, db } = ensureFirebase();
    const me = auth.currentUser; if (!me) return;

    // próprio
    const unsubSelf = db.collection('users').doc(me.uid).collection('notes').doc('latest')
      .onSnapshot((doc) => {
        const d = doc.data();
        if (d && typeof d.expireAt === 'number' && Date.now() < d.expireAt && d.text) {
          activeNotesCache[me.uid] = { text: String(d.text), expireAt: d.expireAt };
        } else {
          delete activeNotesCache[me.uid];
        }
        loadNotesBar();
      });
    noteListeners.push(unsubSelf);

    // amigos
    firebase.firestore().collection('users').doc(me.uid).collection('friends').get().then((snap) => {
      snap.forEach(fr => {
        const fid = fr.id;
        const unsub = db.collection('users').doc(fid).collection('notes').doc('latest')
          .onSnapshot(doc => {
            const d = doc.data();
            if (d && typeof d.expireAt === 'number' && Date.now() < d.expireAt && d.text) {
              activeNotesCache[fid] = { text: String(d.text), expireAt: d.expireAt };
            } else {
              delete activeNotesCache[fid];
            }
            loadNotesBar();
          });
        noteListeners.push(unsub);
      });
    });
  }

  async function loadNotesBar() {
      const bar = refs.notesBar(); if (!bar) return;
      const { auth, db } = ensureFirebase();
      const me = auth.currentUser; if (!me) { bar.innerHTML = ''; return; }

      const friendIds = [me.uid];
      try {
        const snap = await db.collection('users').doc(me.uid).collection('friends').get();
        snap.forEach(d => friendIds.push(d.id));
      } catch (e) { /* ignore */ }

      // buscar perfis
      const profilePromises = friendIds.map(fid => fetchUserProfile(db, fid));
      const profiles = await Promise.all(profilePromises);

  const tiles = profiles
  .filter(profile => profile.uid === me.uid || activeNotesCache[profile.uid]) // Mostra você sempre, amigos só se tiverem nota
  .map(profile => {
      const note = activeNotesCache[profile.uid];
      return noteTileHtml({
          ownerId: profile.uid,
          ownerName: profile.uid === me.uid ? 'Você' : (profile.nickname || 'Amigo'),
          photoURL: profile.photoURL || '../img/Design sem nome2.png',
          note: note,
          isSelf: profile.uid === me.uid
      });
  });
      
      tiles.sort((a, b) => {
        if (a.includes(`data-owner-id="${me.uid}"`)) return -1;
        if (b.includes(`data-owner-id="${me.uid}"`)) return 1;
        return 0;
      });

      if (tiles.length === 1 && !activeNotesCache[me.uid]) {
        bar.innerHTML = tiles[0] + `<div class="no-suggestions" style="margin-left:12px;">Nenhuma nota de amigos.</div>`;
      } else {
        bar.innerHTML = tiles.join('');
      }

      wireNoteTileActions();
  }

  function noteTileHtml({ ownerId, ownerName, photoURL, note, isSelf }) {
    const avatar = `<div class="note-avatar"><img src="${htmlEscape(photoURL)}" alt="${htmlEscape(ownerName)}"></div>`;
    const name = `<div class="note-name">${htmlEscape(ownerName)}</div>`;
    const body = note && note.text ? `<div class="note-bubble">${htmlEscape(note.text)}</div>` : `<div class="note-bubble muted">Sem nota</div>`;
    const actions = isSelf
      ? `<button class="note-action" data-action="edit" data-owner-id="${htmlEscape(ownerId)}"><i class="fas fa-pen"></i></button>`
      : ``;

    return `
      <div class="note-tile" data-owner-id="${htmlEscape(ownerId)}">
        ${avatar}
        <div class="note-meta">
          ${name}
          ${body}
        </div>
        <div class="note-actions">${actions}</div>
      </div>`;
  }

  function wireNoteTileActions() {
    $$(".note-action[data-action='edit']").forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = refs.noteModal();
        if (modal) modal.style.display = 'flex';
      });
    });
  }

  // ---------------------- Boot ----------------------
  document.addEventListener('DOMContentLoaded', async () => {
    let auth, db; try { ({ auth, db } = ensureFirebase()); } catch (e) { toast(e.message, 'error'); console.error(e); return; }

    // Ativa as funcionalidades da UI
    wireAddFriendModal(auth, db);
    wireSearch(); 
    wireLeftSidebarToggle(); 
    wireLogout(auth); 
    setupNotesUI();

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        noteListeners.forEach(unsubscribe => unsubscribe());
        noteListeners = [];
        activeNotesCache = {};
        _friendsCache = [];
        if (refs.gridAll()) refs.gridAll().innerHTML = `<div class="no-friends">Faça login para ver seus amigos.</div>`;
        if (refs.suggestions()) refs.suggestions().innerHTML = `<div class="no-suggestions">Faça login para ver sugestões.</div>`;
        if (refs.notesBar()) refs.notesBar().innerHTML = '';
        return;
      }
      currentUser = user;

      try { const snap = await db.collection('users').doc(user.uid).get(); currentUserProfile = snap.exists ? (snap.data() || {}) : {}; }
      catch (e) { currentUserProfile = {}; }
      
      await loadFriendsList(auth, db);
      await loadSuggestions(auth, db);
      
      setupRealtimeNotesListener();
      await loadNotesBar(); 
    });
  });

  // ---------------------- UI extras (logout/side) ----------------------
  function wireLogout(auth) {
    const b = refs.logoutBtn(); if (!b) return;
    b.addEventListener('click', async () => {
      try { await auth.signOut(); location.reload(); }
      catch (e) { toast('Falha ao sair.', 'error'); }
    });
  }
  function wireLeftSidebarToggle() {
    const t = refs.leftSidebarToggle(); const s = refs.leftSidebar(); if (!t || !s) return;
    t.addEventListener('click', () => {
      s.classList.toggle('open');
    });
  }
})();