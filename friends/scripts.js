// Sistema de amigos para o Crow-d com Firebase
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
    function showCustomAlert(message, title = "Aviso") {
    const modal = document.getElementById('customAlertModal');
    const modalTitle = document.getElementById('customAlertTitle');
    const modalMessage = document.getElementById('customAlertMessage');
    const closeBtn = document.getElementById('customAlertCloseBtn');
    const okBtn = document.getElementById('customAlertOkBtn');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';

    function closeModal() {
        modal.style.display = 'none';
    }

    closeBtn.onclick = closeModal;
    okBtn.onclick = closeModal;

    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    };
  }
   function showToast(message, type = 'info') { // type pode ser 'success', 'error', ou 'info'
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') {
        iconClass = 'fas fa-check-circle';
    } else if (type === 'error') {
        iconClass = 'fas fa-exclamation-circle';
    }

    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;

    container.appendChild(toast);

    // Remove a notificação da tela após 5 segundos
    setTimeout(() => {
        toast.remove();
    }, 5000);
  }

    // Inicializar Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Referências aos elementos do DOM
    const pendingRequestsSection = document.getElementById('pendingRequests');
    const onlineFriendsGrid = document.getElementById('onlineFriendsGrid');
    const allFriendsGrid = document.getElementById('allFriendsGrid');
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    const searchInput = document.getElementById('searchFriends');
    const logoutButton = document.getElementById('logout-btn');
    const seeMoreLinks = document.querySelectorAll('.see-more');

    // Variáveis globais
    let currentUser = null;
    let currentUserProfile = null;
    let friendsListener = null;
    let requestsListener = null;
    let suggestionsListener = null;
    
    // Variáveis para paginação
    const FRIENDS_PER_PAGE = 6;
    let lastVisibleFriend = null;
    let lastVisibleOnlineFriend = null;
    let lastVisibleSuggestion = null;
    let isLoadingMoreFriends = false;
    let isLoadingMoreOnlineFriends = false;
    let isLoadingMoreSuggestions = false;
    let noMoreFriends = false;
    let noMoreOnlineFriends = false;
    let noMoreSuggestions = false;

    // Modal para adicionar amigo
    const addFriendBtn = document.getElementById('addFriendBtn');
    const addFriendModal = document.getElementById('addFriendModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const friendForm = document.querySelector('.modal-form');
    
    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            // Usuário está logado
            currentUser = user;
            
            // Carregar perfil do usuário
            await loadUserProfile(user.uid);
            
            // Carregar amigos, solicitações e sugestões
            loadFriendRequests();
            loadFriends();
            loadSuggestions();
        } else {
            // Usuário não está logado, redirecionar para login
            window.location.href = '../login/login.html';
        }
    });

    // Event listener para o botão de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            auth.signOut()
                .then(() => {
                    window.location.href = '../login/login.html';
                })
                .catch(error => {
                    console.error('Erro ao fazer logout:', error);
                    showToast('Erro ao fazer logout. Tente novamente.');
                });
        });
    }

    // Event listeners para o modal de adicionar amigo
    if (addFriendBtn) {
        addFriendBtn.addEventListener('click', function() {
            addFriendModal.style.display = 'flex';
        });
    }
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            addFriendModal.style.display = 'none';
        });
    });
    
    // Fechar modal ao clicar fora dele
    window.addEventListener('click', function(event) {
        if (event.target === addFriendModal) {
            addFriendModal.style.display = 'none';
        }
    });
    
    // Event listener para o formulário de adicionar amigo
    if (friendForm) {
        friendForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const friendEmail = document.getElementById('friendEmail').value.trim();
            
            if (!friendEmail) {
                showToast('Por favor, digite um e-mail ou nome de usuário válido.');
                return;
            }
            
            try {
                // Buscar usuário pelo e-mail
                const usersSnapshot = await db.collection('users')
                    .where('email', '==', friendEmail)
                    .limit(1)
                    .get();
                
                if (usersSnapshot.empty) {
                    // Tentar buscar pelo nome de usuário
                    const usersSnapshot2 = await db.collection('users')
                        .where('nickname', '==', friendEmail)
                        .limit(1)
                        .get();
                    
                    if (usersSnapshot2.empty) {
                 showToast('Usuário não encontrado. Verifique o e-mail ou nome de usuário.');
                        return;
                    }
                    
                    // Usuário encontrado pelo nome
                    const userDoc = usersSnapshot2.docs[0];
                    sendFriendRequest(userDoc.id, userDoc.data());
                } else {
                    // Usuário encontrado pelo e-mail
                    const userDoc = usersSnapshot.docs[0];
                    sendFriendRequest(userDoc.id, userDoc.data());
                }
            } catch (error) {
                console.error('Erro ao buscar usuário:', error);
                showToast('Erro ao buscar usuário. Tente novamente.');
            }
        });
    }

    // Event listener para o campo de busca
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim().toLowerCase();
            
            // Filtrar amigos exibidos
            filterFriends(searchTerm);
        });
    }

    // Event listeners para os links "Ver mais"
    seeMoreLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const target = this.getAttribute('data-target') || this.closest('.sidebar-section').querySelector('h3').textContent.toLowerCase();
            
            if (target.includes('sugestões') || target.includes('sugestão')) {
                loadMoreSuggestions();
            } else if (target.includes('online')) {
                loadMoreOnlineFriends();
            } else {
                loadMoreFriends();
            }
        });
    });

    // Função para carregar o perfil do usuário
    async function loadUserProfile(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            
            if (doc.exists) {
                currentUserProfile = doc.data();
            } else {
                console.log('Perfil do usuário não encontrado.');
                window.location.href = '../profile/profile.html';
            }
        } catch (error) {
            console.error('Erro ao carregar perfil do usuário:', error);
        }
    }

    // Função para carregar solicitações de amizade
    function loadFriendRequests() {
        // Limpar seção de solicitações
        if (pendingRequestsSection) {
            pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando solicitações...</div>';
        }
        
        // Remover listener anterior se existir
        if (requestsListener) {
            requestsListener();
        }
        
        // Criar listener para solicitações em tempo real
        requestsListener = db.collection('users').doc(currentUser.uid)
            .collection('friendRequests')
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                // Limpar seção de solicitações
                if (pendingRequestsSection) {
                    pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2>';
                }
                
                // Verificar se há solicitações
                if (snapshot.empty) {
                    if (pendingRequestsSection) {
                        pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
                    }
                    return;
                }
                
                // Adicionar cada solicitação ao DOM
                snapshot.forEach(doc => {
                    const request = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    addRequestToDOM(request);
                });
            }, error => {
                console.error('Erro ao carregar solicitações:', error);
                if (pendingRequestsSection) {
                    pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2><div class="error-message">Erro ao carregar solicitações. Tente novamente mais tarde.</div>';
                }
            });
    }

    // Função para adicionar uma solicitação ao DOM
    function addRequestToDOM(request) {
        if (!pendingRequestsSection) return;
        
        // Criar elemento de solicitação
        const requestElement = document.createElement('div');
        requestElement.className = 'request-card';
        requestElement.dataset.requestId = request.id;
        requestElement.dataset.userId = request.fromUserId;
        
        // Definir HTML da solicitação
        requestElement.innerHTML = `
            <img src="${request.fromUserPhoto || '../img/Design sem nome2.png'}" alt="Avatar" class="request-avatar">
            <div class="request-info">
                <h3 class="request-name">${request.fromUserName || 'Usuário'}</h3>
                <p class="request-mutual">${request.mutualFriends || 0} amigos em comum</p>
            </div>
            <div class="request-actions">
                <button class="request-btn accept-btn">Aceitar</button>
                <button class="request-btn secondary reject-btn">Recusar</button>
            </div>
        `;
        
        // Adicionar event listeners para os botões
        const acceptBtn = requestElement.querySelector('.accept-btn');
        const rejectBtn = requestElement.querySelector('.reject-btn');
        
        acceptBtn.addEventListener('click', function() {
            acceptFriendRequest(request.id, request.fromUserId);
        });
        
        rejectBtn.addEventListener('click', function() {
            rejectFriendRequest(request.id);
        });
        
        // Adicionar ao DOM
        pendingRequestsSection.appendChild(requestElement);
    }

    // Função para aceitar uma solicitação de amizade
    async function acceptFriendRequest(requestId, fromUserId) {
        try {
            // Obter dados do usuário que enviou a solicitação
            const userDoc = await db.collection('users').doc(fromUserId).get();
            
            if (!userDoc.exists) {
            showToast('Usuário não encontrado.');
                return;
            }
            
            const userData = userDoc.data();
            
            // Atualizar status da solicitação
            await db.collection('users').doc(currentUser.uid)
                .collection('friendRequests').doc(requestId)
                .update({
                    status: 'accepted',
                    acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Adicionar à lista de amigos do usuário atual
            await db.collection('users').doc(currentUser.uid)
                .collection('friends').doc(fromUserId)
                .set({
                    userId: fromUserId,
                    nickname: userData.nickname || 'Usuário',
                    photoURL: userData.photoURL || null,
                    school: userData.school || null,
                    hobbies: userData.hobbies || [],
                    customHobbies: userData.customHobbies || [],
                    status: 'online',
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Adicionar à lista de amigos do outro usuário
            await db.collection('users').doc(fromUserId)
                .collection('friends').doc(currentUser.uid)
                .set({
                    userId: currentUser.uid,
                    nickname: currentUserProfile.nickname || 'Usuário',
                    photoURL: currentUserProfile.photoURL || null,
                    school: currentUserProfile.school || null,
                    hobbies: currentUserProfile.hobbies || [],
                    customHobbies: currentUserProfile.customHobbies || [],
                    status: 'online',
                    lastActive: firebase.firestore.FieldValue.serverTimestamp(),
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Criar notificação para o outro usuário
            await db.collection('users').doc(fromUserId)
                .collection('notifications').add({
                    type: 'friend_accept',
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || 'Usuário',
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    content: 'aceitou sua solicitação de amizade',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            
            // Remover elemento do DOM
            const requestElement = document.querySelector(`.request-card[data-request-id="${requestId}"]`);
            if (requestElement) {
                requestElement.remove();
            }
            
            // Verificar se não há mais solicitações
            if (pendingRequestsSection && pendingRequestsSection.querySelectorAll('.request-card').length === 0) {
                pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
            }
            
            console.log('Solicitação de amizade aceita com sucesso');
        } catch (error) {
            console.error('Erro ao aceitar solicitação de amizade:', error);
            showToast('Erro ao aceitar solicitação. Tente novamente.');
        }
    }

    // Função para recusar uma solicitação de amizade
    async function rejectFriendRequest(requestId) {
        try {
            // Atualizar status da solicitação
            await db.collection('users').doc(currentUser.uid)
                .collection('friendRequests').doc(requestId)
                .update({
                    status: 'rejected',
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Remover elemento do DOM
            const requestElement = document.querySelector(`.request-card[data-request-id="${requestId}"]`);
            if (requestElement) {
                requestElement.remove();
            }
            
            // Verificar se não há mais solicitações
            if (pendingRequestsSection && pendingRequestsSection.querySelectorAll('.request-card').length === 0) {
                pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
            }
            
            console.log('Solicitação de amizade recusada com sucesso');
        } catch (error) {
            console.error('Erro ao recusar solicitação de amizade:', error);
            showToast('Erro ao recusar solicitação. Tente novamente.');
        }
    }

    // Função para enviar uma solicitação de amizade
    async function sendFriendRequest(userId, userData) {
        try {
            // Verificar se é o próprio usuário
            if (userId === currentUser.uid) {
                showToast('Você não pode adicionar a si mesmo como amigo.');
                return;
            }
            
            // Verificar se já é amigo
            const friendDoc = await db.collection('users').doc(currentUser.uid)
                .collection('friends').doc(userId).get();
            
            if (friendDoc.exists) {
                showToast('Este usuário já é seu amigo.');
                return;
            }
            
            // Verificar se já existe uma solicitação pendente
            const requestsSnapshot = await db.collection('users').doc(userId)
                .collection('friendRequests')
                .where('fromUserId', '==', currentUser.uid)
                .where('status', '==', 'pending')
                .get();
            
            if (!requestsSnapshot.empty) {
                showToast('Você já enviou uma solicitação de amizade para este usuário.');
                return;
            }
            
            // Criar solicitação de amizade
            await db.collection('users').doc(userId)
                .collection('friendRequests').add({
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || 'Usuário',
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    status: 'pending',
                    mutualFriends: 0, // Implementar cálculo de amigos em comum no futuro
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Criar notificação para o outro usuário
            await db.collection('users').doc(userId)
                .collection('notifications').add({
                    type: 'friend_request',
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || 'Usuário',
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    content: 'enviou uma solicitação de amizade',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            
            // Fechar modal
            addFriendModal.style.display = 'none';
            
            // Limpar campo de input
            document.getElementById('friendEmail').value = '';
            
            // Exibir mensagem de sucesso
            showToast('Solicitação de amizade enviada com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar solicitação de amizade:', error);
            showToast('Erro ao enviar solicitação. Tente novamente.');
        }
    }

    // Função para carregar amigos
    function loadFriends() {
        // Resetar variáveis de paginação
        lastVisibleFriend = null;
        lastVisibleOnlineFriend = null;
        noMoreFriends = false;
        noMoreOnlineFriends = false;
        
        // Limpar grids de amigos
        if (onlineFriendsGrid) {
            onlineFriendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando amigos online...</div>';
        }
        
        if (allFriendsGrid) {
            allFriendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando todos os amigos...</div>';
        }
        
        // Remover listener anterior se existir
        if (friendsListener) {
            friendsListener();
        }
        
        // Carregar amigos online
        loadOnlineFriends();
        
        // Carregar todos os amigos
        loadAllFriends();
    }

    // Função para carregar amigos online
    async function loadOnlineFriends() {
        try {
            if (!onlineFriendsGrid) return;
            
            // Limpar grid de amigos online
            onlineFriendsGrid.innerHTML = '';
            
            // Consultar amigos online
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .where('status', '==', 'online')
                .orderBy('lastActive', 'desc')
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            // Verificar se há amigos online
            if (snapshot.empty) {
                onlineFriendsGrid.innerHTML = '<p class="no-friends">Nenhum amigo online no momento.</p>';
                noMoreOnlineFriends = true;
                return;
            }
            
            // Adicionar cada amigo ao DOM
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                
                addFriendToDOM(friend, onlineFriendsGrid);
            });
            
            // Salvar último documento para paginação
            lastVisibleOnlineFriend = snapshot.docs[snapshot.docs.length - 1];
            
            // Verificar se há mais amigos online
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreOnlineFriends = true;
            } else {
                // Adicionar botão "Ver mais" se não existir
                if (!onlineFriendsGrid.querySelector('.load-more-btn')) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.className = 'action-btn load-more-btn';
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                    loadMoreBtn.addEventListener('click', loadMoreOnlineFriends);
                    onlineFriendsGrid.appendChild(loadMoreBtn);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar amigos online:', error);
            if (onlineFriendsGrid) {
                onlineFriendsGrid.innerHTML = '<div class="error-message">Erro ao carregar amigos online. Tente novamente mais tarde.</div>';
            }
        }
    }

    // Função para carregar mais amigos online
    async function loadMoreOnlineFriends() {
        try {
            if (!onlineFriendsGrid || isLoadingMoreOnlineFriends || noMoreOnlineFriends) return;
            
            isLoadingMoreOnlineFriends = true;
            
            // Remover botão "Ver mais" se existir
            const loadMoreBtn = onlineFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            }
            
            // Consultar mais amigos online
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .where('status', '==', 'online')
                .orderBy('lastActive', 'desc')
                .startAfter(lastVisibleOnlineFriend)
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            // Verificar se há mais amigos online
            if (snapshot.empty) {
                noMoreOnlineFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
                isLoadingMoreOnlineFriends = false;
                return;
            }
            
            // Adicionar cada amigo ao DOM
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                
                addFriendToDOM(friend, onlineFriendsGrid);
            });
            
            // Salvar último documento para paginação
            lastVisibleOnlineFriend = snapshot.docs[snapshot.docs.length - 1];
            
            // Verificar se há mais amigos online
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreOnlineFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
            } else {
                // Restaurar botão "Ver mais"
                if (loadMoreBtn) {
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                }
            }
            
            isLoadingMoreOnlineFriends = false;
        } catch (error) {
            console.error('Erro ao carregar mais amigos online:', error);
            isLoadingMoreOnlineFriends = false;
            
            // Restaurar botão "Ver mais"
            const loadMoreBtn = onlineFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
            }
        }
    }

    // Função para carregar todos os amigos
    async function loadAllFriends() {
        try {
            if (!allFriendsGrid) return;
            
            // Limpar grid de todos os amigos
            allFriendsGrid.innerHTML = '';
            
            // Consultar todos os amigos
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .orderBy('nickname')
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            // Verificar se há amigos
            if (snapshot.empty) {
                allFriendsGrid.innerHTML = '<p class="no-friends">Você ainda não tem amigos. Adicione novos amigos para começar!</p>';
                noMoreFriends = true;
                return;
            }
            
            // Adicionar cada amigo ao DOM
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                
                addFriendToDOM(friend, allFriendsGrid);
            });
            
            // Salvar último documento para paginação
            lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
            
            // Verificar se há mais amigos
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
            } else {
                // Adicionar botão "Ver mais" se não existir
                if (!allFriendsGrid.querySelector('.load-more-btn')) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.className = 'action-btn load-more-btn';
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                    loadMoreBtn.addEventListener('click', loadMoreFriends);
                    allFriendsGrid.appendChild(loadMoreBtn);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar todos os amigos:', error);
            if (allFriendsGrid) {
                allFriendsGrid.innerHTML = '<div class="error-message">Erro ao carregar amigos. Tente novamente mais tarde.</div>';
            }
        }
    }

    // Função para carregar mais amigos
    async function loadMoreFriends() {
        try {
            if (!allFriendsGrid || isLoadingMoreFriends || noMoreFriends) return;
            
            isLoadingMoreFriends = true;
            
            // Remover botão "Ver mais" se existir
            const loadMoreBtn = allFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            }
            
            // Consultar mais amigos
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .orderBy('nickname')
                .startAfter(lastVisibleFriend)
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            // Verificar se há mais amigos
            if (snapshot.empty) {
                noMoreFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
                isLoadingMoreFriends = false;
                return;
            }
            
            // Adicionar cada amigo ao DOM
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                
                addFriendToDOM(friend, allFriendsGrid);
            });
            
            // Salvar último documento para paginação
            lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
            
            // Verificar se há mais amigos
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
            } else {
                // Restaurar botão "Ver mais"
                if (loadMoreBtn) {
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                }
            }
            
            isLoadingMoreFriends = false;
        } catch (error) {
            console.error('Erro ao carregar mais amigos:', error);
            isLoadingMoreFriends = false;
            
            // Restaurar botão "Ver mais"
            const loadMoreBtn = allFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
            }
        }
    }

    // Função para adicionar um amigo ao DOM
    function addFriendToDOM(friend, container) {
        if (!container) return;
        
        // Criar elemento de amigo
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-card';
        friendElement.dataset.userId = friend.userId;
        
        // Definir HTML do amigo
        const hobbiesHTML = friend.hobbies && friend.hobbies.length > 0 
            ? friend.hobbies.slice(0, 3).map(hobby => `<span class="hobby-tag">${hobby}</span>`).join('')
            : '<span class="hobby-tag">Sem hobbies</span>';
        
        friendElement.innerHTML = `
            <img src="${friend.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="friend-avatar">
            <div class="friend-info">
                <h3 class="friend-name">${friend.nickname || 'Usuário'}</h3>
                <div class="friend-status">
                    <span class="status-indicator ${friend.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                    ${friend.status === 'online' ? 'Online' : 'Offline'}
                </div>
                <div class="friend-hobbies">
                    ${hobbiesHTML}
                </div>
                <div class="friend-actions">
                    <button class="friend-btn view-profile-btn">Ver Perfil</button>
                    <button class="friend-btn message-btn">Mensagem</button>
                </div>
            </div>
        `;
        
        // Adicionar event listeners para os botões
        const viewProfileBtn = friendElement.querySelector('.view-profile-btn');
        const messageBtn = friendElement.querySelector('.message-btn');
        const friendAvatar = friendElement.querySelector('.friend-avatar');
        const friendName = friendElement.querySelector('.friend-name');
        
        // Redirecionar para perfil do amigo
        viewProfileBtn.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        // Redirecionar para perfil do amigo ao clicar na foto ou nome
        friendAvatar.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        friendName.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        // Redirecionar para mensagens com o amigo
        messageBtn.addEventListener('click', function() {
            redirectToMessages(friend.userId);
        });
        
        // Adicionar ao DOM
        container.appendChild(friendElement);
    }

    // Função para redirecionar para o perfil do usuário
    function redirectToUserProfile(userId) {
        window.location.href = `../pages/user.html?uid=${userId}`;
    }

    // Função para redirecionar para mensagens com um usuário
    function redirectToMessages(userId) {
        window.location.href = `../mensagen/mensagens.html?uid=${userId}`;
    }

    // Função para filtrar amigos exibidos
    function filterFriends(searchTerm) {
        if (!searchTerm) {
            // Restaurar todos os amigos
            document.querySelectorAll('.friend-card').forEach(card => {
                card.style.display = 'flex';
            });
            return;
        }
        
        // Filtrar amigos pelo nome
        document.querySelectorAll('.friend-card').forEach(card => {
            const friendName = card.querySelector('.friend-name').textContent.toLowerCase();
            
            if (friendName.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Função para carregar sugestões de amizade
    async function loadSuggestions() {
        try {
            if (!suggestionsContainer) return;
            
            // Limpar container de sugestões
            suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';
            
            // Resetar variáveis de paginação
            lastVisibleSuggestion = null;
            noMoreSuggestions = false;
            
            // Obter hobbies do usuário atual
            const userHobbies = currentUserProfile.hobbies || [];
            
            // Consultar usuários com hobbies semelhantes
            let query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .limit(5);
            
            const snapshot = await query.get();
            
            // Limpar container de sugestões
            suggestionsContainer.innerHTML = '';
            
            // Verificar se há sugestões
            if (snapshot.empty) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma sugestão encontrada.</p>';
                return;
            }
            
            // Filtrar usuários que já são amigos
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid)
                .collection('friends').get();
            
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            
            // Adicionar cada sugestão ao DOM
            let suggestionsAdded = 0;
            
            for (const doc of snapshot.docs) {
                // Pular se já é amigo
                if (friendIds.includes(doc.id)) continue;
                
                const user = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Calcular relevância com base em hobbies em comum
                const userHobbiesList = user.hobbies || [];
                const commonHobbies = userHobbiesList.filter(hobby => userHobbies.includes(hobby));
                
                // Adicionar ao DOM
                addSuggestionToDOM(user, commonHobbies.length);
                suggestionsAdded++;
            }
            
            // Salvar último documento para paginação
            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
            
            // Verificar se há mais sugestões
            if (suggestionsAdded === 0) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma sugestão encontrada.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error);
            if (suggestionsContainer) {
                suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões. Tente novamente mais tarde.</div>';
            }
        }
    }

    // Função para carregar mais sugestões
    async function loadMoreSuggestions() {
        try {
            if (!suggestionsContainer || isLoadingMoreSuggestions || noMoreSuggestions) return;
            
            isLoadingMoreSuggestions = true;
            
            // Adicionar indicador de carregamento
            const loadMoreLink = document.querySelector('.see-more');
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Carregando...';
            }
            
            // Obter hobbies do usuário atual
            const userHobbies = currentUserProfile.hobbies || [];
            
            // Consultar mais usuários
            let query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .startAfter(lastVisibleSuggestion)
                .limit(5);
            
            const snapshot = await query.get();
            
            // Verificar se há mais sugestões
            if (snapshot.empty) {
                noMoreSuggestions = true;
                if (loadMoreLink) {
                    loadMoreLink.textContent = 'Não há mais sugestões';
                }
                isLoadingMoreSuggestions = false;
                return;
            }
            
            // Filtrar usuários que já são amigos
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid)
                .collection('friends').get();
            
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            
            // Adicionar cada sugestão ao DOM
            let suggestionsAdded = 0;
            
            for (const doc of snapshot.docs) {
                // Pular se já é amigo
                if (friendIds.includes(doc.id)) continue;
                
                const user = {
                    id: doc.id,
                    ...doc.data()
                };
                
                // Calcular relevância com base em hobbies em comum
                const userHobbiesList = user.hobbies || [];
                const commonHobbies = userHobbiesList.filter(hobby => userHobbies.includes(hobby));
                
                // Adicionar ao DOM
                addSuggestionToDOM(user, commonHobbies.length);
                suggestionsAdded++;
            }
            
            // Salvar último documento para paginação
            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
            
            // Restaurar link "Ver mais"
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Ver mais';
            }
            
            isLoadingMoreSuggestions = false;
        } catch (error) {
            console.error('Erro ao carregar mais sugestões:', error);
            isLoadingMoreSuggestions = false;
            
            // Restaurar link "Ver mais"
            const loadMoreLink = document.querySelector('.see-more');
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Ver mais';
            }
        }
    }

    // Função para adicionar uma sugestão ao DOM
    function addSuggestionToDOM(user, commonHobbiesCount) {
        if (!suggestionsContainer) return;
        
        // Criar elemento de sugestão
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion';
        suggestionElement.dataset.userId = user.id;
        
        // Definir HTML da sugestão
        suggestionElement.innerHTML = `
            <img src="${user.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="profile-pic small suggestion-photo">
            <div class="suggestion-info">
                <h4>${user.nickname || 'Usuário'}</h4>
                <p>${commonHobbiesCount} ${commonHobbiesCount === 1 ? 'hobby' : 'hobbies'} em comum</p>
            </div>
            <button class="follow-btn">Seguir</button>
        `;
        
        // Adicionar event listeners
        const followBtn = suggestionElement.querySelector('.follow-btn');
        const userPhoto = suggestionElement.querySelector('.suggestion-photo');
        const userName = suggestionElement.querySelector('h4');
        
        followBtn.addEventListener('click', function() {
            sendFriendRequest(user.id, user);
        });
        
        // Redirecionar para perfil do usuário ao clicar na foto ou nome
        userPhoto.addEventListener('click', function() {
            redirectToUserProfile(user.id);
        });
        
        userName.addEventListener('click', function() {
            redirectToUserProfile(user.id);
        });
        
        // Adicionar ao DOM
        suggestionsContainer.appendChild(suggestionElement);
    }
});
