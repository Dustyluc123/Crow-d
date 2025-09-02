// scripts.js — Amigos (corrigido + Instagram Notes - Apenas Texto + Realtime integrado)
(function () {
  // ---------------------- Utilidades ----------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const htmlEscape = (s) => String(s ?? "")
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', '"')
    .replaceAll("'", "'");

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
    modalFriendInput: () => $("#friendEmail"),
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
  let _friendsCache = [];
  let currentUser = null;
  let currentUserProfile = null;
  let lastVisibleFriend = null;
  let isFetchingFriends = false;
  const FRIENDS_PER_PAGE = 4;
  
  // ---> ADIÇÃO: Variáveis para o controle do listener em tempo real
  let noteListeners = []; // Armazena as funções para cancelar os listeners
  let activeNotesCache = {}; // Cache local para guardar as notas e evitar buscas repetidas

  // ---------------------- Hobbies helpers ----------------------
  const normalizeHobbies = (h) => Array.isArray(h) ? h.map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean) : [];
  const countCommon = (a, b) => {
    const A = new Set(normalizeHobbies(a));
    const B = new Set(normalizeHobbies(b));
    let n = 0; for (const x of A) if (B.has(x)) n++; return n;
  };

  async function getUserHobbies(db, userId) {
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data() || {};
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
        const friendsSubCollection = db.collection("users").doc(user.uid).collection("friends");
        const allFriendsSnapshot = await friendsSubCollection.get();

        const acceptedFriendIds = [];
        allFriendsSnapshot.forEach(doc => {
            const data = doc.data() || {};
            const isAccepted = data.status === "accepted" || typeof data.status === "undefined";
            if (isAccepted) {
                const friendId = doc.id;
                if (friendId && friendId !== user.uid) acceptedFriendIds.push(friendId);
            }
        });
        
        const loadingIndicator = grid.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
        
        if (acceptedFriendIds.length === 0) {
            _friendsCache = []; // Limpa o cache se não tiver amigos
            grid.innerHTML = `<div class="no-friends">Nenhum amigo encontrado.</div>`;
            return;
        }

        const friendPromises = acceptedFriendIds.map(id => db.collection("users").doc(id).get());
        const friendDocs = await Promise.all(friendPromises);
        
        _friendsCache = []; // Reseta o cache antes de preencher
        friendDocs.forEach(udoc => {
            if (!udoc.exists) return;
            const u = udoc.data() || {};
            const displayName = u.nickname || u.displayName || u.name || "Usuário";
            const photoURL = u.photoURL || "../img/corvo.png";
            _friendsCache.push({ uid: udoc.id, displayName, photoURL, hobbies: u.hobbies || [] });
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
    const hobbiesHtml = hasHobbies ? hobbies.slice(0,4).map(h => `<span class="hobby-tag">${htmlEscape(h)}</span>`).join("") : `<span class="hobby-tag">Sem hobbies</span>`;
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
      usersSnap.forEach(d => {
        if (exclusion.has(d.id)) return;
        const u = d.data() || {};
        const common = countCommon(myHobbies, normalizeHobbies(u.hobbies));
        if (common > 0) scored.push({ id: d.id, nickname: u.nickname || 'Usuário', photoURL: u.photoURL, common });
      });

      scored.sort((a, b) => b.common - a.common);
      box.innerHTML = scored.slice(0, 12).map(s => suggestionCardHtml(s)).join("");
      wireSuggestionActions(auth, db);
      if (!scored.length) box.innerHTML = `<div class="no-suggestions">Sem sugestões no momento.</div>`;
    } catch (err) {
      console.error(err);
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
      </div>`;
  }
  function wireSuggestionActions(auth, db) {
    $$(".suggestion .follow-btn").forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const card = e.currentTarget.closest('.suggestion');
        const toUid = card?.dataset?.userId; if (!toUid) return;
        try {
          await createFriendRequest(auth, db, toUid);
          toast('Solicitação enviada!', 'success');
          card.remove();
        } catch (err) { console.error(err); toast(err?.message || 'Falha ao enviar solicitação.', 'error'); }
      });
    });
  }

  async function createFriendRequest(auth, db, toUid) {
    const me = auth.currentUser; if (!me) throw new Error('É preciso estar logado.');
    if (toUid === me.uid) throw new Error('Você não pode enviar solicitação para si mesmo.');

    const existing = await db.collection('friendRequests')
      .where('from', '==', me.uid).where('to', '==', toUid).where('status', '==', 'pending').get();
    if (!existing.empty) throw new Error('Já há uma solicitação pendente para este usuário.');

    await db.collection('friendRequests').add({
      from: me.uid, to: toUid, status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // ---------------------- NOTAS (Apenas Texto) ----------------------
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
        const me = auth.currentUser; if (!me) throw new Error('Faça login.');
        const text = (refs.noteTextArea()?.value || '').trim();
        if (!text) { toast('Escreva algo.', 'error'); return; }
        await postTextNote(db, me.uid, text);
        if (refs.noteTextArea()) refs.noteTextArea().value = '';
        modal.style.display = 'none';
        toast('Nota postada!', 'success');
      } catch (e) {
        console.error(e); toast(e?.message || 'Não foi possível postar a nota.', 'error');
      }
    });
  }

  async function postTextNote(db, ownerId, text) {
    const trimmed = text.slice(0, NOTE_MAX_LEN);
    const expiresAt = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + NOTE_TTL_MS));
    await db.collection('users').doc(ownerId).collection('notes').add({
      type: 'text', text: trimmed, createdAt: firebase.firestore.FieldValue.serverTimestamp(), expiresAt
    });
  }
  
  // ---> NOVA FUNÇÃO: Configura os listeners em tempo real para as notas
  function setupRealtimeNotesListener() {
    const { auth, db } = ensureFirebase();
    const me = auth.currentUser;
    if (!me) return;

    // Cancela listeners antigos para evitar duplicação e vazamento de memória
    noteListeners.forEach(unsubscribe => unsubscribe());
    noteListeners = [];

    const userIdsToListen = [me.uid, ..._friendsCache.map(f => f.uid)];

    userIdsToListen.forEach(uid => {
        const query = db.collection('users').doc(uid).collection('notes')
            .where('expiresAt', '>', firebase.firestore.Timestamp.now())
            .orderBy('expiresAt', 'desc')
            .limit(1);

        const unsubscribe = query.onSnapshot(async snapshot => {
            if (snapshot.empty) {
                delete activeNotesCache[uid];
            } else {
                const doc = snapshot.docs[0];
                activeNotesCache[uid] = { id: doc.id, ownerId: uid, ...doc.data() };
            }
            // Chama a função de renderização para atualizar a tela
            await loadNotesBar(); 
        }, err => {
            console.error(`Erro ao escutar notas de ${uid}:`, err);
        });
        noteListeners.push(unsubscribe);
    });
  }

  // ---> FUNÇÃO ANTIGA MANTIDA, agora usada para renderizar os dados do cache
  async function loadNotesBar() {
      const bar = refs.notesBar();
      if (!bar) return;

      const { auth, db } = ensureFirebase();
      const me = auth.currentUser;
      if (!me) { bar.innerHTML = ''; return; }
      
      const userIdsInOrder = [me.uid, ..._friendsCache.map(f => f.uid)];
      
      const profilePromises = userIdsInOrder.map(uid => fetchUserProfile(db, uid));
      const profiles = await Promise.all(profilePromises);

      const tiles = profiles.map(profile => {
          const note = activeNotesCache[profile.uid]; // Pega a nota do cache
          return noteTileHtml({
              ownerId: profile.uid,
              ownerName: profile.uid === me.uid ? 'Você' : profile.nickname,
              photoURL: profile.photoURL || '../img/Design sem nome2.png',
              note: note, // note pode ser undefined se não houver nota, a função lida com isso
              isSelf: profile.uid === me.uid
          });
      });

      bar.innerHTML = tiles.filter(Boolean).join('') || `<div class="no-suggestions">Sem notas no momento.</div>`;
      wireNoteTileActions();
  }

  function noteTileHtml({ ownerId, ownerName, photoURL, note, isSelf }) {
    const avatar = `<div class="note-avatar"><img src="${htmlEscape(photoURL)}" alt="${htmlEscape(ownerName)}"></div>`;
    let bubble = isSelf && !note 
      ? `<div class="note-bubble muted">+</div>` 
      : `<div class="note-bubble muted"></div>`;

    if (note && note.type === 'text') {
      bubble = `<div class="note-bubble">${htmlEscape(String(note.text || ''))}</div>`;
    }
    const del = isSelf && note ? `<button class="note-del" data-note-owner="${htmlEscape(ownerId)}" data-note-id="${htmlEscape(note.id)}" title="Apagar nota">×</button>` : '';

    return `
      <div class="note-tile" data-owner-id="${htmlEscape(ownerId)}">
        ${avatar}
        ${bubble}
        <div class="note-owner">${htmlEscape(ownerName)}</div>
        ${del}
      </div>`;
  }

  function wireNoteTileActions() {
    $$(".note-tile").forEach(tile => {
      const uid = tile.getAttribute('data-owner-id');
      const nameEl = tile.querySelector('.note-owner');
      const avatar = tile.querySelector('.note-avatar');
      const openProfile = () => window.location.href = `../pages/user.html?uid=${encodeURIComponent(uid)}`;
      
      // Clique no avatar ou nome abre o modal de criação, SE for o próprio usuário e não tiver nota
      if(uid === currentUser?.uid && !activeNotesCache[uid]) {
        avatar?.addEventListener('click', () => refs.addNoteBtn()?.click());
        nameEl?.addEventListener('click', () => refs.addNoteBtn()?.click());
      } else {
        avatar?.addEventListener('click', openProfile);
        nameEl?.addEventListener('click', openProfile);
      }
    });

    $$(".note-del").forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const owner = btn.getAttribute('data-note-owner');
        const id = btn.getAttribute('data-note-id');
        if (!owner || !id) return;
        try {
          const { db } = ensureFirebase();
          await db.collection('users').doc(owner).collection('notes').doc(id).delete();
          toast('Nota apagada.', 'success');
        } catch (err) { console.error(err); toast('Não foi possível apagar.', 'error'); }
      });
    });
  }

  // ---------------------- UI diversos ----------------------
  function wireLogout(auth) {
    const btn = refs.logoutBtn(); if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await auth.signOut(); toast('Você saiu da conta.', 'success'); setTimeout(() => window.location.reload(), 400); }
      catch { toast('Erro ao sair.', 'error'); }
    });
  }
  function wireLeftSidebarToggle() {
    const btn = refs.leftSidebarToggle(); const sidebar = refs.leftSidebar(); if (!btn || !sidebar) return;
    btn.addEventListener('click', () => { sidebar.classList.toggle('open'); });
  }

  // ---------------------- Boot ----------------------
  document.addEventListener('DOMContentLoaded', async () => {
    let auth, db; try { ({ auth, db } = ensureFirebase()); } catch (e) { toast(e.message, 'error'); console.error(e); return; }

    wireSearch(); wireLeftSidebarToggle(); wireLogout(auth); setupNotesUI();

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        // ---> ATUALIZAÇÃO: Limpa a UI e os listeners ao deslogar
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
      
      // Carrega amigos e sugestões como antes
      await loadFriendsList(auth, db);
      await loadSuggestions(auth, db);
      
      // ---> ATUALIZAÇÃO: Em vez do setInterval, agora iniciamos o listener de tempo real
      setupRealtimeNotesListener();
      // Carrega a barra de notas uma vez no início
      await loadNotesBar(); 
    });
  });
})();