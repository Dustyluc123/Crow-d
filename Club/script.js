document.addEventListener('DOMContentLoaded', function() {
    // Configuração do Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
        authDomain: "tcclogin-7e7b8.firebaseapp.com",
        projectId: "tcclogin-7e7b8",
        storageBucket: "tcclogin-7e7b8.appspot.com",
        messagingSenderId: "1066633833169",
        appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
    };

    // Inicializar Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;
    let currentUserProfile = null; // Para guardar os dados do perfil do usuário logado

    // Referências do DOM
    const myGroupsContainer = document.getElementById('my-groups-container');
    const suggestedGroupsContainer = document.getElementById('suggested-groups-container');
    const createGroupModal = document.getElementById('createGroupModal');
    const createGroupBtn = document.getElementById('createGroupBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const createGroupForm = document.querySelector('#createGroupModal .modal-form');
    const searchInput = document.getElementById('search-input');
    const isPrivateCheckbox = document.getElementById('isPrivate');
    const passwordField = document.getElementById('password-field');
    const viewMembersModal = document.getElementById('viewMembersModal');
    const membersList = document.getElementById('members-list');

    // Referências do NOVO Modal de Compartilhamento
    const shareGroupModal = document.getElementById('shareGroupModal');
    const shareGroupName = document.getElementById('shareGroupName');
    const shareFriendsList = document.getElementById('share-friends-list');
    const sendShareBtn = document.getElementById('sendShareBtn');
    let currentGroupIdToShare = null;
if (createGroupForm) {
  createGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = createGroupForm.querySelector('#groupName');        // <input id="groupName" ...>
    const descEl = createGroupForm.querySelector('#groupDescription'); // <textarea id="groupDescription">
    const tagsEl = createGroupForm.querySelector('#groupTags');        // <input id="groupTags" placeholder="tag1, tag2">
    const passEl = createGroupForm.querySelector('#groupPassword');    // <input id="groupPassword" type="password">

    const name = (nameEl?.value || '').trim();
    const description = (descEl?.value || '').trim();
    const tags = (tagsEl?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const isPrivate = !!isPrivateCheckbox?.checked;
    const password = isPrivate ? (passEl?.value || '') : null;

    if (!name) { showToast('Dê um nome ao grupo.', 'error'); return; }
    if (isPrivate && !password) { showToast('Informe a senha do grupo privado.', 'error'); return; }

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const doc = {
      name,
      description,
      tags,
      isPrivate,
      password: isPrivate ? password : null, // ⚠️ plaintext; considere hashear
      createdBy: currentUser.uid,
      admins: [currentUser.uid],
      members: [currentUser.uid],
      createdAt: now,
      updatedAt: now
    };

    const btn = createGroupForm.querySelector('button[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }

    try {
      await db.collection('groups').add(doc);     // ou .doc(slug).set(doc)
      showToast('Grupo criado!', 'success');
      createGroupModal.style.display = 'none';
      createGroupForm.reset();
      passwordField?.classList.remove('visible');
      loadGroups();
      // se quiser redirecionar: window.location.href = `./chat.html?groupId=${ref.id}`;
    } catch (e) {
      console.error('Erro ao criar grupo:', e);
      showToast('Não foi possível criar o grupo.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}

    // Autenticação
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid); // Carrega o perfil do usuário logado
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            loadGroups();
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // Função para carregar o perfil do usuário logado
    async function loadUserProfile(userId) {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        }
    }

    // Carregar Grupos
    async function loadGroups(searchTerm = '') {
        myGroupsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        suggestedGroupsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        try {
            const snapshot = await db.collection('groups').orderBy('createdAt', 'desc').get();
            myGroupsContainer.innerHTML = '';
            suggestedGroupsContainer.innerHTML = '';

            let hasMyGroups = false;
            let hasSuggestedGroups = false;

            const filteredDocs = snapshot.docs.filter(doc => {
  const group = doc.data();
  const searchTermLower = searchTerm.toLowerCase();

  const nameMatch = (group.name || '').toLowerCase().includes(searchTermLower);

  // ✅ garante array
  const tags = Array.isArray(group.tags) ? group.tags : [];
  const tagMatch = tags.some(tag => (tag || '').toLowerCase().includes(searchTermLower));

  return nameMatch || tagMatch;
});


            if (filteredDocs.length === 0) {
                 myGroupsContainer.innerHTML = '<p>Nenhum grupo encontrado.</p>';
            }

            filteredDocs.forEach(doc => {
                const group = { id: doc.id, ...doc.data() };
                const isMember = group.members.includes(currentUser.uid);
                const card = createGroupCard(group, isMember);

                if (isMember) {
                    myGroupsContainer.appendChild(card);
                    hasMyGroups = true;
                } else {
                    suggestedGroupsContainer.appendChild(card);
                    hasSuggestedGroups = true;
                }
            });

            if (!hasMyGroups && !searchTerm) myGroupsContainer.innerHTML = '<p>Você ainda não participa de nenhum grupo.</p>';
            if (!hasSuggestedGroups && !searchTerm) suggestedGroupsContainer.innerHTML = '<p>Nenhuma sugestão de grupo no momento.</p>';

        } catch (error) {
            console.error("Erro ao carregar grupos:", error);
            myGroupsContainer.innerHTML = '<p>Ocorreu um erro ao carregar os grupos.</p>';
        }
    }

    // Criar Card do Grupo (com botão de compartilhar)
    function createGroupCard(group, isMember) {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.dataset.groupId = group.id;
        const isOwner = group.createdBy === currentUser.uid;

        let actionsHTML = '';
        if (isMember) {
            actionsHTML = `
                <button class="group-btn chat-btn"><i class="fas fa-comment"></i> Entrar no Chat</button>
                <button class="group-btn view-members-btn"><i class="fas fa-users"></i> Ver Membros</button>
                <button class="group-btn share-group-btn"><i class="fas fa-share-alt"></i> Compartilhar</button>
            `;
            if (isOwner) {
                actionsHTML += `<button class="group-btn danger delete-group-btn"><i class="fas fa-trash"></i> Excluir Grupo</button>`;
            } else {
                actionsHTML += `<button class="group-btn secondary leave-btn"><i class="fas fa-sign-out-alt"></i> Sair</button>`;
            }
        } else {
            actionsHTML = `<button class="group-btn join-btn"><i class="fas fa-plus"></i> Participar</button>`;
        }

        card.innerHTML = `
            <div class="group-header">
                <h3>${group.name}</h3>
                <div class="group-members">
                    <i class="fas fa-users"></i> ${group.members.length}
                </div>
            </div>
            <div class="group-content">
                <p class="group-description">${group.description}</p>
                <div class="group-tags">
                    ${group.tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
                </div>
                <div class="group-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;

        if (isMember) {
  card.querySelector('.chat-btn')
      .addEventListener('click', () => window.location.href = `chat.html?groupId=${group.id}`);

  card.querySelector('.view-members-btn')
      .addEventListener('click', () => viewMembers(group.id));

  card.querySelector('.share-group-btn')
      .addEventListener('click', () => openShareModal(group.id, group.name));

  if (isOwner) {
    card.querySelector('.delete-group-btn')
        .addEventListener('click', () => deleteGroup(group.id));
  } else {
    card.querySelector('.leave-btn')
        .addEventListener('click', () => leaveGroup(group.id));
  }
} else {
  card.querySelector('.join-btn')
      .addEventListener('click', () => joinGroup(group.id, group.isPrivate, group.password));
}

        return card;
    }

   async function openShareModal(groupId, groupName) {
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
      sendShareBtn.style.display = 'none';
      return;
    }
    sendShareBtn.style.display = 'block';

    friendsSnapshot.forEach(doc => {
      const friend = { id: doc.id, ...doc.data() };
      const el = document.createElement('label');
      el.className = 'friend-share-item';
      el.innerHTML = `
        <input type="checkbox" class="friend-share-checkbox" value="${friend.id}">
        <span>${friend.nickname || 'Amigo'}</span>
      `;
      shareFriendsList.appendChild(el);
    });
  } catch (e) {
    console.error('Erro ao carregar amigos:', e);
    shareFriendsList.innerHTML = '<p>Erro ao carregar amigos.</p>';
  }
}
async function sendShareInvites() {
  const selected = document.querySelectorAll('.friend-share-checkbox:checked');
  if (selected.length === 0) { showToast('Selecione pelo menos um amigo.', 'error'); return; }

  const groupName = shareGroupName.textContent;
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


        const groupName = shareGroupName.textContent;
        const batch = db.batch();

        selectedFriends.forEach(checkbox => {
            const friendId = checkbox.value;
            const notificationRef = db.collection('users').doc(friendId).collection('notifications').doc();
            batch.set(notificationRef, {
                type: 'group_invite',
                fromUserId: currentUser.uid,
                fromUserName: currentUserProfile.nickname || 'Um usuário',
                groupId: currentGroupIdToShare,
                groupName: groupName,
                content: `convidou você para se juntar ao grupo "${groupName}"`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        });

        try {
            await batch.commit();
            // Alerta substituído por Toast
            showToast('Convites enviados com sucesso!', 'success');
            shareGroupModal.style.display = 'none';
        } catch (error) {
            console.error("Erro ao enviar convites de grupo:", error);
            // Alerta substituído por Toast
            showToast('Ocorreu um erro ao enviar os convites.', 'error');
        }
    }

// Em script.js
function createGroupCard(group, isMember) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;
    const isOwner = group.createdBy === currentUser.uid;

    // --- LÓGICA DO "VER MAIS" PARA A DESCRIÇÃO ---
    const DESCRIPTION_LIMIT = 100; // Limite de 100 caracteres
    const fullDescription = group.description;
    let descriptionHTML;
    let needsToggleButton = fullDescription.length > DESCRIPTION_LIMIT;

    if (needsToggleButton) {
        // Se precisar do botão, mostramos a descrição truncada inicialmente
        descriptionHTML = `<p class="group-description">${fullDescription}</p>
                           <button class="toggle-description-btn">Ver mais</button>`;
    } else {
        // Se não, mostramos a descrição completa
        descriptionHTML = `<p class="group-description expanded">${fullDescription}</p>`;
    }
    // --- FIM DA LÓGICA ---

    let actionsHTML = '';
    if (isMember) {
        actionsHTML = `
            <button class="group-btn chat-btn"><i class="fas fa-comment"></i> Entrar no Chat</button>
            <button class="group-btn view-members-btn"><i class="fas fa-users"></i> Ver Membros</button>
            <button class="group-btn share-group-btn"><i class="fas fa-share-alt"></i> Compartilhar</button>
        `;
        if (isOwner) {
            actionsHTML += `<button class="group-btn danger delete-group-btn"><i class="fas fa-trash"></i> Excluir Grupo</button>`;
        } else {
            actionsHTML += `<button class="group-btn secondary leave-btn"><i class="fas fa-sign-out-alt"></i> Sair</button>`;
        }
    } else {
        actionsHTML = `<button class="group-btn join-btn"><i class="fas fa-plus"></i> Participar</button>`;
    }

    // Monta o HTML do card, agora com o descriptionHTML dinâmico
    card.innerHTML = `
        <div class="group-header">
            <h3>${group.name}</h3>
            <div class="group-members">
                <i class="fas fa-users"></i> ${group.members.length}
            </div>
        </div>
        <div class="group-content">
            ${descriptionHTML}
            <div class="group-tags">
                ${group.tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
            </div>
            <div class="group-actions">
                ${actionsHTML}
            </div>
        </div>
    `;

    // --- ADICIONA O EVENTO DE CLIQUE AO BOTÃO "VER MAIS" ---
    if (needsToggleButton) {
        const toggleBtn = card.querySelector('.toggle-description-btn');
        const descriptionElement = card.querySelector('.group-description');
        
        toggleBtn.addEventListener('click', () => {
            const isExpanded = descriptionElement.classList.toggle('expanded');
            toggleBtn.textContent = isExpanded ? 'Ver menos' : 'Ver mais';
        });
    }
    // --- FIM DA ADIÇÃO DO EVENTO ---

    // Adiciona os eventos aos outros botões (código existente)
    if (isMember) {
        card.querySelector('.chat-btn').addEventListener('click', () => {
            window.location.href = `chat.html?groupId=${group.id}`;
        });
        card.querySelector('.view-members-btn').addEventListener('click', () => viewMembers(group.id));
        card.querySelector('.share-group-btn').addEventListener('click', () => openShareModal(group.id, group.name));
        
        if (isOwner) {
            card.querySelector('.delete-group-btn').addEventListener('click', () => deleteGroup(group.id));
        } else {
            card.querySelector('.leave-btn').addEventListener('click', () => leaveGroup(group.id));
        }
    } else {
        card.querySelector('.join-btn').addEventListener('click', () => joinGroup(group.id, group.isPrivate, group.password));
    }
    return card;
}

 async function joinGroup(groupId, isPrivate, password) {
  if (isPrivate) {
    // Ajuste o helper conforme sua implementação: (titulo, mensagem, tipoCampo)
    const enteredPassword = await showPromptModal(
      'Grupo privado',
      'Este grupo é privado. Por favor, digite a senha:',
      'password'
    );
    if (enteredPassword === null) return;           // cancelou
    if (enteredPassword !== password) { showCustomAlert('Senha incorreta.'); return; }
  }

  try {
    await db.collection('groups').doc(groupId).update({
      members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
    loadGroups();
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
    loadGroups();
  } catch (e) {
    console.error('Erro ao sair do grupo:', e);
    showToast('Não foi possível sair do grupo.', 'error');
  }
}
async function deleteGroup(groupId) {
  const ok = await showConfirmationModal(
    'Excluir Grupo',
    'Excluir o grupo apagará permanentemente todas as mensagens e removerá todos os membros. Esta ação não pode ser desfeita.',
    'Sim, Excluir',
    'Cancelar'
  );
  if (!ok) return;

  try {
    const groupRef = db.collection('groups').doc(groupId);

    // apaga mensagens antes
    const msgs = await groupRef.collection('messages').get();
    const batch = db.batch();
    msgs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await groupRef.delete();
    showToast('Grupo excluído com sucesso.', 'success');
    loadGroups();
  } catch (e) {
    console.error('Erro ao excluir o grupo:', e);
    showToast('Ocorreu um erro ao excluir o grupo.', 'error');
  }
}
async function viewMembers(groupId) {
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

    searchInput.addEventListener('input', (e) => {
        loadGroups(e.target.value);
    });

    // Lógica do Modal (com adição para o novo modal)
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => { createGroupModal.style.display = 'flex'; });
    }
    if(sendShareBtn) {
        sendShareBtn.addEventListener('click', sendShareInvites);
    }
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            createGroupModal.style.display = 'none';
            viewMembersModal.style.display = 'none';
            shareGroupModal.style.display = 'none'; // Adicionado
        });
    });
    window.addEventListener('click', (event) => {
        if (event.target === createGroupModal) createGroupModal.style.display = 'none';
        if (event.target === viewMembersModal) viewMembersModal.style.display = 'none';
        if (event.target === shareGroupModal) shareGroupModal.style.display = 'none'; // Adicionado
    });
    isPrivateCheckbox.addEventListener('change', () => {
        passwordField.classList.toggle('visible', isPrivateCheckbox.checked);
    });
});