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
                const nameMatch = group.name.toLowerCase().includes(searchTermLower);
                const tagMatch = group.tags.some(tag => tag.toLowerCase().includes(searchTermLower));
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

        // Adiciona os eventos aos botões
        if (isMember) {
            card.querySelector('.chat-btn').addEventListener('click', () => {
                window.location.href = `chat.html?groupId=${group.id}`;
            });
            card.querySelector('.view-members-btn').addEventListener('click', () => viewMembers(group.id));
            card.querySelector('.share-group-btn').addEventListener('click', () => openShareModal(group.id, group.name)); // Evento para o novo botão
            
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

    // --- NOVAS FUNÇÕES PARA COMPARTILHAR O GRUPO ---

    async function openShareModal(groupId, groupName) {
        currentGroupIdToShare = groupId;
        shareGroupName.textContent = groupName;
        shareFriendsList.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>';
        shareGroupModal.style.display = 'flex';

        try {
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
            shareFriendsList.innerHTML = '';

            if (friendsSnapshot.empty) {
                shareFriendsList.innerHTML = '<p>Você não tem amigos para compartilhar.</p>';
                sendShareBtn.style.display = 'none'; // Esconde o botão se não há amigos
                return;
            }
            sendShareBtn.style.display = 'block'; // Mostra o botão se há amigos

            friendsSnapshot.forEach(doc => {
                const friend = { id: doc.id, ...doc.data() };
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-share-item';
                friendElement.innerHTML = `
                    <label style="display: flex; align-items: center; padding: 5px; cursor: pointer;">
                        <input type="checkbox" class="friend-share-checkbox" value="${friend.id}" style="margin-right: 10px;">
                        <img src="${friend.photoURL || '../img/Design sem nome2.png'}" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;">
                        <span>${friend.nickname}</span>
                    </label>
                `;
                shareFriendsList.appendChild(friendElement);
            });
        } catch (error) {
            console.error("Erro ao carregar amigos para compartilhar:", error);
            shareFriendsList.innerHTML = '<p>Ocorreu um erro ao carregar seus amigos.</p>';
        }
    }

    async function sendShareInvites() {
        const selectedFriends = document.querySelectorAll('.friend-share-checkbox:checked');
        if (selectedFriends.length === 0) {
            alert("Selecione pelo menos um amigo para compartilhar.");
            return;
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
            alert('Convites enviados com sucesso!');
            shareGroupModal.style.display = 'none';
        } catch (error) {
            console.error("Erro ao enviar convites de grupo:", error);
            alert('Ocorreu um erro ao enviar os convites.');
        }
    }


    // --- FUNÇÕES EXISTENTES (sem alteração) ---

    // Criar Grupo
    createGroupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const groupName = document.getElementById('groupName').value.trim();
        const groupDescription = document.getElementById('groupDescription').value.trim();
        const tagsInput = document.getElementById('groupTags').value;
        const groupTags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
        const isPrivate = isPrivateCheckbox.checked;
        const password = document.getElementById('groupPassword').value;

        if (!groupName || !groupDescription) {
            alert("Por favor, preencha o nome e a descrição.");
            return;
        }

        if (isPrivate && !password) {
            alert("Por favor, digite uma senha para o grupo privado.");
            return;
        }

        try {
            await db.collection('groups').add({
                name: groupName,
                description: groupDescription,
                tags: groupTags,
                members: [currentUser.uid],
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isPrivate: isPrivate,
                password: password
            });

            createGroupModal.style.display = 'none';
            createGroupForm.reset();
            loadGroups();
        } catch (error) {
            console.error("Erro ao criar grupo:", error);
            alert("Ocorreu um erro ao criar o grupo.");
        }
    });

   async function joinGroup(groupId, isPrivate, password) {
        if (isPrivate) {
            const enteredPassword = await showPromptModal("Grupo Privado", "Este grupo é privado. Por favor, digite a senha:", 'password');
            if (enteredPassword === null) return; // Utilizador cancelou
            if (enteredPassword !== password) {
                showCustomAlert("Senha incorreta.");
                return;
            }
        }
        try {
            await db.collection('groups').doc(groupId).update({
                members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
            loadGroups();
        } catch (error) {
            console.error("Erro ao entrar no grupo:", error);
        }
    }

    async function leaveGroup(groupId) {
        const confirmed = await showConfirmationModal("Sair do Grupo", "Tem a certeza que deseja sair deste grupo?");
        if (!confirmed) return;

        try {
            await db.collection('groups').doc(groupId).update({
                members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
            loadGroups();
        } catch (error) {
            console.error("Erro ao sair do grupo:", error);
        }
    }


    // Excluir um Grupo
    async function deleteGroup(groupId) {
        
             const confirmed = await showConfirmationModal(
            "Excluir Grupo", 
            "Excluir o grupo apagará permanentemente todas as mensagens e removerá todos os membros. Esta ação não pode ser desfeita.",
            "Sim, Excluir",
            "Cancelar"
        );
        if (!confirmed) return;

        try {
            const groupRef = db.collection('groups').doc(groupId);
            
            const messagesSnapshot = await groupRef.collection('messages').get();
            const batch = db.batch();
            messagesSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            await groupRef.delete();

            alert("Grupo excluído com sucesso.");
            loadGroups();

        } catch (error) {
            console.error("Erro ao excluir o grupo:", error);
            alert("Ocorreu um erro ao excluir o grupo.");
        }
    }

    // Ver Membros
    async function viewMembers(groupId) {
        membersList.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        viewMembersModal.style.display = 'flex';

        try {
            const groupDoc = await db.collection('groups').doc(groupId).get();
            const groupData = groupDoc.data();
            const members = groupData.members;

            membersList.innerHTML = '';
            for (const memberId of members) {
                const userDoc = await db.collection('users').doc(memberId).get();
                const userData = userDoc.data();
                const memberElement = document.createElement('div');
                memberElement.innerHTML = `<p>${userData.nickname}</p>`;
                membersList.appendChild(memberElement);
            }
        } catch (error) {
            console.error("Erro ao carregar membros:", error);
            membersList.innerHTML = '<p>Ocorreu um erro ao carregar os membros.</p>';
        }
    }

    // Lógica da Busca
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