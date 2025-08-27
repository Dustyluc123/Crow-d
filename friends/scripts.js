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
                showToast('Por favor, digite o nome de usuário válido.', 'error');
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
                loadMoreSuggestions(this);
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
    if (!currentUserProfile || !currentUserProfile.nickname) {
        showToast("Seu perfil ainda não foi carregado, tente novamente.", "error");
        return false;
    }

    const followButton = document.querySelector(`.suggestion[data-user-id="${userId}"] .follow-btn`);
    if (followButton) {
        followButton.disabled = true;
        followButton.textContent = 'Aguarde...';
    }

    try {
        if (userId === currentUser.uid) throw new Error('Você não pode se adicionar.');

        const friendDoc = await db.collection("users").doc(currentUser.uid).collection("friends").doc(userId).get();
        if (friendDoc.exists) throw new Error('Este usuário já é seu amigo.');

        const requestId = [currentUser.uid, userId].sort().join('_');
        const requestRef = db.collection('friendRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        if (requestDoc.exists) throw new Error('Já existe um pedido pendente.');

        const batch = db.batch();
        
        // --- INÍCIO DA MUDANÇA ---
        // 1. Cria a referência da notificação PRIMEIRO para obter seu ID único
        const notificationRef = db.collection("users").doc(userId).collection("notifications").doc();

        // 2. Prepara os dados do pedido de amizade, INCLUINDO o ID da notificação
        batch.set(requestRef, {
            from: currentUser.uid,
            to: userId,
            fromUserName: currentUserProfile.nickname,
            fromUserPhoto: currentUserProfile.photoURL || null,
            notificationId: notificationRef.id, // <-- CAMPO ADICIONADO
            status: "pending",
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Prepara os dados da notificação (como antes)
        batch.set(notificationRef, {
            type: "friend_request",
            fromUserId: currentUser.uid,
            fromUserName: currentUserProfile.nickname,
            fromUserPhoto: currentUserProfile.photoURL || null,
            content: "enviou uma solicitação de amizade",
            requestId: requestRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        // --- FIM DA MUDANÇA ---
        
        await batch.commit();
        
        showToast("Solicitação enviada!", "success");
        if (followButton) {
            followButton.textContent = 'Pendente';
        }
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
// Em friends/scripts.js

async function acceptFriendRequest(requestId, fromUserId) {
    const acceptButton = document.querySelector(`.request-card[data-request-id="${requestId}"] .accept-btn`);
    if (acceptButton) {
        acceptButton.disabled = true;
        acceptButton.textContent = 'Aguarde...';
    }

    try {
        const requestRef = db.collection('friendRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) throw new Error("Esta solicitação não existe mais.");
        
        const requestData = requestDoc.data();
        const notificationId = requestData.notificationId; // <-- Pega o ID da notificação

        const fromUserDoc = await db.collection('users').doc(fromUserId).get();
        if (!fromUserDoc.exists) throw new Error("Usuário não encontrado.");
        
        const fromUserData = fromUserDoc.data();
        const batch = db.batch();

        // Adiciona amigo na lista do usuário atual
        const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
        batch.set(currentUserFriendRef, { 
            nickname: fromUserData.nickname,
            photoURL: fromUserData.photoURL,
            hobbies: fromUserData.hobbies || []
         });

        // Adiciona o usuário atual na lista do amigo
        const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
        batch.set(fromUserFriendRef, { 
            nickname: currentUserProfile.nickname,
            photoURL: currentUserProfile.photoURL,
            hobbies: currentUserProfile.hobbies || []
        });

        // Apaga o pedido de amizade
        batch.delete(requestRef);

        // --- INÍCIO DA SINCRONIZAÇÃO ---
        // Se a notificação existir, apaga ela também
        if (notificationId) {
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
        }
        // --- FIM DA SINCRONIZAÇÃO ---

        await batch.commit();
        showToast("Amigo adicionado!", "success");

    } catch (error) {
        console.error("Erro ao aceitar solicitação:", error);
        showToast(error.message, "error");
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
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) throw new Error("Esta solicitação não existe mais.");

        const requestData = requestDoc.data();
        const notificationId = requestData.notificationId; // <-- Pega o ID da notificação

        const batch = db.batch();

        // Apaga o pedido de amizade
        batch.delete(requestRef);

        // --- INÍCIO DA SINCRONIZAÇÃO ---
        // Se a notificação existir, apaga ela também
        if (notificationId) {
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
        }
        // --- FIM DA SINCRONIZAÇÃO ---

        await batch.commit();
        showToast("Solicitação recusada.", "info");

    } catch (error) {
        console.error("Erro ao recusar solicitação:", error);
        showToast(error.message, "error");
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
        // Remove o botão "Mostrar mais" antigo se existir
        const oldLoadMoreBtn = document.querySelector('.friends-section .load-more-btn');
        if (oldLoadMoreBtn) oldLoadMoreBtn.remove();

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
                // Adiciona o botão "Mostrar mais" dentro da seção correta
                const friendsSection = document.querySelector('.friends-section');
                if (friendsSection && !friendsSection.querySelector('.load-more-btn')) {
                    const loadMoreBtn = document.createElement('button');
                    loadMoreBtn.className = 'action-btn load-more-btn';
                    loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
                    loadMoreBtn.addEventListener('click', loadMoreFriends);
                    friendsSection.appendChild(loadMoreBtn);
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
            
            const query = db.collection('users').doc(currentUser.uid).collection('friends').orderBy('nickname').startAfter(lastVisibleFriend).limit(FRIENDS_PER_PAGE);
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                noMoreFriends = true;
                if (loadMoreBtn) {
                    loadMoreBtn.remove();
                    const noMoreMessage = document.createElement('p');
                    noMoreMessage.className = 'no-more-results';
                    noMoreMessage.textContent = 'Não há mais amigos para mostrar.';
                    allFriendsGrid.parentElement.appendChild(noMoreMessage);
                }
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
            if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Mostrar mais';
        }
    }
    
    function addFriendToDOM(friend, container) {
        if (!container) return;
        
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-card';
        friendElement.dataset.userId = friend.id;
        
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

// Em friends/scripts.js

async function loadSuggestions() {
    if (!suggestionsContainer || !currentUserProfile) return;
    suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';
    
    // Reseta as variáveis de paginação para um novo carregamento
    lastVisibleSuggestion = null;
    noMoreSuggestions = false;

    try {
        // Constrói a lista de IDs a serem excluídos (amigos, pedidos pendentes, etc.)
        const exclusionIds = new Set();
        exclusionIds.add(currentUser.uid);

        const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
        friendsSnapshot.forEach(doc => exclusionIds.add(doc.id));

        const sentRequestsSnapshot = await db.collection('friendRequests').where('from', '==', currentUser.uid).get();
        sentRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().to));

        const receivedRequestsSnapshot = await db.collection('friendRequests').where('to', '==', currentUser.uid).get();
        receivedRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().from));

        // --- INÍCIO DA CORREÇÃO ---
        // Busca os primeiros usuários, ordenando pelo ID do documento para consistência
        const query = db.collection('users').orderBy(firebase.firestore.FieldPath.documentId()).limit(10);
        const snapshot = await query.get();
        // --- FIM DA CORREÇÃO ---

        suggestionsContainer.innerHTML = '';
        let suggestionsAdded = 0;
        const currentUserHobbies = new Set(currentUserProfile.hobbies || []);

        snapshot.forEach(doc => {
            if (!exclusionIds.has(doc.id)) {
                const userData = doc.data();
                const suggestionUserHobbies = new Set(userData.hobbies || []);
                
                let commonHobbiesCount = 0;
                for (const hobby of suggestionUserHobbies) {
                    if (currentUserHobbies.has(hobby)) {
                        commonHobbiesCount++;
                    }
                }

                addSuggestionToDOM({ id: doc.id, ...userData }, commonHobbiesCount);
                suggestionsAdded++;
            }
        });
        
        // --- ADIÇÃO CRÍTICA: Guarda a referência ao último documento visto ---
        if (!snapshot.empty) {
            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
        }
        // --- FIM DA ADIÇÃO ---

        if (suggestionsAdded === 0) {
            suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma nova sugestão encontrada.</p>';
            noMoreSuggestions = true;
        }

    } catch (error) {
        console.error('Erro ao carregar sugestões:', error);
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
        }
    }
}

    async function loadMoreSuggestions(loadMoreBtn) {
    // 1. Prevenir múltiplos cliques
    if (isLoadingMoreSuggestions || noMoreSuggestions) return;

    // 2. Definir o estado de carregamento
    isLoadingMoreSuggestions = true;
    if (loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';

    try {
        const MIN_SUGGESTIONS_TO_ADD = 3; // Tentar adicionar pelo menos 3 novas sugestões
        let suggestionsAdded = 0;

        // 3. Construir a lista de exclusão (incluindo usuários já visíveis)
        const exclusionIds = new Set([currentUser.uid]);
        document.querySelectorAll('.suggestion[data-user-id]').forEach(el => exclusionIds.add(el.dataset.userId));

        const [friendsSnapshot, sentRequestsSnapshot, receivedRequestsSnapshot] = await Promise.all([
            db.collection('users').doc(currentUser.uid).collection('friends').get(),
            db.collection('friendRequests').where('from', '==', currentUser.uid).get(),
            db.collection('friendRequests').where('to', '==', currentUser.uid).get()
        ]);
        friendsSnapshot.forEach(doc => exclusionIds.add(doc.id));
        sentRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().to));
        receivedRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().from));

        const currentUserHobbies = new Set(currentUserProfile.hobbies || []);

        // 4. Loop para buscar usuários até encontrar sugestões válidas
        while (suggestionsAdded < MIN_SUGGESTIONS_TO_ADD && !noMoreSuggestions) {
            let query = db.collection('users')
                        .orderBy(firebase.firestore.FieldPath.documentId())
                        .limit(10);

            if (lastVisibleSuggestion) {
                query = query.startAfter(lastVisibleSuggestion);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                noMoreSuggestions = true;
                break; // Sai do loop se não houver mais usuários no banco
            }

            snapshot.forEach(doc => {
                if (suggestionsAdded < MIN_SUGGESTIONS_TO_ADD && !exclusionIds.has(doc.id)) {
                    const userData = doc.data();
                    const suggestionUserHobbies = new Set(userData.hobbies || []);
                    let commonHobbiesCount = 0;
                    suggestionUserHobbies.forEach(hobby => {
                        if (currentUserHobbies.has(hobby)) commonHobbiesCount++;
                    });
                    const user = { id: doc.id, ...userData };
                    addSuggestionToDOM(user, commonHobbiesCount);
                    suggestionsAdded++;
                    exclusionIds.add(user.id); // Evita adicionar o mesmo usuário novamente
                }
            });

            lastVisibleSuggestion = snapshot.docs[snapshot.docs.length - 1];
            if (snapshot.docs.length < 10) noMoreSuggestions = true;
        }

        // 5. Atualizar a UI do botão após o loop
        if (noMoreSuggestions && loadMoreBtn) loadMoreBtn.style.display = 'none';
        else if (loadMoreBtn) loadMoreBtn.innerHTML = 'Ver mais';

    } catch (error) {
        console.error('Erro ao carregar mais sugestões:', error);
        showToast('Erro ao carregar mais sugestões.', 'error');
        if (loadMoreBtn) loadMoreBtn.innerHTML = 'Ver mais';
    } finally {
        isLoadingMoreSuggestions = false; // 6. Liberar a trava de carregamento
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
                <p>${commonHobbiesCount} ${commonHobbiesCount === 1 ? 'hobby em comum' : 'hobbies em comum'}</p>
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