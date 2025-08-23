// Ficheiro Completo: scripts.js (para a página amigos.html)

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
    const functions = firebase.functions();

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
                    showToast('Erro ao fazer logout. Tente novamente.', 'error');
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
                showToast('Por favor, digite um e-mail ou nome de usuário válido.', 'error');
                return;
            }
            
            try {
                const usersByEmail = await db.collection('users').where('email', '==', friendEmail).limit(1).get();
                if (!usersByEmail.empty) {
                    const userDoc = usersByEmail.docs[0];
                    sendFriendRequest(userDoc.id, userDoc.data());
                } else {
                    const usersByNickname = await db.collection('users').where('nickname', '==', friendEmail).limit(1).get();
                    if (!usersByNickname.empty) {
                        const userDoc = usersByNickname.docs[0];
                        sendFriendRequest(userDoc.id, userDoc.data());
                    } else {
                        showToast('Usuário não encontrado. Verifique o e-mail ou nome de usuário.', 'error');
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar usuário:', error);
                showToast('Erro ao buscar usuário. Tente novamente.', 'error');
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

    async function sendFriendRequest(userId, userData) {
        const followButton = document.querySelector(`.suggestion[data-user-id="${userId}"] .follow-btn`);
        if (followButton) {
            followButton.disabled = true;
            followButton.textContent = 'Aguarde...';
        }

        try {
            if (userId === currentUser.uid) {
                throw new Error('Você não pode adicionar a si mesmo como amigo.');
            }

            const friendDoc = await db.collection("users").doc(currentUser.uid).collection("friends").doc(userId).get();
            if (friendDoc.exists) {
                throw new Error('Este usuário já é seu amigo.');
            }

            const requestId = [currentUser.uid, userId].sort().join('_');
            const requestRef = db.collection('friendRequests').doc(requestId);
            const requestDoc = await requestRef.get();

            if (requestDoc.exists) {
                throw new Error('Já existe uma solicitação de amizade pendente entre vocês.');
            }

            const batch = db.batch();
            batch.set(requestRef, {
                from: currentUser.uid,
                to: userId,
                fromUserName: currentUserProfile.nickname || "Usuário",
                fromUserPhoto: currentUserProfile.photoURL || null,
                status: "pending",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            });

            const notificationRef = db.collection("users").doc(userId).collection("notifications").doc();
            batch.set(notificationRef, {
                type: "friend_request",
                fromUserId: currentUser.uid,
                fromUserName: currentUserProfile.nickname || "Usuário",
                content: "enviou uma solicitação de amizade",
                requestId: requestRef.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

            await batch.commit();
            showToast("Solicitação de amizade enviada com sucesso!", "success");
            return true;

        } catch (error) {
            showToast(error.message, 'error');
            if (followButton) {
                followButton.disabled = false;
                followButton.textContent = 'Seguir';
            }
            return false;
        }
    }

    function loadFriendRequests() {
        if (!pendingRequestsSection) return;
        pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2><div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        if (requestsListener) requestsListener();
        
        requestsListener = db.collection('friendRequests')
            .where('to', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2>';
                if (snapshot.empty) {
                    pendingRequestsSection.innerHTML += '<p class="no-requests">Nenhuma solicitação pendente.</p>';
                    return;
                }
                
                snapshot.forEach(doc => {
                    const request = {
                        id: doc.id,
                        fromUserId: doc.data().from,
                        ...doc.data()
                    };
                    addRequestToDOM(request);
                });
            }, error => {
                console.error('Erro ao carregar solicitações:', error);
                pendingRequestsSection.innerHTML = '<h2><i class="fas fa-user-clock"></i> Solicitações Pendentes</h2><div class="error-message">Erro ao carregar.</div>';
            });
    }

    async function acceptFriendRequest(requestId, fromUserId) {
        const acceptButton = document.querySelector(`.request-card[data-request-id="${requestId}"] .accept-btn`);
        if (acceptButton) {
            acceptButton.disabled = true;
            acceptButton.textContent = 'Aguarde...';
        }

        try {
            if (!currentUser || !currentUserProfile) {
                throw new Error("Utilizador não autenticado.");
            }

            const fromUserDoc = await db.collection('users').doc(fromUserId).get();
            if (!fromUserDoc.exists) {
                throw new Error("O utilizador que enviou o pedido não foi encontrado.");
            }
            const fromUserData = fromUserDoc.data();

            const batch = db.batch();

            const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
            batch.set(currentUserFriendRef, {
                userId: fromUserId,
                nickname: fromUserData.nickname || 'Usuário',
                photoURL: fromUserData.photoURL || null,
                hobbies: fromUserData.hobbies || []
            });

            const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
            batch.set(fromUserFriendRef, {
                userId: currentUser.uid,
                nickname: currentUserProfile.nickname || 'Usuário',
                photoURL: currentUserProfile.photoURL || null,
                hobbies: currentUserProfile.hobbies || []
            });

            // A melhor prática é apagar o pedido após ser aceite, para manter a coleção limpa.
            const requestRef = db.collection('friendRequests').doc(requestId);
            batch.delete(requestRef);

            await batch.commit();
            showToast("Amigo adicionado com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao aceitar solicitação:", error);
            showToast("Ocorreu um erro ao aceitar a solicitação: " + error.message, "error");
            if (acceptButton) {
                acceptButton.disabled = false;
                acceptButton.textContent = 'Aceitar';
            }
        }
    }

    async function rejectFriendRequest(requestId) {
        const rejectButton = document.querySelector(`.request-card[data-request-id="${requestId}"] .reject-btn`);
        if (rejectButton) {
            rejectButton.disabled = true;
            rejectButton.textContent = 'Aguarde...';
        }

        try {
            const requestRef = db.collection('friendRequests').doc(requestId);
            // A melhor prática é apagar o pedido após ser recusado.
            await requestRef.delete();
            showToast("Solicitação recusada.", "info");

        } catch (error) {
            console.error("Erro ao recusar solicitação:", error);
            showToast("Ocorreu um erro ao recusar a solicitação.", "error");
            if (rejectButton) {
                rejectButton.disabled = false;
                rejectButton.textContent = 'Recusar';
            }
        }
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
                <p class="request-mutual">0 amigos em comum</p>
            </div>
            <div class="request-actions">
                <button class="request-btn accept-btn">Aceitar</button>
                <button class="request-btn secondary reject-btn">Recusar</button>
            </div>
        `;
        
        const acceptBtn = requestElement.querySelector('.accept-btn');
        acceptBtn.addEventListener('click', () => acceptFriendRequest(request.id, request.fromUserId));
        
        const rejectBtn = requestElement.querySelector('.reject-btn');
        rejectBtn.addEventListener('click', () => rejectFriendRequest(request.id));
        
        pendingRequestsSection.appendChild(requestElement);
    }

    function loadFriends() {
        lastVisibleFriend = null;
        noMoreFriends = false;
        if (allFriendsGrid) {
            allFriendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>';
        }
        if (friendsListener) friendsListener();
        loadAllFriends();
    }

    async function loadAllFriends() {
        try {
            if (!allFriendsGrid) return;
            allFriendsGrid.innerHTML = '';
            
            const query = db.collection('users').doc(currentUser.uid).collection('friends').orderBy('nickname').limit(FRIENDS_PER_PAGE);
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
            
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
            } else {
                if (!allFriendsGrid.querySelector('.load-more-btn')) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.className = 'action-btn load-more-btn';
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                    loadMoreBtn.addEventListener('click', loadMoreFriends);
                    allFriendsGrid.parentElement.appendChild(loadMoreBtn); // Adiciona o botão depois da grid
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
        try {
            if (!allFriendsGrid || isLoadingMoreFriends || noMoreFriends) return;
            isLoadingMoreFriends = true;
            
            const loadMoreBtn = document.querySelector('.load-more-btn');
            if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
            
            const query = db.collection('users').doc(currentUser.uid).collection('friends').orderBy('nickname').startAfter(lastVisibleFriend).limit(FRIENDS_PER_PAGE);
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                noMoreFriends = true;
                if (loadMoreBtn) loadMoreBtn.remove();
                isLoadingMoreFriends = false;
                return;
            }
            
            snapshot.forEach(doc => {
                const friend = { id: doc.id, ...doc.data() };
                addFriendToDOM(friend, allFriendsGrid);
            });
            
            lastVisibleFriend = snapshot.docs[snapshot.docs.length - 1];
            
            if (snapshot.docs.length < FRIENDS_PER_PAGE) {
                noMoreFriends = true;
                if (loadMoreBtn) loadMoreBtn.remove();
            } else {
                if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
            }
            isLoadingMoreFriends = false;
        } catch (error) {
            console.error('Erro ao carregar mais amigos:', error);
            isLoadingMoreFriends = false;
            const loadMoreBtn = document.querySelector('.load-more-btn');
            if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
        }
    }
    
    // --- FUNÇÃO CORRIGIDA ---
    function addFriendToDOM(friend, container) {
        if (!container) return;
        
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-card';
        friendElement.dataset.userId = friend.id; // Correção: Usa friend.id
        
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
        
        // Correção: Todas as chamadas usam friend.id
        viewProfileBtn.addEventListener('click', () => redirectToUserProfile(friend.id));
        friendAvatar.addEventListener('click', () => redirectToUserProfile(friend.id));
        friendName.addEventListener('click', () => redirectToUserProfile(friend.id));
        messageBtn.addEventListener('click', () => redirectToMessages(friend.id));
        
        container.appendChild(friendElement);
    }

    function redirectToUserProfile(userId) {
        window.location.href = `../pages/user.html?uid=${userId}`;
    }

    function redirectToMessages(userId) {
        window.location.href = `../mensagen/mensagens.html?uid=${userId}`;
    }

    function filterFriends(searchTerm) {
        document.querySelectorAll('.friend-card').forEach(card => {
            const friendName = card.querySelector('.friend-name').textContent.toLowerCase();
            card.style.display = friendName.includes(searchTerm) ? 'flex' : 'none';
        });
    }

    async function loadSuggestions() {
        // Esta função pode ser complexa e será mantida como está para simplicidade.
        // A lógica de carregar sugestões permanece a mesma.
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        try {
            const [friendsSnapshot, allUsersSnapshot] = await Promise.all([
                db.collection('users').doc(currentUser.uid).collection('friends').get(),
                db.collection('users').limit(10).get() // Limite para performance
            ]);

            const friendIds = new Set(friendsSnapshot.docs.map(doc => doc.id));
            friendIds.add(currentUser.uid); // Não sugerir a si mesmo

            suggestionsContainer.innerHTML = '';
            let suggestionsAdded = 0;
            
            allUsersSnapshot.forEach(doc => {
                if (!friendIds.has(doc.id)) {
                    const user = { id: doc.id, ...doc.data() };
                    addSuggestionToDOM(user, 0); // Contagem de hobbies em comum simplificada
                    suggestionsAdded++;
                }
            });

            if (suggestionsAdded === 0) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma sugestão encontrada.</p>';
            }

        } catch (error) {
            console.error('Erro ao carregar sugestões:', error);
            if (suggestionsContainer) {
                suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
            }
        }
    }

    async function loadMoreSuggestions() {
        showToast("Funcionalidade 'Ver mais' para sugestões ainda em desenvolvimento.", "info");
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
                <p>${commonHobbiesCount} hobbies em comum</p>
            </div>
            <button class="follow-btn">Seguir</button>
        `;
        
        const followBtn = suggestionElement.querySelector('.follow-btn');
        followBtn.addEventListener('click', async () => {
            const success = await sendFriendRequest(user.id, user);
            if (success) {
                suggestionElement.remove();
            }
        });
        
        const userPhoto = suggestionElement.querySelector('.suggestion-photo');
        const userName = suggestionElement.querySelector('h4');
        userPhoto.addEventListener('click', () => redirectToUserProfile(user.id));
        userName.addEventListener('click', () => redirectToUserProfile(user.id));
        
        suggestionsContainer.appendChild(suggestionElement);
    }
});