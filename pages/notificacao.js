// pages/notificacao/notificacao.js
// Compat SDK (v9 compat)

document.addEventListener('DOMContentLoaded', () => {
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
    const db   = firebase.firestore();
  
    const container      = document.getElementById('notifications-container');
    const markAllBtn     = document.getElementById('markAllReadBtn');
    const logoutBtn      = document.getElementById('logout-btn');
  
    let unsubscribe = null;
  
    // ---------- util ----------
    const DEFAULT_AVATAR = '../img/Design sem nome2.png';
  
    const safeToDate = (ts) => {
      try {
        if (!ts) return null;
        return ts.toDate ? ts.toDate() : new Date(ts);
      } catch { return null; }
    };
    const timeAgo = (date) => {
      if (!date) return '';
      const s = Math.floor((Date.now() - date.getTime()) / 1000);
      if (s < 60) return 'agora';
      if (s < 3600) return `${Math.floor(s/60)} min atrás`;
      if (s < 86400) return `${Math.floor(s/3600)} h atrás`;
      return `${Math.floor(s/86400)} d atrás`;
    };
  
    async function loadUserProfile(uid) {
      if (!uid) return null;
      const snap = await db.collection('users').doc(uid).get();
      if (!snap.exists) return null;
      const u = snap.data() || {};
      return {
        name: u.displayName || u.name || u.nickname || 'Estudante',
        photoURL: u.photoURL || u.avatarUrl || u.photo || null
      };
    }
  
    async function fillNotificationVisualFields(n) {
      // Se já veio pronto, usa; senão, carrega do perfil
      if (!n.fromUserName || !n.fromUserPhoto) {
        const p = await loadUserProfile(n.fromUserId);
        if (p) {
          n.fromUserName  = n.fromUserName  || p.name;
          n.fromUserPhoto = n.fromUserPhoto || p.photoURL || DEFAULT_AVATAR;
        } else {
          n.fromUserName  = n.fromUserName  || 'Estudante';
          n.fromUserPhoto = n.fromUserPhoto || DEFAULT_AVATAR;
        }
      }
      return n;
    }
  
    function renderEmpty() {
      container.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>Nenhuma notificação encontrada.</p>
        </div>`;
    }
  
    function renderItem(n) {
      const d = safeToDate(n.timestamp);
      const sinceText = timeAgo(d);
  
      const isActionableFR = n.type === 'friend_request' && n.requestId;
  
      const div = document.createElement('div');
      div.className = `notification-item ${n.read ? '' : 'unread'}`;
      div.innerHTML = `
        <img src="${n.fromUserPhoto || DEFAULT_AVATAR}" alt="Avatar" class="notification-avatar">
        <div class="notification-content">
          <p class="notification-text">
            <strong>${n.fromUserName || 'Estudante'}</strong>
            ${messageFor(n)}
          </p>
          <span class="notification-time">${sinceText || ''}</span>
          ${isActionableFR ? `
            <div class="notification-item-actions">
              <button class="notification-action-btn accept-btn">Aceitar</button>
              <button class="notification-action-btn decline-btn">Recusar</button>
            </div>` : ``}
        </div>
      `;
  
      // Click navegação para post/perfil/grupo (não para friend_request)
      if (!isActionableFR) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
          let url = '#';
          if (n.postId)       url = `../index.html?post=${n.postId}`;
          else if (n.groupId) url = `../Club/grupos.html`;
          else if (n.fromUserId) url = `../pages/user.html?uid=${n.fromUserId}`;
          window.location.href = url;
        });
      }
  
      // Ações de amizade
      const acceptBtn = div.querySelector('.accept-btn');
      if (acceptBtn) acceptBtn.addEventListener('click', () => handleFR(n, 'accept', div));
      const declineBtn = div.querySelector('.decline-btn');
      if (declineBtn) declineBtn.addEventListener('click', () => handleFR(n, 'decline', div));
  
      container.appendChild(div);
    }
  
    function messageFor(n) {
      switch (n.type) {
        case 'friend_request':   return 'enviou um pedido de amizade';
        case 'like':             return 'curtiu seu post';
        case 'comment':          return 'comentou no seu post';
        case 'share':            return 'repostou seu post';
        case 'group_invite':     return 'convidou você para um grupo';
        default:                 return n.content || 'enviou uma notificação';
      }
    }
  
    async function handleFR(n, action, element) {
      try {
        const batch = db.batch();
  
        // marca a notificação
        const nref = db.collection('users').doc(n.toUserId).collection('notifications').doc(n.id);
        batch.update(nref, { read: true, handledAt: firebase.firestore.FieldValue.serverTimestamp() });
  
        // status do pedido: schema raiz OU subcoleção
        if (n.requestDocPath) {
          const rref = db.doc(n.requestDocPath);
          batch.update(rref, { status: action === 'accept' ? 'accepted' : 'declined', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
  
        if (action === 'accept' && n.fromUserId && n.toUserId) {
          const now = firebase.firestore.FieldValue.serverTimestamp();
          const aRef = db.collection('users').doc(n.toUserId).collection('friends').doc(n.fromUserId);
          const bRef = db.collection('users').doc(n.fromUserId).collection('friends').doc(n.toUserId);
          batch.set(aRef, { since: now, status: 'accepted' }, { merge: true });
          batch.set(bRef, { since: now, status: 'accepted' }, { merge: true });
        }
  
        await batch.commit();
        element.remove();
        if (!container.querySelector('.notification-item')) renderEmpty();
        // opcional: disparar evento para badge global
        window.dispatchEvent(new CustomEvent('crowd:notifications:count', { detail: { pending: container.querySelectorAll('.notification-item.unread').length }}));
      } catch (e) {
        console.error('Falha ao processar pedido de amizade:', e);
        alert('Não foi possível processar o pedido. Tente novamente.');
      }
    }
  
    // ---------- leitura em tempo real ----------
    function listen(uid) {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  
      container.innerHTML = `<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>`;
  
      const q = db.collection('users').doc(uid).collection('notifications')
        .orderBy('timestamp', 'desc').limit(50);
  
      unsubscribe = q.onSnapshot(async (snap) => {
        container.innerHTML = '';
        if (snap.empty) { renderEmpty(); return; }
  
        // carrega perfis que faltarem
        const docs = await Promise.all(snap.docs.map(async d => {
          const n = { id: d.id, ...d.data() };
          // normaliza campos base (p/ evitar quebras)
          n.toUserId     = n.toUserId     || uid;
          n.fromUserId   = n.fromUserId   || n.senderId || n.userId;
          n.type         = n.type         || n.kind || 'generic';
          n.timestamp    = n.timestamp    || n.createdAt || n.time;
          n.requestDocPath = n.requestDocPath || n.requestPath || null;
          return fillNotificationVisualFields(n);
        }));
  
        docs.forEach(renderItem);
  
        // atualiza badge global (opcional)
        const unread = docs.filter(n => !n.read).length;
        window.dispatchEvent(new CustomEvent('crowd:notifications:count', { detail: { pending: unread }}));
      }, (err) => {
        console.error('Erro ao ler notificações:', err);
        container.innerHTML = `<div class="error-message">Erro ao carregar notificações.</div>`;
      });
    }
  async function acceptFriendRequest(requestId, fromUserId, notificationId, element) {
  try {
    if (!currentUser || !currentUserProfile) throw new Error("Usuário não autenticado.");

    // Tenta localizar o doc do pedido (suporta raiz e subcoleção)
    const candidates = [
      db.collection('friendRequests').doc(requestId),                                 // raiz por id
      db.collection('users').doc(currentUser.uid).collection('friendRequests').doc(fromUserId),  // sub: me/pedidos/{from}
      db.collection('users').doc(fromUserId).collection('friendRequests').doc(currentUser.uid),  // sub: from/pedidos/{me} (fallback)
    ];

    let requestRef = null, requestSnap = null;
    for (const ref of candidates) {
      const s = await ref.get();
      if (s.exists) { requestRef = ref; requestSnap = s; break; }
    }

    // carrega perfis mínimos
    const fromUserDoc = await db.collection('users').doc(fromUserId).get();
    if (!fromUserDoc.exists) throw new Error("O usuário que enviou o pedido não existe mais.");
    const fromUserData = fromUserDoc.data();

    const batch = db.batch();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    // Cria vínculo de amizade nos dois lados
    const aRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
    const bRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
    batch.set(aRef, { nickname: fromUserData.nickname || 'Usuário', photoURL: fromUserData.photoURL || null, since: now, status: 'accepted' }, { merge: true });
    batch.set(bRef, { nickname: currentUserProfile.nickname || 'Usuário', photoURL: currentUserProfile.photoURL || null, since: now, status: 'accepted' }, { merge: true });

    // Atualiza (ou apaga) o doc do pedido
    if (requestRef) {
      batch.set(requestRef, { status: 'accepted', updatedAt: now }, { merge: true });
      // opcional: deletar o pedido se não precisar manter histórico
      // batch.delete(requestRef);
    }

    // APAGA a notificação (assim ela some do snapshot)
    const nref = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
    batch.delete(nref);

    await batch.commit();

    // Remove do DOM imediatamente (UX)
    element.remove();
    if (!notificationsContainer.querySelector('.notification-item')) {
      notificationsContainer.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>Nenhuma notificação encontrada.</p>
        </div>`;
    }

    // atualiza badge global (se você usa)
    window.dispatchEvent(new CustomEvent('crowd:notifications:count', {
      detail: { pending: notificationsContainer.querySelectorAll('.notification-item.unread').length }
    }));
  } catch (e) {
    console.error('Falha ao aceitar pedido de amizade:', e);
    alert('Não foi possível aceitar o pedido. Tente novamente.');
  }
}

async function rejectFriendRequest(requestId, notificationId, element) {
  try {
    if (!currentUser) throw new Error("Usuário não autenticado.");

    const candidates = [
      db.collection('friendRequests').doc(requestId),
      db.collection('users').doc(currentUser.uid).collection('friendRequests').doc(requestId),
    ];

    const batch = db.batch();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    for (const ref of candidates) {
      const s = await ref.get();
      if (s.exists) {
        batch.set(ref, { status: 'declined', updatedAt: now }, { merge: true });
        // opcional: apagar em vez de só marcar
        // batch.delete(ref);
        break;
      }
    }

    // APAGA a notificação
    const nref = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
    batch.delete(nref);

    await batch.commit();

    element.remove();
    if (!notificationsContainer.querySelector('.notification-item')) {
      notificationsContainer.innerHTML = `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>Nenhuma notificação encontrada.</p>
        </div>`;
    }
    window.dispatchEvent(new CustomEvent('crowd:notifications:count', {
      detail: { pending: notificationsContainer.querySelectorAll('.notification-item.unread').length }
    }));
  } catch (e) {
    console.error('Falha ao recusar pedido de amizade:', e);
    alert('Não foi possível recusar o pedido. Tente novamente.');
  }
}

    async function markAllAsRead(uid) {
      const col = db.collection('users').doc(uid).collection('notifications').where('read', '==', false);
      const snap = await col.get();
      const batch = db.batch();
      snap.forEach(d => batch.update(d.ref, { read: true, readAt: firebase.firestore.FieldValue.serverTimestamp() }));
      await batch.commit();
    }
  
    // ---------- eventos UI / auth ----------
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
      e.preventDefault(); auth.signOut().then(() => location.href = '../login/login.html');
    });
    if (markAllBtn) markAllBtn.addEventListener('click', async () => {
      const u = auth.currentUser; if (!u) return;
      await markAllAsRead(u.uid);
    });
  
    firebase.auth().onAuthStateChanged((u) => {
      if (!u) { location.href = '../login/login.html'; return; }
      listen(u.uid);
    });
  });
  