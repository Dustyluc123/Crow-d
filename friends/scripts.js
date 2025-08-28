// scripts.js — Amigos (corrigido e aprimorado)
// Mantém TODAS as funções originais por nome e adiciona as mudanças pedidas:
// 1) Sugestões de amizade ordenadas por hobbies em comum (desc).
// 2) Em "Todos os seus Amigos": mostra 3–4 hobbies + link "+ ver mais" que leva ao perfil.
// 3) "Sem hobbies" só aparece quando realmente não há hobbies.
// 4) Evita erros de sintaxe e verifica a existência de elementos antes de usar.

// ---------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  // Firebase (compat)
  const firebaseConfig = {
    apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
    authDomain: "tcclogin-7e7b8.firebaseapp.com",
    projectId: "tcclogin-7e7b8",
    storageBucket: "tcclogin-7e7b8.appspot.com",
    messagingSenderId: "1066633833169",
    appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  const functions = firebase.functions();

  // DOM
  const pendingRequestsSection = document.getElementById('pendingRequests'); // opcional no HTML
  const allFriendsGrid = document.getElementById('allFriendsGrid');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const searchInput = document.getElementById('searchFriends');
  const logoutButton = document.getElementById('logout-btn');
  const seeMoreLinks = document.querySelectorAll('.see-more');

  // Modal adicionar amigo (opcional no HTML)
  const addFriendBtn = document.getElementById('addFriendBtn');
  const addFriendModal = document.getElementById('addFriendModal');
  const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
  const friendForm = document.querySelector('.modal-form');

  // Estado
  let currentUser = null;
  let currentUserProfile = null;

  // Listeners (para cancelar quando necessário)
  let friendsListener = null;
  let requestsListener = null;

  // Paginação
  const FRIENDS_PER_PAGE = 6;
  const SUGGESTIONS_PAGE_SIZE = 12;
  let lastVisibleFriend = null;
  let lastVisibleSuggestion = null;
  let isLoadingMoreFriends = false;
  let isLoadingMoreSuggestions = false;
  let noMoreFriends = false;
  let noMoreSuggestions = false;

  // Fallback para showToast se não existir
  if (typeof window.showToast !== 'function') {
    window.showToast = function (msg, type = 'info') {
      console[type === 'error' ? 'error' : 'log']('[toast]', msg);
    };
  }

  // -------------------------------------------------------
  // Utils
  // -------------------------------------------------------
  function normalizeHobbies(hobbies) {
    if (!Array.isArray(hobbies)) return [];
    return hobbies.map(h => (typeof h === 'string' ? h.trim() : ''))
                  .filter(Boolean);
  }

  function countCommon(a, b) {
    const A = new Set(normalizeHobbies(a));
    const B = new Set(normalizeHobbies(b));
    let n = 0;
    for (const h of A) if (B.has(h)) n++;
    return n;
  }

  function hobbyTagsHTML(hobbies, profileUrl, max = 4) {
    const h = normalizeHobbies(hobbies);
    if (h.length === 0) return `<span class="hobby-tag">Sem hobbies</span>`;
    const head = h.slice(0, max).map(x => `<span class="hobby-tag">${x}</span>`).join('');
    const more = h.length > max ? `<a href="${profileUrl}" class="hobby-tag" title="Ver todos os hobbies">+ ver mais</a>` : '';
    return head + more;
  }

  function redirectToUserProfile(userId) {
    window.location.href = `../pages/user.html?uid=${encodeURIComponent(userId)}`;
  }

  function redirectToMessages(userId) {
    window.location.href = `../mensagen/mensagens.html?uid=${encodeURIComponent(userId)}`;
  }

  function filterFriends(searchTerm) {
    document.querySelectorAll('.friend-card').forEach(card => {
      const friendNameEl = card.querySelector('.friend-name');
      const name = (friendNameEl?.textContent || '').toLowerCase();
      card.style.display = name.includes(searchTerm) ? '' : 'none';
    });
  }

  // -------------------------------------------------------
  // Auth
  // -------------------------------------------------------
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = '../login/login.html';
      return;
    }

    currentUser = user;

    // Atualiza link de perfil no topo (se existir)
    const profileLink = document.querySelector('.main-nav a.profile-link');
    if (profileLink) profileLink.href = `../pages/user.html?uid=${encodeURIComponent(user.uid)}`;

    await loadUserProfile(user.uid);

    // Carrega blocos
    loadFriendRequests();
    loadFriends();
    loadSuggestions();
  });

  // -------------------------------------------------------
  // Perfil atual
  // -------------------------------------------------------
  async function loadUserProfile(userId) {
    try {
      const snap = await db.collection('users').doc(userId).get();
      if (snap.exists) {
        currentUserProfile = snap.data() || {};
      } else {
        console.warn('Perfil do usuário não encontrado.');
        window.location.href = '../profile/profile.html';
      }
    } catch (err) {
      console.error('Erro ao carregar perfil do usuário:', err);
    }
  }

  // -------------------------------------------------------
  // Pedidos de amizade (opcionais)
  // -------------------------------------------------------
  async function sendFriendRequest(userId, userData) {
    if (!currentUserProfile || !currentUserProfile.nickname) {
      showToast("Seu perfil ainda não foi carregado, tente novamente.", "error");
      return false;
    }
    // Desabilita botão "Seguir" local (se existir)
    const followButton = document.querySelector(`.suggestion[data-user-id="${userId}"] .follow-btn`);
    if (followButton) {
      followButton.disabled = true;
      followButton.textContent = 'Aguarde...';
    }

    try {
      if (userId === currentUser.uid) throw new Error('Você não pode se adicionar.');

      const alreadyFriend = await db.collection('users')
        .doc(currentUser.uid).collection('friends').doc(userId).get();
      if (alreadyFriend.exists) throw new Error('Este usuário já é seu amigo.');

      const requestId = [currentUser.uid, userId].sort().join('_');
      const requestRef = db.collection('friendRequests').doc(requestId);
      const requestDoc = await requestRef.get();
      if (requestDoc.exists) throw new Error('Já existe um pedido pendente.');

      const batch = db.batch();

      // cria notificação para destinatário e usa o ID dela armazenado no pedido
      const notificationRef = db.collection('users').doc(userId).collection('notifications').doc();

      batch.set(requestRef, {
        from: currentUser.uid,
        to: userId,
        fromUserName: currentUserProfile.nickname || '',
        fromUserPhoto: currentUserProfile.photoURL || null,
        notificationId: notificationRef.id,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Notificação simples
      batch.set(notificationRef, {
        type: 'friend_request',
        from: currentUser.uid,
        fromUserName: currentUserProfile.nickname || '',
        fromUserPhoto: currentUserProfile.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });

      await batch.commit();
      showToast('Solicitação enviada!', 'success');
      return true;
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Falha ao enviar solicitação.', 'error');
      if (followButton) {
        followButton.disabled = false;
        followButton.textContent = 'Seguir';
      }
      return false;
    }
  }

  function loadFriendRequests() {
    if (!pendingRequestsSection) return;
    pendingRequestsSection.innerHTML = `
      <h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2>
      <div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>
    `;

    if (requestsListener) requestsListener();

    requestsListener = db.collection('friendRequests')
      .where('to', '==', auth.currentUser.uid)
      .where('status', '==', 'pending')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2>';
        if (snapshot.empty) {
          pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação pendente.</p>';
          return;
        }
        snapshot.forEach(doc => {
          const r = { id: doc.id, ...doc.data() };
          addRequestToDOM({
            id: r.id,
            fromUserId: r.from,
            fromUserName: r.fromUserName || 'Usuário',
            fromUserPhoto: r.fromUserPhoto || '../img/Design sem nome2.png',
            notificationId: r.notificationId || null
          });
        });
      }, err => {
        console.error(err);
        pendingRequestsSection.innerHTML += '<p class="error-message">Erro ao carregar solicitações.</p>';
      });
  }

  async function acceptFriendRequest(requestId, fromUserId) {
    try {
      const requestRef = db.collection('friendRequests').doc(requestId);
      const requestDoc = await requestRef.get();
      if (!requestDoc.exists) throw new Error('Solicitação não encontrada.');

      const data = requestDoc.data();
      const notificationId = data.notificationId || null;

      const [fromUserDoc, currentUserDoc] = await Promise.all([
        db.collection('users').doc(fromUserId).get(),
        db.collection('users').doc(currentUser.uid).get()
      ]);

      const fromUserData = fromUserDoc.data() || {};
      const currentUserData = currentUserDoc.data() || {};

      const batch = db.batch();

      const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
      batch.set(currentUserFriendRef, {
        nickname: fromUserData.nickname || 'Usuário',
        photoURL: fromUserData.photoURL || null,
        hobbies: normalizeHobbies(fromUserData.hobbies)
      });

      const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
      batch.set(fromUserFriendRef, {
        nickname: currentUserData.nickname || 'Usuário',
        photoURL: currentUserData.photoURL || null,
        hobbies: normalizeHobbies(currentUserData.hobbies)
      });

      batch.delete(requestRef);
      if (notificationId) {
        const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
        batch.delete(notificationRef);
      }

      await batch.commit();
      showToast('Solicitação aceita!', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao aceitar solicitação.', 'error');
    }
  }

  async function rejectFriendRequest(requestId) {
    try {
      await db.collection('friendRequests').doc(requestId).delete();
      showToast('Solicitação recusada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erro ao recusar solicitação.', 'error');
    }
  }

  function addRequestToDOM(request) {
    if (!pendingRequestsSection) return;
    const el = document.createElement('div');
    el.className = 'request-card';
    el.dataset.requestId = request.id;
    el.dataset.userId = request.fromUserId;

    el.innerHTML = `
      <img src="${request.fromUserPhoto}" alt="Avatar" class="request-avatar">
      <div class="request-info">
        <h3 class="request-name">${request.fromUserName}</h3>
        <p class="request-mutual">0 amigos em comum</p>
      </div>
      <div class="request-actions">
        <button class="request-btn accept-btn">Aceitar</button>
        <button class="request-btn secondary reject-btn">Recusar</button>
      </div>
    `;
    const acceptBtn = el.querySelector('.accept-btn');
    const rejectBtn = el.querySelector('.reject-btn');
    acceptBtn.addEventListener('click', () => acceptFriendRequest(request.id, request.fromUserId));
    rejectBtn.addEventListener('click', () => rejectFriendRequest(request.id));
    pendingRequestsSection.appendChild(el);
  }

  // -------------------------------------------------------
  // Amigos — lista + paginação
  // -------------------------------------------------------
  function loadFriends() {
    lastVisibleFriend = null;
    noMoreFriends = false;
    if (allFriendsGrid) {
      allFriendsGrid.innerHTML = `
        <div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>
      `;
    }
    // Remove botão antigo
    const old = document.querySelector('.friends-section .load-more-btn');
    if (old) old.remove();

    loadAllFriends();
  }

  async function loadAllFriends() {
    try {
      if (!allFriendsGrid) return;
      allFriendsGrid.innerHTML = '';

      const query = db.collection('users').doc(currentUser.uid)
        .collection('friends').orderBy('nickname').limit(FRIENDS_PER_PAGE);
      const snapshot = await query.get();

      if (snapshot.empty) {
        allFriendsGrid.innerHTML = '<p class="no-friends">Você ainda não tem amigos.</p>';
        noMoreFriends = true;
        return;
      }

      snapshot.forEach(doc => {
        const friend = { id: doc.id, ...doc.data() };
        addFriendToDOM(friend, allFriendsGrid);
      });

      lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < FRIENDS_PER_PAGE) {
        noMoreFriends = true;
      } else {
        const friendsSection = document.querySelector('.friends-section');
        if (friendsSection && !friendsSection.querySelector('.load-more-btn')) {
          const btn = document.createElement('button');
          btn.className = 'action-btn load-more-btn';
          btn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
          btn.addEventListener('click', loadMoreFriends);
          friendsSection.appendChild(btn);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar amigos:', error);
      if (allFriendsGrid) {
        allFriendsGrid.innerHTML = '<div class="error-message">Erro ao carregar amigos.</div>';
      }
    }
  }

  async function loadMoreFriends() {
    const loadMoreBtn = document.querySelector('.friends-section .load-more-btn');
    try {
      if (!allFriendsGrid || isLoadingMoreFriends || noMoreFriends) return;
      isLoadingMoreFriends = true;
      if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';

      let query = db.collection('users').doc(currentUser.uid)
        .collection('friends').orderBy('nickname');
      if (lastVisibleFriend) query = query.startAfter(lastVisibleFriend);
      query = query.limit(FRIENDS_PER_PAGE);
      const snapshot = await query.get();

      if (snapshot.empty) {
        noMoreFriends = true;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      snapshot.forEach(doc => {
        const friend = { id: doc.id, ...doc.data() };
        addFriendToDOM(friend, allFriendsGrid);
      });

      lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < FRIENDS_PER_PAGE && loadMoreBtn) loadMoreBtn.style.display = 'none';
    } catch (error) {
      console.error('Erro ao carregar mais amigos:', error);
      showToast('Erro ao carregar mais amigos.', 'error');
    } finally {
      isLoadingMoreFriends = false;
      if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
    }
  }

  function addFriendToDOM(friend, container) {
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'friend-card';
    card.dataset.userId = friend.id;

    const profileUrl = `../pages/user.html?uid=${encodeURIComponent(friend.id)}`;
    const hobbiesHTML = hobbyTagsHTML(friend.hobbies || [], profileUrl, 4);

    card.innerHTML = `
      <img src="${friend.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="friend-avatar">
      <div class="friend-info">
        <h3 class="friend-name">${friend.nickname || 'Usuário'}</h3>
        <div class="friend-hobbies">${hobbiesHTML}</div>
        <div class="friend-actions">
          <button class="friend-btn view-profile-btn">Ver Perfil</button>
          <button class="friend-btn message-btn">Mensagem</button>
        </div>
      </div>
    `;

    const viewProfileBtn = card.querySelector('.view-profile-btn');
    const messageBtn = card.querySelector('.message-btn');
    const friendAvatar = card.querySelector('.friend-avatar');
    const friendName = card.querySelector('.friend-name');

    viewProfileBtn.addEventListener('click', () => redirectToUserProfile(friend.id));
    friendAvatar.addEventListener('click', () => redirectToUserProfile(friend.id));
    friendName.addEventListener('click', () => redirectToUserProfile(friend.id));
    messageBtn.addEventListener('click', () => redirectToMessages(friend.id));

    container.appendChild(card);
  }

  // -------------------------------------------------------
  // Sugestões de amizade — ordenadas por hobbies em comum
  // -------------------------------------------------------
  async function loadSuggestions() {
    if (!suggestionsContainer || !currentUserProfile) return;
    suggestionsContainer.innerHTML = `
      <div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>
    `;

    lastVisibleSuggestion = null;
    noMoreSuggestions = false;

    try {
      // IDs a excluir
      const exclusion = new Set([currentUser.uid]);

      const [friendsSnap, sentSnap, recvSnap] = await Promise.all([
        db.collection('users').doc(currentUser.uid).collection('friends').get(),
        db.collection('friendRequests').where('from', '==', currentUser.uid).get(),
        db.collection('friendRequests').where('to', '==', currentUser.uid).get()
      ]);

      friendsSnap.forEach(doc => exclusion.add(doc.id));
      sentSnap.forEach(doc => exclusion.add(doc.data().to));
      recvSnap.forEach(doc => exclusion.add(doc.data().from));

      const page = await db.collection('users')
        .orderBy(firebase.firestore.FieldPath.documentId())
        .limit(SUGGESTIONS_PAGE_SIZE)
        .get();

      const currentH = normalizeHobbies(currentUserProfile.hobbies);
      const batch = [];

      page.forEach(doc => {
        if (exclusion.has(doc.id)) return;
        const u = { id: doc.id, ...doc.data() };
        const overlap = countCommon(currentH, u.hobbies || []);
        batch.push({ user: u, overlap });
      });

      // Ordena por hobbies em comum (desc), desempate por nome
      batch.sort((a, b) => {
        if (b.overlap !== a.overlap) return b.overlap - a.overlap;
        const an = (a.user.nickname || '').toLowerCase();
        const bn = (b.user.nickname || '').toLowerCase();
        return an.localeCompare(bn);
      });

      suggestionsContainer.innerHTML = '';
      batch.forEach(({ user, overlap }) => addSuggestionToDOM(user, overlap));

      lastVisibleSuggestion = page.docs[page.docs.length - 1] || null;
      noMoreSuggestions = page.size < SUGGESTIONS_PAGE_SIZE;

    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
      }
    }
  }

  async function loadMoreSuggestions(loadMoreBtn) {
    if (isLoadingMoreSuggestions || noMoreSuggestions) return;

    isLoadingMoreSuggestions = true;
    if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';

    try {
      // Excluir quem já está na tela e outros blocos
      const exclusion = new Set([currentUser.uid]);
      document.querySelectorAll('.suggestion[data-user-id]').forEach(el => exclusion.add(el.dataset.userId));

      const [friendsSnap, sentSnap, recvSnap] = await Promise.all([
        db.collection('users').doc(currentUser.uid).collection('friends').get(),
        db.collection('friendRequests').where('from', '==', currentUser.uid).get(),
        db.collection('friendRequests').where('to', '==', currentUser.uid).get()
      ]);
      friendsSnap.forEach(doc => exclusion.add(doc.id));
      sentSnap.forEach(doc => exclusion.add(doc.data().to));
      recvSnap.forEach(doc => exclusion.add(doc.data().from));

      const currentH = normalizeHobbies(currentUserProfile.hobbies);
      let added = 0;
      const MIN_TO_ADD = 3;

      while (added < MIN_TO_ADD && !noMoreSuggestions) {
        let q = db.collection('users').orderBy(firebase.firestore.FieldPath.documentId());
        if (lastVisibleSuggestion) q = q.startAfter(lastVisibleSuggestion);
        q = q.limit(SUGGESTIONS_PAGE_SIZE);
        const page = await q.get();

        if (page.empty) {
          noMoreSuggestions = true;
          break;
        }

        const batch = [];
        page.forEach(doc => {
          if (exclusion.has(doc.id)) return;
          const u = { id: doc.id, ...doc.data() };
          const overlap = countCommon(currentH, u.hobbies || []);
          batch.push({ user: u, overlap });
        });

        batch.sort((a, b) => {
          if (b.overlap !== a.overlap) return b.overlap - a.overlap;
          const an = (a.user.nickname || '').toLowerCase();
          const bn = (b.user.nickname || '').toLowerCase();
          return an.localeCompare(bn);
        });

        batch.forEach(({ user, overlap }) => {
          if (!exclusion.has(user.id)) {
            addSuggestionToDOM(user, overlap);
            exclusion.add(user.id);
            added++;
          }
        });

        lastVisibleSuggestion = page.docs[page.docs.length - 1];
        if (page.size < SUGGESTIONS_PAGE_SIZE) noMoreSuggestions = true;
      }

      if (noMoreSuggestions && loadMoreBtn) loadMoreBtn.style.display = 'none';
      else if (loadMoreBtn) loadMoreBtn.innerHTML = 'Ver mais';

    } catch (error) {
      console.error('Erro ao carregar mais sugestões:', error);
      showToast('Erro ao carregar mais sugestões.', 'error');
      if (loadMoreBtn) loadMoreBtn.innerHTML = 'Ver mais';
    } finally {
      isLoadingMoreSuggestions = false;
    }
  }

  function addSuggestionToDOM(user, commonHobbiesCount) {
    if (!suggestionsContainer) return;

    const el = document.createElement('div');
    el.className = 'suggestion';
    el.dataset.userId = user.id;

    el.innerHTML = `
      <img src="${user.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="profile-pic small suggestion-photo">
      <div class="suggestion-info">
        <h4>${user.nickname || 'Usuário'}</h4>
        <p>${commonHobbiesCount} ${commonHobbiesCount === 1 ? 'hobby em comum' : 'hobbies em comum'}</p>
      </div>
      <button class="follow-btn">Seguir</button>
    `;

    const followBtn = el.querySelector('.follow-btn');
    followBtn.addEventListener('click', async () => {
      followBtn.disabled = true;
      followBtn.textContent = 'Aguarde...';
      const ok = await sendFriendRequest(user.id, user);
      if (!ok) {
        followBtn.disabled = false;
        followBtn.textContent = 'Seguir';
      } else {
        el.remove(); // some UI feedback
      }
    });

    const userPhoto = el.querySelector('.suggestion-photo');
    const userName = el.querySelector('h4');
    userPhoto.addEventListener('click', () => redirectToUserProfile(user.id));
    userName.addEventListener('click', () => redirectToUserProfile(user.id));

    suggestionsContainer.appendChild(el);
  }

  // -------------------------------------------------------
  // Eventos de UI
  // -------------------------------------------------------
  if (logoutButton) {
    logoutButton.addEventListener('click', function (e) {
      e.preventDefault();
      auth.signOut()
        .then(() => window.location.href = '../login/login.html')
        .catch(err => {
          console.error('Erro ao fazer logout:', err);
          showToast('Erro ao fazer logout. Tente novamente.', 'error');
        });
    });
  }

  if (addFriendBtn) {
    addFriendBtn.addEventListener('click', () => addFriendModal && (addFriendModal.style.display = 'flex'));
  }
  if (closeModalBtns && addFriendModal) {
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => { addFriendModal.style.display = 'none'; }));
    window.addEventListener('click', ev => { if (ev.target === addFriendModal) addFriendModal.style.display = 'none'; });
  }

  if (friendForm) {
    friendForm.addEventListener('submit', async e => {
      e.preventDefault();
      const friendEmail = (document.getElementById('friendEmail')?.value || '').trim();
      if (!friendEmail) {
        showToast('Por favor, digite o nome de usuário válido.', 'error');
        return;
      }
      try {
        const byEmail = await db.collection('users').where('email', '==', friendEmail).limit(1).get();
        if (!byEmail.empty) {
          const doc = byEmail.docs[0];
          sendFriendRequest(doc.id, doc.data());
          return;
        }
        const byNick = await db.collection('users').where('nickname', '==', friendEmail).limit(1).get();
        if (!byNick.empty) {
          const doc = byNick.docs[0];
          sendFriendRequest(doc.id, doc.data());
          return;
        }
        showToast('Usuário não encontrado.', 'error');
      } catch (err) {
        console.error(err);
        showToast('Erro ao buscar usuário.', 'error');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const term = (this.value || '').trim().toLowerCase();
      filterFriends(term);
    });
  }

  seeMoreLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const isSuggestionsLink = this.closest('.sidebar-section') !== null;
      if (isSuggestionsLink) {
        loadMoreSuggestions(this);
      } else {
        loadMoreFriends();
      }
    });
  });

});