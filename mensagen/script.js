
// Sistema de mensagens em tempo real para o Crow-d com Firebase
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

    // Referências aos elementos do DOM
    const conversationsList = document.querySelector('.conversations-list');
    const chatArea = document.querySelector('.chat-area');
    const chatHeader = document.querySelector('.chat-header');
    const chatMessages = document.querySelector('.chat-messages');
    const chatInput = document.querySelector('.chat-input');
    const chatSendBtn = document.querySelector('.chat-send-btn');
    const chatUserName = document.querySelector('.chat-user-name');
    const chatUserStatus = document.querySelector('.chat-user-status');
    const chatAvatar = document.querySelector('.chat-avatar');
    const logoutButton = document.querySelector('.logout-btn');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.querySelector('emoji-picker');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const suggestionsList = document.getElementById('suggestions-list');

    // Variáveis globais
    let currentUser = null;
    let currentUserProfile = null;
    let currentChatUser = null;
    let currentChatId = null;
    let messagesListener = null;
    let conversationsListener = null;
    let hasMessages = false;
    let processedConversations = new Map();
    let messagesSent = new Set();

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        const profileLink = document.querySelector('.main-nav a.profile-link');
        if (user) {
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            currentUser = user;
            await loadUserProfile(user.uid);
            await checkConversations();
            checkUrlParams();
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // --- SUGESTÃO DE USUÁRIOS PARA INICIAR CONVERSA ---
    async function showUserSuggestions() {
        if (!suggestionsContainer || !suggestionsList || !currentUserProfile) {
            console.log("Não foi possível mostrar sugestões: um dos elementos necessários (suggestionsContainer, suggestionsList, currentUserProfile) não foi encontrado.");
            return;
        }

        try {
            // 1. Obter usuários com quem o usuário atual já conversou
            const conversationsSnapshot = await db.collection('conversations')
                .where('participants', 'array-contains', currentUser.uid).get();
            const conversedUserIds = new Set();
            conversationsSnapshot.forEach(doc => {
                doc.data().participants.forEach(id => {
                    if (id !== currentUser.uid) {
                        conversedUserIds.add(id);
                    }
                });
            });

            // 2. Obter todos os usuários do banco de dados
            const allUsersSnapshot = await db.collection('users').get();
            const allUsers = [];
            allUsersSnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid && !conversedUserIds.has(doc.id)) {
                    allUsers.push({ id: doc.id, ...doc.data() });
                }
            });

            // 3. Calcular a pontuação de correspondência para cada usuário
            const currentUserHobbies = new Set(currentUserProfile.hobbies || []);
            const suggestedUsers = allUsers.map(user => {
                const otherUserHobbies = new Set(user.hobbies || []);
                const commonHobbies = [...currentUserHobbies].filter(hobby => otherUserHobbies.has(hobby));
                const score = commonHobbies.length;
                return { ...user, score, commonHobbies };
            }).filter(user => user.score > 0); // Apenas usuários com hobbies em comum

            // 4. Ordenar usuários por pontuação (mais hobbies em comum primeiro)
            suggestedUsers.sort((a, b) => b.score - a.score);

            suggestionsList.innerHTML = ''; // Limpar sugestões anteriores

            if (suggestedUsers.length === 0) {
                suggestionsList.innerHTML = '<p>Não encontramos sugestões com base em hobbies em comum.</p>';
            } else {
                // Limitar o número de sugestões para não sobrecarregar a UI
                const suggestionsToShow = suggestedUsers.slice(0, 10);
                for (const userData of suggestionsToShow) {
                    addSuggestionToDOM(userData.id, userData);
                }
            }

            suggestionsContainer.style.display = 'block';
        } catch (error) {
            console.error("Erro ao carregar sugestões de usuários:", error);
            if (suggestionsList) {
                suggestionsList.innerHTML = '<p>Ocorreu um erro ao carregar as sugestões.</p>';
            }
        }
    }


    async function checkConversations() {
        if (!currentUser) return;

        const conversationsRef = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid);

        const snapshot = await conversationsRef.get();
        const conversationsContainer = document.getElementById('conversations-list-container');

        if (snapshot.empty) {
            if (conversationsContainer) conversationsContainer.style.display = 'none';
            loadConversations(); // Carrega o estado de "nenhuma conversa"
            await showUserSuggestions();
        } else {
            if (conversationsContainer) conversationsContainer.style.display = 'block';
            loadConversations(); // Carrega as conversas existentes
            // Não é necessário chamar showUserSuggestions aqui, pois será chamado em loadConversations
        }
    }

    /**
     * Adiciona uma sugestão de amigo na tela.
     * @param {string} userId - O ID do usuário amigo.
     * @param {object} userData - Os dados do perfil do amigo.
     */
    function addSuggestionToDOM(userId, userData) {
        const suggestionTemplate = document.getElementById('suggestion-template');
        if (!suggestionTemplate || !suggestionsList) return;

        const suggestionClone = document.importNode(suggestionTemplate.content, true);
        const linkElement = suggestionClone.querySelector('.suggestion-item-link');
        const photoElement = suggestionClone.querySelector('.suggestion-photo');
        const nameElement = suggestionClone.querySelector('.suggestion-name');
        const courseElement = suggestionClone.querySelector('.suggestion-course');

        photoElement.src = userData.photoURL || '../img/Design sem nome2.png';
        nameElement.textContent = userData.nickname || 'Usuário';
        courseElement.textContent = userData.grade || 'Curso não informado';

        linkElement.href = '#';
        linkElement.addEventListener('click', (e) => {
            e.preventDefault();
            const conversationsContainer = document.getElementById('conversations-list-container');
            if (suggestionsContainer) suggestionsContainer.style.display = 'none';
            if (conversationsContainer) conversationsContainer.style.display = 'block';
            startConversation(userId);
        });

        suggestionsList.appendChild(suggestionClone);
    }

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
                    alert('Erro ao fazer logout. Tente novamente.');
                });
        });
    }

    // Event listener para o botão de enviar mensagem
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', function() {
            sendMessage().catch(error => {
                console.error('Erro ao enviar mensagem:', error);
                alert('Erro ao enviar mensagem. Tente novamente.');
            });
        });
    }

    // Event listener para o input de mensagem (Enter)
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage().catch(error => {
                    console.error('Erro ao enviar mensagem:', error);
                    alert('Erro ao enviar mensagem. Tente novamente.');
                });
            }
        });
    }

    // Event listener para o botão de emoji
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Impede que o clique feche o seletor imediatamente
            const isVisible = emojiPicker.style.display !== 'none';
            emojiPicker.style.display = isVisible ? 'none' : 'block';
        });

        // Adiciona o emoji selecionado ao campo de texto
        emojiPicker.addEventListener('emoji-click', event => {
            if(chatInput) chatInput.value += event.detail.emoji.unicode;
        });

        // Fecha o seletor de emojis se clicar fora dele
        document.addEventListener('click', (event) => {
            if (!emojiPicker.contains(event.target) && event.target !== emojiBtn) {
                emojiPicker.style.display = 'none';
            }
        });
    }

    // Função para verificar parâmetros da URL
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('uid');

        if (userId && userId !== currentUser.uid) {
            startConversation(userId);
        }
    }

    // Função para carregar o perfil do usuário atual
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

    function safeGetDate(timestamp) {
        if (!timestamp) return new Date();
        if (timestamp && typeof timestamp.toDate === 'function') {
            try { return timestamp.toDate(); } catch (e) { console.error('Erro ao converter Timestamp para Date:', e); return new Date(); }
        }
        if (timestamp instanceof Date) return timestamp;
        if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
            try { return new Date(timestamp.seconds * 1000); } catch (e) { console.error('Erro ao converter objeto seconds para Date:', e); return new Date(); }
        }
        if (typeof timestamp === 'number') return new Date(timestamp);
        if (typeof timestamp === 'string') {
            try { return new Date(timestamp); } catch (e) { console.error('Erro ao converter string para Date:', e); return new Date(); }
        }
        return new Date();
    }

    function loadConversations() {
        if (!conversationsList) return;
        conversationsList.innerHTML = '<div class="loading-conversations"><i class="fas fa-spinner fa-spin"></i> Carregando conversas...</div>';
        if (conversationsListener) conversationsListener();
        processedConversations = new Map();
        try {
            conversationsListener = db.collection('conversations')
                .where('participants', 'array-contains', currentUser.uid)
                .onSnapshot(async snapshot => { // Adicionado async aqui
                    if (snapshot.empty) {
                        if (conversationsList.innerHTML.includes('loading-conversations')) {
                            conversationsList.innerHTML = '<div class="no-conversations">Nenhuma conversa encontrada.</div>';
                        }
                        await showUserSuggestions(); // Chamar sugestões se não houver conversas
                        return;
                    }
                    const existingConversations = new Map();
                    document.querySelectorAll('.conversation-item').forEach(item => {
                        existingConversations.set(item.dataset.userId, item);
                    });
                    if (conversationsList.querySelector('.loading-conversations')) {
                        conversationsList.innerHTML = '';
                    }
                    let allConversations = [];
                    snapshot.forEach(doc => {
                        allConversations.push({ id: doc.id, ...doc.data() });
                    });
                    allConversations.sort((a, b) => {
                        const timeA = safeGetDate(a.lastMessageTime);
                        const timeB = safeGetDate(b.lastMessageTime);
                        return timeB - timeA;
                    });
                    await processConversations(allConversations, existingConversations); // Adicionado await aqui
                    await showUserSuggestions(); // Chamar sugestões após carregar as conversas
                }, error => {
                    console.error('Erro ao carregar conversas:', error);
                    conversationsList.innerHTML = '<div class="error-message">Erro ao carregar conversas. Tente novamente mais tarde.</div>';
                });
        } catch (error) {
            console.error('Erro ao configurar listener de conversas:', error);
            conversationsList.innerHTML = '<div class="error-message">Erro ao configurar sistema de mensagens. Tente novamente mais tarde.</div>';
        }
    }

    async function processConversations(conversations, existingConversations) {
        const fragment = document.createDocumentFragment();
        const processedIds = new Set();
        for (const conversation of conversations) {
            try {
                const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
                if (!otherUserId) continue;
                processedIds.add(otherUserId);
                if (existingConversations.has(otherUserId)) {
                    const existingElement = existingConversations.get(otherUserId);
                    const lastMessageElement = existingElement.querySelector('.conversation-last-message');
                    const timeElement = existingElement.querySelector('.conversation-time');
                    if (lastMessageElement) lastMessageElement.textContent = conversation.lastMessage || 'Nenhuma mensagem ainda';
                    if (timeElement) timeElement.textContent = formatTimestamp(safeGetDate(conversation.lastMessageTime));
                    fragment.appendChild(existingElement);
                    continue;
                }
                if (processedConversations.has(otherUserId)) {
                    console.log(`Conversa duplicada com usuário ${otherUserId} ignorada`);
                    continue;
                }
                processedConversations.set(otherUserId, conversation.id);
                const userDoc = await db.collection('users').doc(otherUserId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const conversationElement = document.createElement('div');
                    conversationElement.className = 'conversation-item';
                    conversationElement.dataset.conversationId = conversation.id;
                    conversationElement.dataset.userId = otherUserId;
                    const formattedTime = formatTimestamp(safeGetDate(conversation.lastMessageTime));
                    conversationElement.innerHTML = `
                        <img src="${userData.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="conversation-avatar">
                        <div class="conversation-info">
                            <h3 class="conversation-name">${userData.nickname || 'Usuário'}</h3>
                            <p class="conversation-last-message">${conversation.lastMessage || 'Nenhuma mensagem ainda'}</p>
                        </div>
                        <div class="conversation-time">${formattedTime}</div>
                    `;
                    conversationElement.addEventListener('click', function() {
                        document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
                        this.classList.add('active');
                        loadMessages(conversation.id, otherUserId);
                    });
                    fragment.appendChild(conversationElement);
                    if (conversation.id === currentChatId) conversationElement.classList.add('active');
                }
            } catch (error) {
                console.error('Erro ao processar conversa:', error);
            }
        }
        existingConversations.forEach((element, userId) => {
            if (!processedIds.has(userId) && element.parentNode === conversationsList) {
                conversationsList.removeChild(element);
            }
        });
        if (conversationsList) {
            conversationsList.appendChild(fragment);
            if (!currentChatId && conversationsList.children.length > 0) {
                const firstConversation = conversationsList.querySelector('.conversation-item');
                if (firstConversation) firstConversation.click();
            }
        }
    }

    async function startConversation(userId) {
        try {
            const conversationsSnapshot = await db.collection('conversations')
                .where('participants', 'array-contains', currentUser.uid).get();
            let existingConversation = null;
            conversationsSnapshot.forEach(doc => {
                const conversation = doc.data();
                if (conversation.participants.includes(userId)) existingConversation = { id: doc.id, ...conversation };
            });
            if (existingConversation) {
                loadMessages(existingConversation.id, userId);
                setTimeout(() => {
                    const conversationElement = document.querySelector(`.conversation-item[data-conversation-id="${existingConversation.id}"]`);
                    if (conversationElement) {
                        document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
                        conversationElement.classList.add('active');
                        conversationElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 500);
            } else {
                const userIds = [currentUser.uid, userId].sort();
                const conversationId = `${userIds[0]}_${userIds[1]}`;
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    await db.collection('conversations').doc(conversationId).set({
                        participants: [currentUser.uid, userId],
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessage: 'Nenhuma mensagem ainda'
                    });
                    loadMessages(conversationId, userId);
                }
            }
        } catch (error) {
            console.error('Erro ao iniciar conversa:', error);
            alert('Erro ao iniciar conversa. Tente novamente.');
        }
    }

    function loadMessages(conversationId, otherUserId) {
        currentChatId = conversationId;
        if (!chatMessages || !chatArea) return;
        chatMessages.innerHTML = '<div class="loading-messages"><i class="fas fa-spinner fa-spin"></i> Carregando mensagens...</div>';
        if (messagesListener) messagesListener();
        db.collection('users').doc(otherUserId).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    currentChatUser = { id: otherUserId, ...userData };
                    if (chatUserName) chatUserName.textContent = userData.nickname || 'Usuário';
                    if (chatAvatar) chatAvatar.src = userData.photoURL || '../img/Design sem nome2.png';
                    chatArea.style.display = 'flex';
                }
            }).catch(error => console.error('Erro ao carregar perfil do usuário:', error));
        hasMessages = false;
        messagesSent.clear();
        messagesListener = db.collection('conversations').doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const isFirstLoad = chatMessages.querySelector('.loading-messages');
                if (isFirstLoad) chatMessages.innerHTML = '';
                if (snapshot.empty && isFirstLoad) {
                    chatMessages.innerHTML = '<div class="no-messages">Nenhuma mensagem ainda. Diga olá!</div>';
                    hasMessages = false;
                    return;
                }
                if (!snapshot.empty) {
                    hasMessages = true;
                    const noMessagesElement = chatMessages.querySelector('.no-messages');
                    if (noMessagesElement) noMessagesElement.remove();
                }
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        if (!messagesSent.has(message.id)) addMessageToDOM(message);
                    } else if (change.type === 'removed') {
                        const messageElement = document.querySelector(`.message[data-message-id="${change.doc.id}"]`);
                        if (messageElement) messageElement.remove();
                    }
                });
                scrollToBottom();
            }, error => {
                console.error('Erro ao carregar mensagens:', error);
                chatMessages.innerHTML = '<div class="error-message">Erro ao carregar mensagens. Tente novamente mais tarde.</div>';
            });
    }

    function addMessageToDOM(message) {
        if (document.querySelector(`.message[data-message-id="${message.id}"]`)) return;
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === currentUser.uid ? 'message-sent' : 'message-received'}`;
        messageElement.dataset.messageId = message.id;
        const date = safeGetDate(message.timestamp);
        const timeString = formatTimestamp(date, true);
        const messageText = message.text || '';
        messageElement.innerHTML = `
            <div class="message-content">
                ${messageText}
            </div>
            <div class="message-time">${timeString}</div>
            ${message.senderId === currentUser.uid ? `
                <div class="message-actions">
                    <button class="message-delete-btn" title="Excluir mensagem"><i class="fas fa-trash"></i></button>
                </div>
            ` : ''}
        `;
        const deleteBtn = messageElement.querySelector('.message-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                deleteMessage(message.id);
            });
        }
        if (chatMessages) chatMessages.appendChild(messageElement);
    }

    async function sendMessage() {
        if (!currentChatId || !currentChatUser || !chatInput) {
            alert('Selecione uma conversa para enviar mensagens.');
            return;
        }
        const messageText = chatInput.value.trim();
        if (!messageText) return;
        const messageId = `${currentUser.uid}_${Date.now()}`;
        try {
            chatInput.value = '';
            const conversationDoc = await db.collection('conversations').doc(currentChatId).get();
            if (!conversationDoc.exists) {
                await db.collection('conversations').doc(currentChatId).set({
                    participants: [currentUser.uid, currentChatUser.id],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: messageText
                });
            }
            if (chatMessages) {
                const noMessagesElement = chatMessages.querySelector('.no-messages');
                if (noMessagesElement) {
                    noMessagesElement.remove();
                    hasMessages = true;
                }
            }
            const message = {
                text: messageText,
                senderId: currentUser.uid,
                senderName: currentUserProfile.nickname || 'Usuário',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            await db.collection('conversations').doc(currentChatId)
                .collection('messages').doc(messageId).set(message);
            messagesSent.add(messageId);
            await db.collection('conversations').doc(currentChatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastSenderId: currentUser.uid
            });
            try {
                await db.collection('users').doc(currentChatUser.id)
                    .collection('notifications').add({
                        type: 'message',
                        fromUserId: currentUser.uid,
                        fromUserName: currentUserProfile.nickname || 'Usuário',
                        fromUserPhoto: currentUserProfile.photoURL || null,
                        content: 'enviou uma mensagem para você',
                        conversationId: currentChatId,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
            } catch (notifError) {
                console.error('Erro ao criar notificação:', notifError);
            }
            const newMessage = {
                id: messageId,
                ...message,
                text: messageText,
                timestamp: new Date()
            };
            addMessageToDOM(newMessage);
            scrollToBottom();
            console.log('Mensagem enviada com sucesso');
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            throw error;
        }
    }

    async function deleteMessage(messageId) {
        // Assuming showConfirmationModal and showCustomAlert are defined elsewhere
        const confirmed = confirm("Tem a certeza que deseja excluir esta mensagem?");
        if (!confirmed) return;

        try {
            await db.collection('conversations').doc(currentChatId)
                .collection('messages').doc(messageId).delete();
            console.log('Mensagem excluída com sucesso');
        } catch (error) {
            console.error('Erro ao excluir mensagem:', error);
            alert('Erro ao excluir mensagem. Tente novamente.');
        }
    }

    function formatTimestamp(date, includeTime = false) {
        if (!(date instanceof Date) || isNaN(date)) return 'Agora mesmo';
        const now = new Date();
        const diff = now - date;
        if (diff < 24 * 60 * 60 * 1000) {
            if (includeTime) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (diff < 60 * 1000) return 'Agora mesmo';
            if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} min atrás`;
            return `${Math.floor(diff / (60 * 60 * 1000))}h atrás`;
        }
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return days[date.getDay()];
        }
        return `${date.getDate()}/${date.getMonth() + 1}`;
    }

    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
});