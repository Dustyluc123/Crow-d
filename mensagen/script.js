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

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Referências aos elementos do DOM
    const conversationsList = document.querySelector('.conversations-list');
    const chatArea = document.querySelector('.chat-area');
    const chatHeader = document.querySelector('.chat-header');
    const chatMessages = document.querySelector('.chat-messages');
    const chatInput = document.querySelector('.chat-input');
    const chatSendBtn = document.querySelector('.chat-send-btn');
    const chatUserName = document.querySelector('.chat-user-name');
    const chatAvatar = document.querySelector('.chat-avatar');
    const logoutButton = document.querySelector('.logout-btn');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.querySelector('emoji-picker');

    let currentUser = null;
    let currentUserProfile = null;
    let currentChatUser = null;
    let currentChatId = null;
    let messagesListener = null;
    let conversationsListener = null;

    auth.onAuthStateChanged(async function(user) {
        const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink && user) {
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            loadConversationsAndSuggestions(); // Função principal que carrega tudo
            checkUrlParams();
        } else {
            window.location.href = '../login/login.html';
        }
    });

    async function loadUserProfile(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        }
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('uid');
        if (userId && userId !== currentUser.uid) {
            startConversation(userId);
        }
    }

    function loadConversationsAndSuggestions() {
        if (conversationsListener) conversationsListener();

        conversationsList.innerHTML = '<div class="loading-conversations"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        conversationsListener = db.collection('conversations')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastMessageTime', 'desc')
            .onSnapshot(async snapshot => {
                conversationsList.innerHTML = ''; // Limpa a lista para redesenhar

                if (snapshot.empty) {
                    const noConvEl = document.createElement('div');
                    noConvEl.className = 'no-conversations';
                    noConvEl.textContent = 'Nenhuma conversa encontrada.';
                    conversationsList.appendChild(noConvEl);
                } else {
                    for (const doc of snapshot.docs) {
                        const conversation = { id: doc.id, ...doc.data() };
                        const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
                        if (otherUserId) {
                            const userDoc = await db.collection('users').doc(otherUserId).get();
                            if (userDoc.exists) {
                                const conversationElement = createConversationElement(conversation, userDoc.data());
                                conversationsList.appendChild(conversationElement);
                            }
                        }
                    }
                }

                // Carrega as sugestões DEPOIS de carregar as conversas
                await loadFriendSuggestions();

            }, error => {
                console.error('Erro ao carregar conversas:', error);
                conversationsList.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
            });
    }

    async function loadFriendSuggestions() {
        try {
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
            if (friendsSnapshot.empty) return; // Não faz nada se não tiver amigos

            // Adiciona o título "Sugestões"
            const suggestionsHeader = document.createElement('div');
            suggestionsHeader.className = 'suggestions-header';
            suggestionsHeader.innerHTML = '<h4>Sugestões</h4>';
            conversationsList.appendChild(suggestionsHeader);

            for (const friendDoc of friendsSnapshot.docs) {
                const friendId = friendDoc.id;
                const userDoc = await db.collection('users').doc(friendId).get();
                if (userDoc.exists) {
                    addSuggestionToDOM(friendId, userDoc.data());
                }
            }
        } catch (error) {
            console.error("Erro ao carregar sugestões de amigos:", error);
        }
    }

    function createConversationElement(conversation, userData) {
        const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
        const element = document.createElement('div');
        element.className = 'conversation-item';
        element.dataset.conversationId = conversation.id;
        element.dataset.userId = otherUserId;

        element.innerHTML = `
            <img src="${userData.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="conversation-avatar">
            <div class="conversation-info">
                <h3 class="conversation-name">${userData.nickname || 'Usuário'}</h3>
                <p class="conversation-last-message">${conversation.lastMessage || ''}</p>
            </div>
            <div class="conversation-time">${formatTimestamp(conversation.lastMessageTime?.toDate())}</div>
        `;

        element.addEventListener('click', function() {
            document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            loadMessages(conversation.id, otherUserId);
        });

        return element;
    }

    function addSuggestionToDOM(userId, userData) {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-item';
        suggestionElement.innerHTML = `
            <img src="${userData.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="conversation-avatar">
            <div class="suggestion-info">
                <h3 class="conversation-name">${userData.nickname || 'Usuário'}</h3>
            </div>
            <button class="start-chat-btn" title="Iniciar conversa"><i class="fas fa-paper-plane"></i></button>
        `;

        suggestionElement.addEventListener('click', () => startConversation(userId));
        conversationsList.appendChild(suggestionElement);
    }

    async function startConversation(userId) {
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const convRef = db.collection('conversations').doc(conversationId);

        const doc = await convRef.get();
        if (!doc.exists) {
            await convRef.set({
                participants: [currentUser.uid, userId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        loadMessages(conversationId, userId);
        // Ativa visualmente o item na lista se ele já existir
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('active', item.dataset.userId === userId);
        });
    }

    function loadMessages(conversationId, otherUserId) {
        currentChatId = conversationId;
        chatMessages.innerHTML = '<div class="loading-messages"><i class="fas fa-spinner fa-spin"></i></div>';
        if (messagesListener) messagesListener();

        db.collection('users').doc(otherUserId).get().then(doc => {
            if (doc.exists) {
                currentChatUser = { id: otherUserId, ...doc.data() };
                chatUserName.textContent = currentChatUser.nickname || 'Usuário';
                chatAvatar.src = currentChatUser.photoURL || '../img/Design sem nome2.png';
                chatArea.style.display = 'flex';
            }
        });

        messagesListener = db.collection('conversations').doc(conversationId).collection('messages').orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                chatMessages.innerHTML = '';
                if (snapshot.empty) {
                    chatMessages.innerHTML = '<div class="no-messages">Diga olá!</div>';
                    return;
                }
                snapshot.forEach(doc => addMessageToDOM(doc.id, doc.data()));
                scrollToBottom();
            });
    }

    function addMessageToDOM(messageId, message) {
        const element = document.createElement('div');
        element.className = `message ${message.senderId === currentUser.uid ? 'message-sent' : 'message-received'}`;
        element.dataset.messageId = messageId;
        element.innerHTML = `
            <div class="message-content">
                <p class="message-text">${message.text || ''}</p>
                <span class="message-time">${formatTimestamp(message.timestamp?.toDate(), true)}</span>
            </div>
            ${message.senderId === currentUser.uid ? `<div class="message-actions"><button class="message-delete-btn" title="Excluir"><i class="fas fa-trash"></i></button></div>` : ''}
        `;

        if (message.senderId === currentUser.uid) {
            element.querySelector('.message-delete-btn').addEventListener('click', () => deleteMessage(messageId));
        }

        chatMessages.appendChild(element);
    }

    async function sendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText || !currentChatId) return;
        chatInput.value = '';

        const messageData = {
            text: messageText,
            senderId: currentUser.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('conversations').doc(currentChatId).collection('messages').add(messageData);
        await db.collection('conversations').doc(currentChatId).update({
            lastMessage: messageText,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        scrollToBottom();
    }
    
    async function deleteMessage(messageId) {
        if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
        await db.collection('conversations').doc(currentChatId).collection('messages').doc(messageId).delete();
    }

    function formatTimestamp(date, includeTime = false) {
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        const oneDay = 24 * 60 * 60 * 1000;
        if (diff < oneDay) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    }
    
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Event Listeners dos botões e inputs
    if(logoutButton) logoutButton.addEventListener('click', () => auth.signOut());
    if(chatSendBtn) chatSendBtn.addEventListener('click', sendMessage);
    if(chatInput) chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
    
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
        });
        emojiPicker.addEventListener('emoji-click', e => chatInput.value += e.detail.emoji.unicode);
        document.addEventListener('click', (e) => {
            if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
                emojiPicker.style.display = 'none';
            }
        });
    }
});