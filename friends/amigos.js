// scripts.js — Amigos (corrigido + Instagram Notes)
// Compatível com Firebase SDK *compat* e com o HTML atual de amigos.html
// Mantém tudo que já estava funcionando (amigos, sugestões, busca, modal, logout)
// e adiciona o sistema de *Notas* (estilo Instagram): texto ou música do Spotify.

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
    modalFriendInput: () => $("#friendEmail"),
    logoutBtn: () => $("#logout-btn"),
    leftSidebarToggle: () => $("#left-sidebar-toggle"),
    leftSidebar: () => $(".left-sidebar"),

    // Notas
    notesSection: () => $(".notes-section"),
    notesBar: () => $("#notesBar"),
    addNoteBtn: () => $("#addNoteBtn"),
    noteModal: () => $("#noteModal"),
    noteTabs: () => $$("[data-note-tab]"),
    noteTextArea: () => $("#noteText"),
    noteSpotifyUrl: () => $("#spotifyUrl"),
    noteSubmitBtn: () => $("#submitNoteBtn"),
    noteCloseBtns: () => $$(".note-close, .close-note-modal"),
  };

  // ---------------------- Estado ----------------------
  let _friendsCache = []; // [{uid, displayName, photoURL, hobbies}]
  let currentUser = null;
  let currentUserProfile = null;
  // Adicione estas linhas no topo do seu friends/scripts.js


let lastVisibleFriend = null; // Guarda o último amigo carregado para saber onde continuar
let isFetchingFriends = false; // Evita carregar mais amigos enquanto uma busca já está em andamento
const FRIENDS_PER_PAGE = 4; // Define quantos amigos carregar por vez

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
        if (Array.isArray(data.hobbies) && data.hobbies.length) {
          const arr = data.hobbies.map(h => typeof h === "string" ? h.trim() : "").filter(Boolean);
          if (arr.length) return arr;
        }
        if (typeof data.hobbiesText === "string" && data.hobbiesText.trim()) {
          const parts = data.hobbiesText.split(/[,;]/g).map(s => s.trim()).filter(Boolean);
          if (parts.length) return parts;
        }
      }
      const sub = await db.collection("users").doc(userId).collection("hobbies").get();
      const list = [];
      sub.forEach(d => {
        const v = d.data() || {};
        const n = (typeof v.name === 'string' && v.name.trim()) || (typeof v.title === 'string' && v.title.trim()) || '';
        if (n) list.push(n);
      });
      if (list.length) return list;
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

// Substitua a sua função loadFriendsList inteira por esta versão

async function loadFriendsList(auth, db) {
    const grid = refs.gridAll();
    if (!grid) return;

    // Esta função agora será chamada apenas uma vez para buscar TODOS os IDs de amigos
    // A paginação será feita no lado do cliente
    
    grid.innerHTML = `
        <div class="loading-indicator">
            <i class="fas fa-spinner fa-spin"></i> Carregando todos os amigos...
        </div>`;

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
            const status = data.status;

            // Reutilizando a sua lógica original e robusta para verificar amizades aceites
            const isAccepted =
                status === "accepted" ||
                status === true ||
                status === "friend" ||
                status === "aceito" ||
                status === "aprovado" ||
                data.approved === true ||
                data.isFriend === true ||
                typeof status === "undefined";

            if (isAccepted) {
                const friendId = doc.id;
                if (friendId && friendId !== user.uid) {
                    acceptedFriendIds.push(friendId);
                }
            }
        });
        
        // Limpa o grid para começar a adicionar os amigos
        const loadingIndicator = grid.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
        
        if (acceptedFriendIds.length === 0) {
            grid.innerHTML = `<div class="no-friends">Nenhum amigo encontrado.</div>`;
            return;
        }

        // --- LÓGICA DE PAGINAÇÃO NO CLIENTE ---
        let currentIndex = 0;
        const loadMoreBtn = document.getElementById('load-more-friends');

        async function loadNextBatch() {
            const batchIds = acceptedFriendIds.slice(currentIndex, currentIndex + FRIENDS_PER_PAGE);
            if (batchIds.length === 0) {
                loadMoreBtn.style.display = 'none';
                return;
            }

            const friendPromises = batchIds.map(id => db.collection("users").doc(id).get());
            const friendDocs = await Promise.all(friendPromises);

            const newCards = [];
            friendDocs.forEach(udoc => {
                if (!udoc.exists) return;
                const u = udoc.data() || {};
                // SUBSTITUA PELA LINHA CORRETA:
const displayName = u.nickname || u.displayName || u.name || "Usuário";
                const photoURL = u.photoURL || "../img/corvo.png";
                newCards.push(friendCardHtml({ uid: udoc.id, displayName, photoURL, hobbies: u.hobbies || [] }));
            });

            grid.insertAdjacentHTML('beforeend', newCards.join(""));
            wireFriendCardClicks();

            currentIndex += FRIENDS_PER_PAGE;

            // Decide se o botão "Ver Mais" deve continuar aparecendo
            if (currentIndex >= acceptedFriendIds.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
            }
        }
        
        // Carrega o primeiro lote
        await loadNextBatch();

        // Configura o botão para carregar os próximos
        loadMoreBtn.removeEventListener('click', loadNextBatch); // Evita adicionar múltiplos eventos
        loadMoreBtn.addEventListener('click', loadNextBatch);

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
        <img class="friend-avatar" src="${htmlEscape(photoURL)}" alt="${htmlEscape(displayName)}">
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
    // Para cliques na foto ou no nome do amigo
    $$(".friend-card .friend-avatar, .friend-card .friend-name").forEach(el => {
      el.addEventListener('click', (e) => {
        const card = e.currentTarget.closest('.friend-card');
        const uid = card?.dataset?.uid; // Pega o UID do amigo a partir do card
        if (!uid) return;
        
        // CORREÇÃO: Usa a variável 'uid' que acabamos de pegar, e não 'user.uid'
        window.location.href = `../pages/user.html?uid=${uid}`; 
      });
    });

    // Para cliques no botão "Ver perfil"
    $$(".friend-card .profile-btn").forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-uid'); // Pega o UID do amigo a partir do botão
        if (!uid) return;

        // CORREÇÃO: Usa a variável 'uid' aqui também
        window.location.href = `../pages/user.html?uid=${uid}`;
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

  // ---------------------- Sugestões (apenas nº de hobbies em comum) ----------------------
  async function loadSuggestions(auth, db) {
    const box = refs.suggestions(); if (!box) return;
    box.innerHTML = `<div class="loading-indicator"><i class=\"fas fa-spinner fa-spin\"></i> Carregando sugestões...</div>`;

    const me = auth.currentUser; if (!me) { box.innerHTML = `<div class=\"no-suggestions\">Faça login para ver sugestões.</div>`; return; }

    try {
      const usersSnap = await db.collection('users').get();
      const myHobbies = normalizeHobbies(currentUserProfile?.hobbies);

      const exclusion = new Set([me.uid]);
      const [friendsSnap, sentSnap, recvSnap] = await Promise.all([
        db.collection('users').doc(me.uid).collection('friends').get(),
        db.collection('friendRequests').where('from', '==', me.uid).get(),
        db.collection('friendRequests').where('to', '==', me.uid).get()
      ]);
      friendsSnap.forEach(doc => exclusion.add(doc.id));
      sentSnap.forEach(doc => exclusion.add(doc.data().to));
      recvSnap.forEach(doc => exclusion.add(doc.data().from));

      const scored = [];
      usersSnap.forEach(d => {
        if (exclusion.has(d.id)) return;
        const u = d.data() || {};
        const candidateH = normalizeHobbies(u.hobbies);
        const common = countCommon(myHobbies, candidateH);
        if (common > 0) scored.push({ id: d.id, nickname: u.nickname || u.displayName || 'Usuário', photoURL: u.photoURL || null, common });
      });

      scored.sort((a, b) => b.common - a.common);
      box.innerHTML = scored.slice(0, 12).map(s => suggestionCardHtml(s)).join("");
      wireSuggestionActions(auth, db);
      if (!scored.length) box.innerHTML = `<div class=\"no-suggestions\">Sem sugestões no momento.</div>`;
    } catch (err) {
      console.error(err);
      box.innerHTML = `<div class=\"error-message\">Erro ao carregar sugestões.</div>`;
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

  // ---------------------- Solicitações de amizade ----------------------
  async function createFriendRequest(auth, db, toUid) {
    const me = auth.currentUser; if (!me) throw new Error('É preciso estar logado.');
    if (toUid === me.uid) throw new Error('Você não pode enviar solicitação para si mesmo.');

    const existing = await db.collection('friendRequests')
      .where('from', '==', me.uid).where('to', '==', toUid).where('status', '==', 'pending').get();
    if (!existing.empty) throw new Error('Já há uma solicitação pendente para este usuário.');

    await db.collection('friendRequests').add({
      from: me.uid,
      to: toUid,
      status: 'pending',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // ---------------------- NOTAS (Instagram Notes) ----------------------
  // Estrutura no Firestore: users/{uid}/notes/{noteId}
  // { type: 'text'|'spotify', text?, spotifyUrl?, spotifyMeta?, createdAt: TS, expiresAt: TS }
  const NOTE_MAX_LEN = 60; // igual ao Instagram
  const NOTE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  function setupNotesUI() {
    const addBtn = refs.addNoteBtn();
    const modal = refs.noteModal();
    if (!addBtn || !modal) return;

    // Tabs
    refs.noteTabs().forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.getAttribute('data-note-tab');
        $$(".note-tab").forEach(el => el.classList.toggle('active', el.id === target));
        $$("[data-note-tab]").forEach(b => b.classList.toggle('active', b === tabBtn));
      });
    });

    // Abrir/fechar modal
    addBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    refs.noteCloseBtns().forEach(b => b.addEventListener('click', () => { modal.style.display = 'none'; }));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Postar
    const submit = refs.noteSubmitBtn();
    submit?.addEventListener('click', async () => {
      try {
        const { auth, db } = ensureFirebase();
        const me = auth.currentUser; if (!me) throw new Error('Faça login.');

        // Ver qual aba está ativa
        const isTextActive = $("#tab-text").classList.contains('active');
        if (isTextActive) {
          const text = (refs.noteTextArea()?.value || '').trim();
          if (!text) { toast('Escreva algo.', 'error'); return; }
          await postTextNote(db, me.uid, text);
        } else {
          const url = (refs.noteSpotifyUrl()?.value || '').trim();
          if (!url) { toast('Cole a URL da música do Spotify.', 'error'); return; }
          await postSpotifyNote(db, me.uid, url);
        }
        // Limpa e fecha
        if (refs.noteTextArea()) refs.noteTextArea().value = '';
        if (refs.noteSpotifyUrl()) refs.noteSpotifyUrl().value = '';
        modal.style.display = 'none';
        await loadNotesBar();
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

  async function postSpotifyNote(db, ownerId, url) {
    const meta = await fetchSpotifyOEmbed(url).catch(() => null);
    const expiresAt = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + NOTE_TTL_MS));
    await db.collection('users').doc(ownerId).collection('notes').add({
      type: 'spotify', spotifyUrl: url, spotifyMeta: meta || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), expiresAt
    });
  }

  async function fetchSpotifyOEmbed(url) {
    // Sem auth, retorna título e thumbnail. Se falhar, retornamos null.
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('URL inválida do Spotify');
    const data = await res.json();
    return { title: data.title, thumbnail: data.thumbnail_url, provider: data.provider_name };
  }

  async function loadNotesBar() {
  const bar = refs.notesBar();
  if (!bar) return;

  bar.innerHTML = `<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando notas...</div>`;

  const { auth, db } = ensureFirebase();
  const me = auth.currentUser;
  if (!me) { bar.innerHTML = ''; return; }

  const now = Date.now();

  // Helper: pega a nota mais recente válida (<= 24h). Ignora falta de permissão.
  const getLatestNote = async (uid) => {
    try {
      const snap = await db.collection('users').doc(uid)
        .collection('notes')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snap.empty) return null;
      const doc = snap.docs[0];
      const n = doc.data();
      const exp = n.expiresAt?.toDate?.() || new Date(0);
      if (exp.getTime() <= now) return null;

      return { id: doc.id, ownerId: uid, ...n };
    } catch (e) {
      // Importante: se a regra negar leitura, não estoure o app.
      if (e && (e.code === 'permission-denied' || /insufficient permissions/i.test(e.message))) {
        console.warn('Sem permissão para ler nota de', uid);
        return null;
      }
      throw e; // outros erros reais
    }
  };

  // Minha nota
  const myProfile = await fetchUserProfile(db, me.uid);
  const myNote = await getLatestNote(me.uid);

  // IDs dos amigos (cache; se não tiver, busca na subcoleção)
  let friendIds = _friendsCache.map(f => f.uid);
  if (!friendIds.length) {
    const fSnap = await db.collection('users').doc(me.uid).collection('friends').get();
    friendIds = [];
    fSnap.forEach(d => {
      const dt = d.data() || {};
      const fid = dt.friendId || dt.uid || d.id;
      if (fid && fid !== me.uid) friendIds.push(fid);
    });
  }

  // Perfis e notas dos amigos (notas podem falhar por permissão; tratamos acima)
  const friendProfiles = await Promise.all(friendIds.map(uid => fetchUserProfile(db, uid)));
  const friendNotes   = await Promise.all(friendIds.map(uid => getLatestNote(uid)));

  // Render
  const tiles = [];
  tiles.push(noteTileHtml({
    ownerId: myProfile.uid,
    ownerName: 'Você',
    photoURL: myProfile.photoURL || '../img/Design sem nome2.png',
    note: myNote,
    isSelf: true
  }));

  friendNotes.forEach((note, i) => {
    if (!note) return; // sem permissão, expirado ou ausente
    const p = friendProfiles[i];
    tiles.push(noteTileHtml({
      ownerId: p.uid,
      ownerName: p.nickname,
      photoURL: p.photoURL || '../img/Design sem nome2.png',
      note,
      isSelf: false
    }));
  });

  bar.innerHTML = tiles.filter(Boolean).join('') || `<div class="no-suggestions">Sem notas no momento.</div>`;
  wireNoteTileActions();
}


  function noteTileHtml({ ownerId, ownerName, photoURL, note, isSelf }) {
    const avatar = `<div class="note-avatar"><img src="${htmlEscape(photoURL)}" alt="${htmlEscape(ownerName)}"></div>`;
    let bubble = `<div class="note-bubble muted">Sem nota</div>`;
    if (note) {
      if (note.type === 'text') {
        bubble = `<div class="note-bubble">${htmlEscape(String(note.text || '').slice(0, NOTE_MAX_LEN))}</div>`;
      } else if (note.type === 'spotify') {
        const th = note.spotifyMeta?.thumbnail;
        bubble = th
          ? `<div class="note-bubble spotify"><img src="${htmlEscape(th)}" alt="Spotify"></div>`
          : `<div class="note-bubble spotify">🎵</div>`;
      }
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
      const openProfile = () => window.location.href = `../perfil/perfil.html?uid=${encodeURIComponent(uid)}`;
      nameEl?.addEventListener('click', openProfile);
      avatar?.addEventListener('click', openProfile);
    });

    $$(".note-del").forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const owner = btn.getAttribute('data-note-owner');
        const id = btn.getAttribute('data-note-id');
        if (!owner || !id) return;
        try {
          const { db } = ensureFirebase();
          await firebase.firestore().collection('users').doc(owner).collection('notes').doc(id).delete();
          toast('Nota apagada.', 'success');
          await loadNotesBar();
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
        const grid = refs.gridAll(); if (grid) grid.innerHTML = `<div class=\"no-friends\">Faça login para ver seus amigos.</div>`;
        const sug = refs.suggestions(); if (sug) sug.innerHTML = `<div class=\"no-suggestions\">Faça login para ver sugestões.</div>`;
        const bar = refs.notesBar(); if (bar) bar.innerHTML = '';
        return;
      }

      currentUser = user;

      // Perfil para sugestões
      try { const snap = await db.collection('users').doc(user.uid).get(); currentUserProfile = snap.exists ? (snap.data() || {}) : {}; }
      catch (e) { currentUserProfile = {}; }

      await loadFriendsList(auth, db);
      await loadSuggestions(auth, db);
      await loadNotesBar();

      // Atualiza notas a cada 60s para respeitar expiração
      setInterval(loadNotesBar, 60000);
    });
    // Adicione este código dentro do seu 'DOMContentLoaded'

const loadMoreFriendsBtn = document.getElementById('load-more-friends');
if (loadMoreFriendsBtn) {
    loadMoreFriendsBtn.addEventListener('click', () => {
        // Precisa passar auth e db para a função
        const { auth, db } = ensureFirebase();
        loadFriendsList(auth, db);
    });
}
  });
})();
