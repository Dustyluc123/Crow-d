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
    let lastVisibleSuggestion = null;
    let isLoadingMoreFriends = false;
    let isLoadingMoreSuggestions = false;
    let noMoreFriends = false;
    let noMoreSuggestions = false;

    // Modal para adicionar amigo
    const addFriendBtn = document.getElementById('addFriendBtn');
    const addFriendModal = document.getElementById('addFriendModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const friendForm = document.querySelector('.modal-form');
    
  auth.onAuthStateChanged(async function(user) {
    if (user) {
        currentUser = user;
        const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink) {
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }
        
        await loadUserProfile(user.uid);
        
        loadFriendRequests();
        loadFriends();
        loadSuggestions();
    } else {
        window.location.href = '../login/login.html';
    }
});

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
    
    window.addEventListener('click', function(event) {
        if (event.target === addFriendModal) {
            addFriendModal.style.display = 'none';
        }
    });
    
    if (friendForm) {
        friendForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const friendEmail = document.getElementById('friendEmail').value.trim();
            
            if (!friendEmail) {
                showToast('Por favor, digite um e-mail ou nome de usuário válido.');
                return;
            }
            
            try {
                const usersSnapshot = await db.collection('users')
                    .where('email', '==', friendEmail)
                    .limit(1)
                    .get();
                
                if (usersSnapshot.empty) {
                    const usersSnapshot2 = await db.collection('users')
                        .where('nickname', '==', friendEmail)
                        .limit(1)
                        .get();
                    
                    if (usersSnapshot2.empty) {
                 showToast('Usuário não encontrado. Verifique o e-mail ou nome de usuário.');
                        return;
                    }
                    
                    const userDoc = usersSnapshot2.docs[0];
                    sendFriendRequest(userDoc.id, userDoc.data());
                } else {
                    const userDoc = usersSnapshot.docs[0];
                    sendFriendRequest(userDoc.id, userDoc.data());
                }
            } catch (error) {
                console.error('Erro ao buscar usuário:', error);
                showToast('Erro ao buscar usuário. Tente novamente.');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim().toLowerCase();
            filterFriends(searchTerm);
        });
    }

    seeMoreLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target') || this.closest('.sidebar-section').querySelector('h3').textContent.toLowerCase();
            if (target.includes('sugestões') || target.includes('sugestão')) {
                loadMoreSuggestions();
            } else {
                loadMoreFriends();
            }
        });
    });

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

    function loadFriendRequests() {
        if (pendingRequestsSection) {
            pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando solicitações...</div>';
        }
        
        if (requestsListener) {
            requestsListener();
        }
        
        requestsListener = db.collection('users').doc(currentUser.uid)
            .collection('friendRequests')
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                if (pendingRequestsSection) {
                    pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2>';
                }
                
                if (snapshot.empty) {
                    if (pendingRequestsSection) {
                        pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
                    }
                    return;
                }
                
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

    function addRequestToDOM(request) {
        if (!pendingRequestsSection) return;
        
        const requestElement = document.createElement('div');
        requestElement.className = 'request-card';
        requestElement.dataset.requestId = request.id;
        requestElement.dataset.userId = request.fromUserId;
        
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
        
        const acceptBtn = requestElement.querySelector('.accept-btn');
        const rejectBtn = requestElement.querySelector('.reject-btn');
        
        acceptBtn.addEventListener('click', function() {
            acceptFriendRequest(request.id, request.fromUserId);
        });
        
        rejectBtn.addEventListener('click', function() {
            rejectFriendRequest(request.id);
        });
        
        pendingRequestsSection.appendChild(requestElement);
    }

    async function acceptFriendRequest(requestId, fromUserId) {
        try {
            const userDoc = await db.collection('users').doc(fromUserId).get();
            
            if (!userDoc.exists) {
            showToast('Usuário não encontrado.');
                return;
            }
            
            const userData = userDoc.data();
            
            await db.collection('users').doc(currentUser.uid)
                .collection('friendRequests').doc(requestId)
                .update({
                    status: 'accepted',
                    acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            await db.collection('users').doc(currentUser.uid)
                .collection('friends').doc(fromUserId)
                .set({
                    userId: fromUserId,
                    nickname: userData.nickname || 'Usuário',
                    photoURL: userData.photoURL || null,
                    school: userData.school || null,
                    hobbies: userData.hobbies || [],
                    customHobbies: userData.customHobbies || [],
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            await db.collection('users').doc(fromUserId)
                .collection('friends').doc(currentUser.uid)
                .set({
                    userId: currentUser.uid,
                    nickname: currentUserProfile.nickname || 'Usuário',
                    photoURL: currentUserProfile.photoURL || null,
                    school: currentUserProfile.school || null,
                    hobbies: currentUserProfile.hobbies || [],
                    customHobbies: currentUserProfile.customHobbies || [],
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
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
            
            const requestElement = document.querySelector(`.request-card[data-request-id="${requestId}"]`);
            if (requestElement) {
                requestElement.remove();
            }
            
            if (pendingRequestsSection && pendingRequestsSection.querySelectorAll('.request-card').length === 0) {
                pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
            }
            
            console.log('Solicitação de amizade aceita com sucesso');
        } catch (error) {
            console.error('Erro ao aceitar solicitação de amizade:', error);
            showToast('Erro ao aceitar solicitação. Tente novamente.');
        }
    }

    async function rejectFriendRequest(requestId) {
        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('friendRequests').doc(requestId)
                .update({
                    status: 'rejected',
                    rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            const requestElement = document.querySelector(`.request-card[data-request-id="${requestId}"]`);
            if (requestElement) {
                requestElement.remove();
            }
            
            if (pendingRequestsSection && pendingRequestsSection.querySelectorAll('.request-card').length === 0) {
                pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação de amizade pendente.</p>';
            }
            
            console.log('Solicitação de amizade recusada com sucesso');
        } catch (error) {
            console.error('Erro ao recusar solicitação de amizade:', error);
            showToast('Erro ao recusar solicitação. Tente novamente.');
        }
    }

    async function sendFriendRequest(userId, userData) {
        try {
            if (userId === currentUser.uid) {
                showToast('Você não pode adicionar a si mesmo como amigo.');
                return;
            }
            
            const friendDoc = await db.collection('users').doc(currentUser.uid)
                .collection('friends').doc(userId).get();
            
            if (friendDoc.exists) {
                showToast('Este usuário já é seu amigo.');
                return;
            }
            
            const requestsSnapshot = await db.collection('users').doc(userId)
                .collection('friendRequests')
                .where('fromUserId', '==', currentUser.uid)
                .where('status', '==', 'pending')
                .get();
            
            if (!requestsSnapshot.empty) {
                showToast('Você já enviou uma solicitação de amizade para este usuário.');
                return;
            }
            
            await db.collection('users').doc(userId)
                .collection('friendRequests').add({
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || 'Usuário',
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    status: 'pending',
                    mutualFriends: 0,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
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
            
            addFriendModal.style.display = 'none';
            document.getElementById('friendEmail').value = '';
            showToast('Solicitação de amizade enviada com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar solicitação de amizade:', error);
            showToast('Erro ao enviar solicitação. Tente novamente.');
        }
    }

    function loadFriends() {
        lastVisibleFriend = null;
        noMoreFriends = false;
        
        if (allFriendsGrid) {
            allFriendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando todos os amigos...</div>';
        }
        
        if (friendsListener) {
            friendsListener();
        }
        
        loadAllFriends();
    }

    async function loadAllFriends() {
        try {
            if (!allFriendsGrid) return;
            allFriendsGrid.innerHTML = '';
            
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .orderBy('nickname')
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                allFriendsGrid.innerHTML = '<p class="no-friends">Você ainda não tem amigos. Adicione novos amigos para começar!</p>';
                noMoreFriends = true;
                return;
            }
            
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                addFriendToDOM(friend, allFriendsGrid);
            });
            
            lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
            
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
            } else {
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

    async function loadMoreFriends() {
        try {
            if (!allFriendsGrid || isLoadingMoreFriends || noMoreFriends) return;
            isLoadingMoreFriends = true;
            
            const loadMoreBtn = allFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            }
            
            let query = db.collection('users').doc(currentUser.uid)
                .collection('friends')
                .orderBy('nickname')
                .startAfter(lastVisibleFriend)
                .limit(FRIENDS_PER_PAGE);
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                noMoreFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
                isLoadingMoreFriends = false;
                return;
            }
            
            snapshot.forEach(doc => {
                const friend = {
                    id: doc.id,
                    ...doc.data()
                };
                addFriendToDOM(friend, allFriendsGrid);
            });
            
            lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
            
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                }
            } else {
                if (loadMoreBtn) {
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                }
            }
            isLoadingMoreFriends = false;
        } catch (error) {
            console.error('Erro ao carregar mais amigos:', error);
            isLoadingMoreFriends = false;
            
            const loadMoreBtn = allFriendsGrid.querySelector('.load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
            }
        }
    }

    function addFriendToDOM(friend, container) {
        if (!container) return;
        
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-card';
        friendElement.dataset.userId = friend.userId;
        
        const hobbiesHTML = friend.hobbies && friend.hobbies.length > 0 
            ? friend.hobbies.slice(0, 3).map(hobby => `<span class="hobby-tag">${hobby}</span>`).join('')
            : '<span class="hobby-tag">Sem hobbies</span>';
        
        friendElement.innerHTML = `
            <img src="${friend.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="friend-avatar">
            <div class="friend-info">
                <h3 class="friend-name">${friend.nickname || 'Usuário'}</h3>
                <div class="friend-hobbies">
                    ${hobbiesHTML}
                </div>
                <div class="friend-actions">
                    <button class="friend-btn view-profile-btn">Ver Perfil</button>
                    <button class="friend-btn message-btn">Mensagem</button>
                </div>
            </div>
        `;
        
        const viewProfileBtn = friendElement.querySelector('.view-profile-btn');
        const messageBtn = friendElement.querySelector('.message-btn');
        const friendAvatar = friendElement.querySelector('.friend-avatar');
        const friendName = friendElement.querySelector('.friend-name');
        
        viewProfileBtn.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        friendAvatar.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        friendName.addEventListener('click', function() {
            redirectToUserProfile(friend.userId);
        });
        
        messageBtn.addEventListener('click', function() {
            redirectToMessages(friend.userId);
        });
        
        container.appendChild(friendElement);
    }

    function redirectToUserProfile(userId) {
        window.location.href = `../pages/user.html?uid=${userId}`;
    }

    function redirectToMessages(userId) {
        window.location.href = `../mensagen/mensagens.html?uid=${userId}`;
    }

    function filterFriends(searchTerm) {
        if (!searchTerm) {
            document.querySelectorAll('.friend-card').forEach(card => {
                card.style.display = 'flex';
            });
            return;
        }
        
        document.querySelectorAll('.friend-card').forEach(card => {
            const friendName = card.querySelector('.friend-name').textContent.toLowerCase();
            
            if (friendName.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async function loadSuggestions() {
        try {
            if (!suggestionsContainer) return;
            
            suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';
            
            lastVisibleSuggestion = null;
            noMoreSuggestions = false;
            
            const userHobbies = currentUserProfile.hobbies || [];
            
            let query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .limit(5);
            
            const snapshot = await query.get();
            
            suggestionsContainer.innerHTML = '';
            
            if (snapshot.empty) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma sugestão encontrada.</p>';
                return;
            }
            
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid)
                .collection('friends').get();
            
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            
            let suggestionsAdded = 0;
            
            for (const doc of snapshot.docs) {
                if (friendIds.includes(doc.id)) continue;
                
                const user = {
                    id: doc.id,
                    ...doc.data()
                };
                
                const userHobbiesList = user.hobbies || [];
                const commonHobbies = userHobbiesList.filter(hobby => userHobbies.includes(hobby));
                
                addSuggestionToDOM(user, commonHobbies.length);
                suggestionsAdded++;
            }
            
            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
            
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

    async function loadMoreSuggestions() {
        try {
            if (!suggestionsContainer || isLoadingMoreSuggestions || noMoreSuggestions) return;
            isLoadingMoreSuggestions = true;
            
            const loadMoreLink = document.querySelector('.see-more');
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Carregando...';
            }
            
            const userHobbies = currentUserProfile.hobbies || [];
            
            let query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .startAfter(lastVisibleSuggestion)
                .limit(5);
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                noMoreSuggestions = true;
                if (loadMoreLink) {
                    loadMoreLink.textContent = 'Não há mais sugestões';
                }
                isLoadingMoreSuggestions = false;
                return;
            }
            
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid)
                .collection('friends').get();
            
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            
            let suggestionsAdded = 0;
            
            for (const doc of snapshot.docs) {
                if (friendIds.includes(doc.id)) continue;
                
                const user = {
                    id: doc.id,
                    ...doc.data()
                };
                
                const userHobbiesList = user.hobbies || [];
                const commonHobbies = userHobbiesList.filter(hobby => userHobbies.includes(hobby));
                
                addSuggestionToDOM(user, commonHobbies.length);
                suggestionsAdded++;
            }
            
            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
            
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Ver mais';
            }
            
            isLoadingMoreSuggestions = false;
        } catch (error) {
            console.error('Erro ao carregar mais sugestões:', error);
            isLoadingMoreSuggestions = false;
            
            const loadMoreLink = document.querySelector('.see-more');
            if (loadMoreLink) {
                loadMoreLink.textContent = 'Ver mais';
            }
        }
    }

    function addSuggestionToDOM(user, commonHobbiesCount) {
        if (!suggestionsContainer) return;
        
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion';
        suggestionElement.dataset.userId = user.id;
        
        suggestionElement.innerHTML = `
            <img src="${user.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="profile-pic small suggestion-photo">
            <div class="suggestion-info">
                <h4>${user.nickname || 'Usuário'}</h4>
                <p>${commonHobbiesCount} ${commonHobbiesCount === 1 ? 'hobby' : 'hobbies'} em comum</p>
            </div>
            <button class="follow-btn">Seguir</button>
        `;
        
        const followBtn = suggestionElement.querySelector('.follow-btn');
        const userPhoto = suggestionElement.querySelector('.suggestion-photo');
        const userName = suggestionElement.querySelector('h4');
        
        followBtn.addEventListener('click', function() {
            sendFriendRequest(user.id, user);
        });
        
        userPhoto.addEventListener('click', function() {
            redirectToUserProfile(user.id);
        });
        
        userName.addEventListener('click', function() {
            redirectToUserProfile(user.id);
        });
        
        suggestionsContainer.appendChild(suggestionElement);
    }
});