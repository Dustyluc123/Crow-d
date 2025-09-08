document.addEventListener('DOMContentLoaded', () => {
  // ================================
  // Firebase config (compat SDK)
  // ================================
  const firebaseConfig = {
    apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
    authDomain: "tcclogin-7e7b8.firebaseapp.com",
    projectId: "tcclogin-7e7b8",
    storageBucket: "tcclogin-7e7b8.appspot.com",
    messagingSenderId: "1066633833169",
    appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // ================================
  // Fallback helpers (não conflitam se já existirem versões melhores)
  // ================================
  window.showToast = window.showToast || ((msg, type='info') => {
    console[(type === 'error' ? 'error' : 'log')]('[Toast]', msg);
    alert(msg);
  });
  window.showPromptModal = window.showPromptModal || (async (title, message, inputType='text') => {
    const val = prompt(`${title}\n\n${message}`);
    return val === null ? null : String(val);
  });
  window.showConfirmationModal = window.showConfirmationModal || (async (title, message, confirmLabel='OK') => {
    return confirm(`${title}\n\n${message}`);
  });
  window.showCustomAlert = window.showCustomAlert || ((msg) => alert(msg));

  // ================================
  // Estado atual do usuário
  // ================================
  let currentUser = null;
  let currentUserProfile = null;

  // ================================
  // Referências de DOM (todas opcionais)
  // ================================
  const myGroupsContainer        = document.getElementById('my-groups-container');
  const suggestedGroupsContainer = document.getElementById('suggested-groups-container');

  const createGroupModal = document.getElementById('createGroupModal');
  const createGroupBtn   = document.getElementById('createGroupBtn');
  const closeModalBtns   = document.querySelectorAll('.close-modal, .close-modal-btn');
  const createGroupForm  = document.querySelector('#createGroupModal .modal-form');

  const searchInput        = document.getElementById('search-input');
  const isPrivateCheckbox  = document.getElementById('isPrivate');
  const passwordFieldWrap  = document.getElementById('password-field'); // container que mostra/esconde
  const viewMembersModal   = document.getElementById('viewMembersModal');
  const membersList        = document.getElementById('members-list');

  // Modal de compartilhar grupo
  const shareGroupModal  = document.getElementById('shareGroupModal');
  const shareGroupName   = document.getElementById('shareGroupName');
  const shareFriendsList = document.getElementById('share-friends-list');
  const sendShareBtn     = document.getElementById('sendShareBtn');
  let currentGroupIdToShare = null;



  
  // ================================
  // Autenticação
  // ================================
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // se não autenticado, manda pro login
      window.location.href = '../login/login.html';
      return;
    }
    currentUser = user;

    await loadUserProfile(user.uid);

    const profileLink = document.querySelector('.main-nav a.profile-link');
    if (profileLink) profileLink.href = `../pages/user.html?uid=${user.uid}`;

    await loadGroups();
  });

  async function loadUserProfile(userId) {
    try {
      const snap = await db.collection('users').doc(userId).get();
      currentUserProfile = snap.exists ? (snap.data() || null) : null;
    } catch (e) {
      console.error('Erro ao carregar perfil do usuário:', e);
      currentUserProfile = null;
    }
  }

  // ================================
  // Carregar grupos (meus e sugeridos) + busca
  // ================================
  async function loadGroups(searchTerm = '') {
    if (!myGroupsContainer || !suggestedGroupsContainer) return;

    myGroupsContainer.innerHTML        = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    suggestedGroupsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

    try {
      const snapshot = await db.collection('groups').orderBy('createdAt', 'desc').get();

      myGroupsContainer.innerHTML        = '';
      suggestedGroupsContainer.innerHTML = '';

      const term = (searchTerm || '').toLowerCase();

      // Filtra por nome/tags (tags garantidas como array)
      const filteredDocs = snapshot.docs.filter(d => {
        const g = d.data() || {};
        const nameMatch = (g.name || '').toLowerCase().includes(term);
        const tags      = Array.isArray(g.tags) ? g.tags : [];
        const tagMatch  = tags.some(tag => (tag || '').toLowerCase().includes(term));
        return term ? (nameMatch || tagMatch) : true;
      });

      if (filteredDocs.length === 0) {
        myGroupsContainer.innerHTML = '<p>Nenhum grupo encontrado.</p>';
        suggestedGroupsContainer.innerHTML = '';
        return;
      }

      let hasMyGroups = false;
      let hasSuggested = false;

      filteredDocs.forEach(doc => {
        const group = { id: doc.id, ...(doc.data() || {}) };
        const members = Array.isArray(group.members) ? group.members : [];
        const isMember = currentUser ? members.includes(currentUser.uid) : false;

        const card = createGroupCard(group, isMember);
        (isMember ? myGroupsContainer : suggestedGroupsContainer).appendChild(card);

        if (isMember) hasMyGroups = true;
        else hasSuggested = true;
      });

      if (!hasMyGroups && !term) {
        myGroupsContainer.innerHTML = '<p>Você ainda não participa de nenhum grupo.</p>';
      }
      if (!hasSuggested && !term) {
        suggestedGroupsContainer.innerHTML = '<p>Nenhuma sugestão de grupo no momento.</p>';
      }

    } catch (e) {
      console.error('Erro ao carregar grupos:', e);
      myGroupsContainer.innerHTML = '<p>Ocorreu um erro ao carregar os grupos.</p>';
      suggestedGroupsContainer.innerHTML = '';
    }
  }
// Dentro do seu arquivo script.js

// Encontre o listener do formulário de criação de grupo
if (createGroupForm) {
  createGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { showToast('Você precisa estar logado.', 'error'); return; }

    const nameEl = createGroupForm.querySelector('#groupName');
    const descEl = createGroupForm.querySelector('#groupDescription');
    
    // As tags agora são selecionadas pelos checkboxes
    const tagsCheckboxes = createGroupForm.querySelectorAll('input[name="group-tags"]:checked');
    const tags = Array.from(tagsCheckboxes).map(cb => cb.value);

    const passEl = createGroupForm.querySelector('#groupPassword');

    const name = (nameEl?.value || '').trim();
    const description = (descEl?.value || '').trim();
    const isPrivate = !!isPrivateCheckbox?.checked;
    const password = isPrivate ? (passEl?.value || '').trim() : null;

    // --- ADIÇÃO DA VALIDAÇÃO DE 20 CARACTERES ---
    if (name.length > 20) {
        showToast('O nome do grupo não pode ter mais de 20 caracteres.', 'error');
        return; // Impede a criação do grupo
    }
    // --- FIM DA VALIDAÇÃO ---

    if (!name) { showToast('Dê um nome ao grupo.', 'error'); return; }
    if (tags.length === 0) { showToast('Selecione pelo menos uma tag para o grupo.', 'error'); return; } // Validação para tags
    if (isPrivate && !password) { showToast('Informe a senha do grupo privado.', 'error'); return; }

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const doc = {
      name,
      description,
      tags, // Salva as tags selecionadas
      isPrivate,
      password: isPrivate ? password : null,
      createdBy: currentUser.uid,
      admins: [currentUser.uid],
      members: [currentUser.uid],
      createdAt: now,
      updatedAt: now,
    };

    const btn = createGroupForm.querySelector('button[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

    try {
      await db.collection('groups').add(doc);
      showToast('Grupo criado!', 'success');
      if (createGroupModal) createGroupModal.style.display = 'none';
      createGroupForm.reset();
      if(passwordFieldWrap) passwordFieldWrap.classList.remove('visible');
      await loadGroups();
    } catch (e2) {
      console.error('Erro ao criar grupo:', e2);
      showToast('Não foi possível criar o grupo.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}
  function createGroupCard(group, isMember) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;

    const isOwner   = (group.createdBy === (currentUser?.uid || ''));
    const members   = Array.isArray(group.members) ? group.members : [];
    const tags      = Array.isArray(group.tags) ? group.tags : [];
    const fullDesc  = String(group.description || '');

    // “Ver mais” p/ descrição
    const DESCRIPTION_LIMIT = 100;
    const needsToggle = fullDesc.length > DESCRIPTION_LIMIT;

    let actionsHTML = '';
    if (isMember) {
      actionsHTML = `
        <button class="group-btn chat-btn"><i class="fas fa-comment"></i> Entrar no Chat</button>
        <button class="group-btn view-members-btn"><i class="fas fa-users"></i> Ver Membros</button>
        <button class="group-btn share-group-btn"><i class="fas fa-share-alt"></i> Compartilhar</button>
      `;
      actionsHTML += isOwner
        ? `<button class="group-btn danger delete-group-btn"><i class="fas fa-trash"></i> Excluir Grupo</button>`
        : `<button class="group-btn secondary leave-btn"><i class="fas fa-sign-out-alt"></i> Sair</button>`;
    } else {
      actionsHTML = `<button class="group-btn join-btn"><i class="fas fa-plus"></i> Participar</button>`;
    }

    card.innerHTML = `
      <div class="group-header">
        <h3>${group.name || 'Grupo'}</h3>
        <div class="group-members"><i class="fas fa-users"></i> ${members.length}</div>
      </div>
      <div class="group-content">
        <p class="group-description${needsToggle ? '' : ' expanded'}">${fullDesc}</p>
        ${needsToggle ? `<button class="toggle-description-btn">Ver mais</button>` : ''}
        <div class="group-tags">
          ${tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
        </div>
        <div class="group-actions">
          ${actionsHTML}
        </div>
      </div>
    `;

    // Toggle “ver mais”
    if (needsToggle) {
      const toggleBtn = card.querySelector('.toggle-description-btn');
      const descEl    = card.querySelector('.group-description');
      toggleBtn?.addEventListener('click', () => {
        const expanded = descEl.classList.toggle('expanded');
        toggleBtn.textContent = expanded ? 'Ver menos' : 'Ver mais';
      });
    }

    // Botões
    if (isMember) {
      card.querySelector('.chat-btn')?.addEventListener('click', () => {
        window.location.href = `chat.html?groupId=${group.id}`;
      });
      card.querySelector('.view-members-btn')?.addEventListener('click', () => viewMembers(group.id));
      card.querySelector('.share-group-btn')?.addEventListener('click', () => openShareModal(group.id, group.name || 'Grupo'));

      if (isOwner) {
        card.querySelector('.delete-group-btn')?.addEventListener('click', () => deleteGroup(group.id));
      } else {
        card.querySelector('.leave-btn')?.addEventListener('click', () => leaveGroup(group.id));
      }
    } else {
      card.querySelector('.join-btn')?.addEventListener('click', () => {
        joinGroup(group.id, !!group.isPrivate, group.password || null);
      });
    }

    return card;
  }

  // ================================
  // Ações: entrar/sair/excluir/ver membros
  // ================================
  async function joinGroup(groupId, isPrivate, password) {
    if (isPrivate) {
      const enteredPassword = await showPromptModal('Grupo privado', 'Este grupo é privado. Digite a senha:', 'password');
      if (enteredPassword === null) return; // cancelou
      if (enteredPassword !== password) { showCustomAlert('Senha incorreta.'); return; }
    }
    try {
      await db.collection('groups').doc(groupId).update({
        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
      });
      await loadGroups((searchInput?.value || ''));
    } catch (e) {
      console.error('Erro ao entrar no grupo:', e);
      showToast('Não foi possível entrar no grupo.', 'error');
    }
  }

  async function leaveGroup(groupId) {
    const ok = await showConfirmationModal('Sair do Grupo', 'Tem certeza que deseja sair deste grupo?');
    if (!ok) return;

    try {
      await db.collection('groups').doc(groupId).update({
        members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
      });
      await loadGroups((searchInput?.value || ''));
    } catch (e) {
      console.error('Erro ao sair do grupo:', e);
      showToast('Não foi possível sair do grupo.', 'error');
    }
  }

  async function deleteGroup(groupId) {
    const ok = await showConfirmationModal(
      'Excluir Grupo',
      'Excluir o grupo apagará permanentemente todas as mensagens e removerá todos os membros. Esta ação não pode ser desfeita.',
      'Sim, Excluir'
    );
    if (!ok) return;

    try {
      const groupRef = db.collection('groups').doc(groupId);

      // apaga mensagens primeiro (em batch)
      const msgs = await groupRef.collection('messages').get();
      const batch = db.batch();
      msgs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // apaga o grupo
      await groupRef.delete();

      showToast('Grupo excluído com sucesso.', 'success');
      await loadGroups((searchInput?.value || ''));
    } catch (e) {
      console.error('Erro ao excluir o grupo:', e);
      showToast('Ocorreu um erro ao excluir o grupo.', 'error');
    }
  }

  async function viewMembers(groupId) {
    if (!membersList || !viewMembersModal) return;
    membersList.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    viewMembersModal.style.display = 'flex';

    try {
      const groupSnap = await db.collection('groups').doc(groupId).get();
      const groupData = groupSnap.data() || {};
      const members = Array.isArray(groupData.members) ? groupData.members : [];

      membersList.innerHTML = '';
      for (const uid of members) {
        const u = await db.collection('users').doc(uid).get();
        const data = u.data() || {};
        const el = document.createElement('div');
        el.className = 'member-row';
        el.innerHTML = `<p>${data.nickname || 'Usuário'}</p>`;
        membersList.appendChild(el);
      }
    } catch (e) {
      console.error('Erro ao carregar membros:', e);
      membersList.innerHTML = '<p>Ocorreu um erro ao carregar os membros.</p>';
    }
  }

  // ================================
  // Compartilhar grupo com amigos (notificações)
  // ================================
  async function openShareModal(groupId, groupName) {
    if (!shareGroupModal || !shareFriendsList || !shareGroupName) return;

    currentGroupIdToShare = groupId;
    shareGroupName.textContent = groupName;
    shareFriendsList.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>';
    shareGroupModal.style.display = 'flex';

    try {
      const friendsSnapshot = await db.collection('users')
        .doc(currentUser.uid).collection('friends').get();

      shareFriendsList.innerHTML = '';
      if (friendsSnapshot.empty) {
        shareFriendsList.innerHTML = '<p>Você não tem amigos para compartilhar.</p>';
        if (sendShareBtn) sendShareBtn.style.display = 'none';
        return;
      }
      if (sendShareBtn) sendShareBtn.style.display = 'block';

      friendsSnapshot.forEach(doc => {
        const friend = { id: doc.id, ...(doc.data() || {}) };
        const label = document.createElement('label');
        label.className = 'friend-share-item';
        label.innerHTML = `
          <input type="checkbox" class="friend-share-checkbox" value="${friend.id}">
          <span>${friend.nickname || 'Amigo'}</span>
        `;
        shareFriendsList.appendChild(label);
      });
    } catch (e) {
      console.error('Erro ao carregar amigos:', e);
      shareFriendsList.innerHTML = '<p>Erro ao carregar amigos.</p>';
    }
  }

  async function sendShareInvites() {
    if (!shareGroupModal || !shareFriendsList || !shareGroupName) return;

    const selected = shareFriendsList.querySelectorAll('.friend-share-checkbox:checked');
    if (selected.length === 0) { showToast('Selecione pelo menos um amigo.', 'error'); return; }

    const groupName = shareGroupName.textContent || 'Grupo';
    const batch = db.batch();

    selected.forEach(cb => {
      const friendId = cb.value;
      const notifRef = db.collection('users').doc(friendId).collection('notifications').doc();
      batch.set(notifRef, {
        type: 'group_invite',
        fromUserId: currentUser.uid,
        fromUserName: (currentUserProfile?.nickname) || 'Um usuário',
        groupId: currentGroupIdToShare,
        groupName,
        content: `convidou você para se juntar ao grupo "${groupName}"`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    });

    try {
      await batch.commit();
      showToast('Convites enviados com sucesso!', 'success');
      shareGroupModal.style.display = 'none';
    } catch (e) {
      console.error('Erro ao enviar convites de grupo:', e);
      showToast('Ocorreu um erro ao enviar os convites.', 'error');
    }
  }

  // ================================
  // Listeners de UI
  // ================================
  searchInput?.addEventListener('input', (e) => {
    loadGroups(e.target.value);
  });

  createGroupBtn?.addEventListener('click', () => {
    if (createGroupModal) createGroupModal.style.display = 'flex';
  });

  sendShareBtn?.addEventListener('click', sendShareInvites);

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (createGroupModal) createGroupModal.style.display = 'none';
      if (viewMembersModal) viewMembersModal.style.display = 'none';
      if (shareGroupModal) shareGroupModal.style.display = 'none';
    });
  });

  window.addEventListener('click', (event) => {
    if (event.target === createGroupModal) createGroupModal.style.display = 'none';
    if (event.target === viewMembersModal) viewMembersModal.style.display = 'none';
    if (event.target === shareGroupModal) shareGroupModal.style.display = 'none';
  });

  isPrivateCheckbox?.addEventListener('change', () => {
    passwordFieldWrap?.classList.toggle('visible', isPrivateCheckbox.checked);
  });
});
