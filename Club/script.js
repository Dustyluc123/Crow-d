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

    // Autenticação
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            loadGroups();
        } else {
            window.location.href = '../login/login.html';
        }
    });

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

    // Criar Card do Grupo
    function createGroupCard(group, isMember) {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.dataset.groupId = group.id;

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
                    ${isMember ? `
                        <button class="group-btn chat-btn"><i class="fas fa-comment"></i> Entrar no Chat</button>
                        <button class="group-btn view-members-btn"><i class="fas fa-users"></i> Ver Membros</button>
                        <button class="group-btn secondary leave-btn"><i class="fas fa-sign-out-alt"></i> Sair</button>
                    ` : `
                        <button class="group-btn join-btn"><i class="fas fa-plus"></i> Participar</button>
                    `}
                </div>
            </div>
        `;

        if (isMember) {
            card.querySelector('.chat-btn').addEventListener('click', () => {
                window.location.href = `chat.html?groupId=${group.id}`;
            });
            card.querySelector('.leave-btn').addEventListener('click', () => leaveGroup(group.id));
            card.querySelector('.view-members-btn').addEventListener('click', () => viewMembers(group.id));
        } else {
            card.querySelector('.join-btn').addEventListener('click', () => joinGroup(group.id, group.isPrivate, group.password));
        }
        return card;
    }

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

    // Entrar em um Grupo
    async function joinGroup(groupId, isPrivate, password) {
        if (isPrivate) {
            const enteredPassword = prompt("Este grupo é privado. Por favor, digite a senha:");
            if (enteredPassword !== password) {
                alert("Senha incorreta.");
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

    // Sair de um Grupo
    async function leaveGroup(groupId) {
        if (!confirm("Tem certeza que deseja sair deste grupo?")) return;
        try {
            await db.collection('groups').doc(groupId).update({
                members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
            loadGroups();
        } catch (error) {
            console.error("Erro ao sair do grupo:", error);
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

    // Lógica do Modal
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', () => { createGroupModal.style.display = 'flex'; });
    }
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            createGroupModal.style.display = 'none';
            viewMembersModal.style.display = 'none';
        });
    });
    window.addEventListener('click', (event) => {
        if (event.target === createGroupModal) {
            createGroupModal.style.display = 'none';
        }
        if (event.target === viewMembersModal) {
            viewMembersModal.style.display = 'none';
        }
    });

    // --- CORREÇÃO APLICADA AQUI ---
    isPrivateCheckbox.addEventListener('change', () => {
        // Usa classList.toggle para adicionar/remover a classe .visible
        // que controla a animação do CSS.
        passwordField.classList.toggle('visible', isPrivateCheckbox.checked);
    });
});