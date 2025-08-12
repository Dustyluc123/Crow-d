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

    // Variáveis globais
    let currentUser = null;
    let currentUserProfile = null;
    let currentChatUser = null;
    let currentChatId = null;
    let messagesListener = null;
    let conversationsListener = null;
    let hasMessages = false; // Flag para controlar se já existem mensagens
    let processedConversations = new Map(); // Para evitar duplicatas na lista de conversas (usando Map em vez de Set)
    let messagesSent = new Set(); // Para evitar duplicidade de mensagens

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            // Usuário está logado
            currentUser = user;
            
            // Carregar perfil do usuário
            await loadUserProfile(user.uid);
            
            // Carregar conversas
            loadConversations();
            
            // Verificar se há um usuário específico para iniciar conversa (via parâmetro URL)
            checkUrlParams();
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

    // Função para verificar parâmetros da URL
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('uid');
        
        if (userId && userId !== currentUser.uid) {
            // Iniciar conversa com o usuário especificado
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

    // Função utilitária para converter qualquer formato de timestamp para Date
    function safeGetDate(timestamp) {
        if (!timestamp) {
            return new Date(); // Se não houver timestamp, retorna data atual
        }
        
        // Se for um Timestamp do Firestore com método toDate()
        if (timestamp && typeof timestamp.toDate === 'function') {
            try {
                return timestamp.toDate();
            } catch (e) {
                console.error('Erro ao converter Timestamp para Date:', e);
                return new Date();
            }
        }
        
        // Se já for um objeto Date
        if (timestamp instanceof Date) {
            return timestamp;
        }
        
        // Se for um objeto com seconds (formato do Firestore)
        if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
            try {
                return new Date(timestamp.seconds * 1000);
            } catch (e) {
                console.error('Erro ao converter objeto seconds para Date:', e);
                return new Date();
            }
        }
        
        // Se for um número (timestamp em milissegundos)
        if (typeof timestamp === 'number') {
            return new Date(timestamp);
        }
        
        // Se for uma string ISO
        if (typeof timestamp === 'string') {
            try {
                return new Date(timestamp);
            } catch (e) {
                console.error('Erro ao converter string para Date:', e);
                return new Date();
            }
        }
        
        // Fallback para data atual
        return new Date();
    }

    // Função para carregar conversas do usuário
    function loadConversations() {
        // Limpar lista de conversas
        conversationsList.innerHTML = '<div class="loading-conversations"><i class="fas fa-spinner fa-spin"></i> Carregando conversas...</div>';
        
        // Remover listener anterior se existir
        if (conversationsListener) {
            conversationsListener();
        }
        
        // Resetar o mapa de conversas processadas
        processedConversations = new Map();
        
        try {
            // Criar listener para conversas em tempo real - SEM ORDERBY para evitar necessidade de índice
            conversationsListener = db.collection('conversations')
                .where('participants', 'array-contains', currentUser.uid)
                .onSnapshot(snapshot => {
                    // Verificar se há conversas
                    if (snapshot.empty) {
                        conversationsList.innerHTML = '<div class="no-conversations">Nenhuma conversa encontrada.</div>';
                        return;
                    }
                    
                    // Manter referência às conversas existentes
                    const existingConversations = new Map();
                    document.querySelectorAll('.conversation-item').forEach(item => {
                        existingConversations.set(item.dataset.userId, item);
                    });
                    
                    // Limpar lista de conversas apenas na primeira carga
                    if (conversationsList.querySelector('.loading-conversations')) {
                        conversationsList.innerHTML = '';
                    }
                    
                    // Array para armazenar todas as conversas
                    let allConversations = [];
                    
                    // Adicionar cada conversa ao array
                    snapshot.forEach(doc => {
                        const conversation = {
                            id: doc.id,
                            ...doc.data()
                        };
                        allConversations.push(conversation);
                    });
                    
                    // Ordenar manualmente por lastMessageTime (mais recente primeiro)
                    allConversations.sort((a, b) => {
                        // Usar a função utilitária para obter datas seguras
                        const timeA = safeGetDate(a.lastMessageTime);
                        const timeB = safeGetDate(b.lastMessageTime);
                        return timeB - timeA;
                    });
                    
                    // Processar cada conversa
                    processConversations(allConversations, existingConversations);
                    
                }, error => {
                    console.error('Erro ao carregar conversas:', error);
                    conversationsList.innerHTML = '<div class="error-message">Erro ao carregar conversas. Tente novamente mais tarde.</div>';
                });
        } catch (error) {
            console.error('Erro ao configurar listener de conversas:', error);
            conversationsList.innerHTML = '<div class="error-message">Erro ao configurar sistema de mensagens. Tente novamente mais tarde.</div>';
        }
    }
    
    // Função para processar conversas e adicionar ao DOM
    async function processConversations(conversations, existingConversations) {
        // Criar um fragmento para adicionar todas as conversas de uma vez
        const fragment = document.createDocumentFragment();
        const processedIds = new Set();
        
        // Para cada conversa
        for (const conversation of conversations) {
            try {
                // Obter o outro participante (não o usuário atual)
                const otherUserId = conversation.participants.find(id => id !== currentUser.uid);
                
                if (!otherUserId) continue;
                
                // Marcar este ID como processado
                processedIds.add(otherUserId);
                
                // Verificar se já temos um elemento para este usuário
                if (existingConversations.has(otherUserId)) {
                    const existingElement = existingConversations.get(otherUserId);
                    
                    // Atualizar a última mensagem e timestamp
                    const lastMessageElement = existingElement.querySelector('.conversation-last-message');
                    const timeElement = existingElement.querySelector('.conversation-time');
                    
                    if (lastMessageElement) {
                        lastMessageElement.textContent = conversation.lastMessage || 'Nenhuma mensagem ainda';
                    }
                    
                    if (timeElement) {
                        const date = safeGetDate(conversation.lastMessageTime);
                        timeElement.textContent = formatTimestamp(date);
                    }
                    
                    // Mover para o fragmento para reordenar
                    fragment.appendChild(existingElement);
                    continue;
                }
                
                // Verificar se já processamos uma conversa com este usuário nesta sessão
                if (processedConversations.has(otherUserId)) {
                    console.log(`Conversa duplicada com usuário ${otherUserId} ignorada`);
                    continue;
                }
                
                // Marcar este usuário como processado
                processedConversations.set(otherUserId, conversation.id);
                
                // Obter perfil do outro usuário
                const userDoc = await db.collection('users').doc(otherUserId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // Criar elemento de conversa
                    const conversationElement = document.createElement('div');
                    conversationElement.className = 'conversation-item';
                    conversationElement.dataset.conversationId = conversation.id;
                    conversationElement.dataset.userId = otherUserId;
                    
                    // Formatar o timestamp com segurança usando a função utilitária
                    const date = safeGetDate(conversation.lastMessageTime);
                    const formattedTime = formatTimestamp(date);
                    
                    // Definir HTML da conversa
                    conversationElement.innerHTML = `
                        <img src="${userData.photoURL || '../img/Design sem nome2.png'}" alt="Avatar" class="conversation-avatar">
                        <div class="conversation-info">
                            <h3 class="conversation-name">${userData.nickname || 'Usuário'}</h3>
                            <p class="conversation-last-message">${conversation.lastMessage || 'Nenhuma mensagem ainda'}</p>
                        </div>
                        <div class="conversation-time">${formattedTime}</div>
                    `;
                    
                    // Adicionar event listener para clicar na conversa
                    conversationElement.addEventListener('click', function() {
                        // Remover classe 'active' de todas as conversas
                        document.querySelectorAll('.conversation-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Adicionar classe 'active' à conversa clicada
                        this.classList.add('active');
                        
                        // Carregar mensagens da conversa
                        loadMessages(conversation.id, otherUserId);
                    });
                    
                    // Adicionar ao fragmento
                    fragment.appendChild(conversationElement);
                    
                    // Se esta conversa já está aberta, mantê-la selecionada
                    if (conversation.id === currentChatId) {
                        conversationElement.classList.add('active');
                    }
                }
            } catch (error) {
                console.error('Erro ao processar conversa:', error);
            }
        }
        
        // Remover conversas que não estão mais na lista
        existingConversations.forEach((element, userId) => {
            if (!processedIds.has(userId)) {
                if (element.parentNode === conversationsList) {
                    conversationsList.removeChild(element);
                }
            }
        });
        
        // Adicionar todas as conversas ao DOM de uma vez
        conversationsList.appendChild(fragment);
        
        // Se não houver conversa ativa e temos pelo menos uma conversa, selecionar a primeira
        if (!currentChatId && conversationsList.children.length > 0) {
            const firstConversation = conversationsList.querySelector('.conversation-item');
            if (firstConversation) {
                firstConversation.click();
            }
        }
    }

    // Função para iniciar uma nova conversa com um usuário
    async function startConversation(userId) {
        try {
            // Verificar se já existe uma conversa entre os usuários
            const conversationsSnapshot = await db.collection('conversations')
                .where('participants', 'array-contains', currentUser.uid)
                .get();
            
            let existingConversation = null;
            
            conversationsSnapshot.forEach(doc => {
                const conversation = doc.data();
                if (conversation.participants.includes(userId)) {
                    existingConversation = {
                        id: doc.id,
                        ...conversation
                    };
                }
            });
            
            if (existingConversation) {
                // Conversa já existe, carregar mensagens
                loadMessages(existingConversation.id, userId);
                
                // Destacar a conversa na lista
                setTimeout(() => {
                    const conversationElement = document.querySelector(`.conversation-item[data-conversation-id="${existingConversation.id}"]`);
                    if (conversationElement) {
                        // Remover classe 'active' de todas as conversas
                        document.querySelectorAll('.conversation-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Adicionar classe 'active' à conversa
                        conversationElement.classList.add('active');
                        
                        // Scroll para a conversa
                        conversationElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 500);
            } else {
                // Criar nova conversa - usar um ID consistente para evitar duplicatas
                // Ordenar os IDs para garantir que a mesma conversa seja encontrada independente de quem inicia
                const userIds = [currentUser.uid, userId].sort();
                const conversationId = `${userIds[0]}_${userIds[1]}`;
                
                // Obter perfil do outro usuário
                const userDoc = await db.collection('users').doc(userId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // Criar documento de conversa
                    await db.collection('conversations').doc(conversationId).set({
                        participants: [currentUser.uid, userId],
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessage: 'Nenhuma mensagem ainda'
                    });
                    
                    // Carregar mensagens da nova conversa
                    loadMessages(conversationId, userId);
                }
            }
        } catch (error) {
            console.error('Erro ao iniciar conversa:', error);
            alert('Erro ao iniciar conversa. Tente novamente.');
        }
    }

    // Função para carregar mensagens de uma conversa
    function loadMessages(conversationId, otherUserId) {
        // Atualizar variáveis globais
        currentChatId = conversationId;
        
        // Limpar área de mensagens
        chatMessages.innerHTML = '<div class="loading-messages"><i class="fas fa-spinner fa-spin"></i> Carregando mensagens...</div>';
        
        // Remover listener anterior se existir
        if (messagesListener) {
            messagesListener();
        }
        
        // Carregar perfil do outro usuário
        db.collection('users').doc(otherUserId).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    currentChatUser = {
                        id: otherUserId,
                        ...userData
                    };
                    
                    // Atualizar cabeçalho do chat
                    chatUserName.textContent = userData.nickname || 'Usuário';
                    chatAvatar.src = userData.photoURL || '../img/Design sem nome2.png';
                    
                    // Mostrar área de chat
                    chatArea.style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar perfil do usuário:', error);
            });
        
        // Resetar flag de mensagens
        hasMessages = false;
        
        // Limpar conjunto de mensagens enviadas
        messagesSent.clear();
        
        // Criar listener para mensagens em tempo real
        messagesListener = db.collection('conversations').doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                // Verificar se é a primeira carga ou atualização
                const isFirstLoad = chatMessages.querySelector('.loading-messages');
                
                // Limpar área de mensagens na primeira carga
                if (isFirstLoad) {
                    chatMessages.innerHTML = '';
                }
                
                // Verificar se há mensagens
                if (snapshot.empty && isFirstLoad) {
                    chatMessages.innerHTML = '<div class="no-messages">Nenhuma mensagem ainda. Diga olá!</div>';
                    hasMessages = false;
                    return;
                }
                
                // Se temos mensagens, atualizar a flag
                if (!snapshot.empty) {
                    hasMessages = true;
                    
                    // Remover a mensagem "Nenhuma mensagem ainda"
                    const noMessagesElement = chatMessages.querySelector('.no-messages');
                    if (noMessagesElement) {
                        noMessagesElement.remove();
                    }
                }
                
                // Processar alterações
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        if (!messagesSent.has(message.id)) {
                            addMessageToDOM(message);
                        }
                    }
                    else if (change.type === 'removed') {
                        // Remove a mensagem da tela quando for excluída
                        const messageElement = document.querySelector(`.message[data-message-id="${change.doc.id}"]`);
                        if (messageElement) {
                            messageElement.remove();
                        }
                    }
                });
                
                
                // Scroll para a última mensagem
                scrollToBottom();
            }, error => {
                console.error('Erro ao carregar mensagens:', error);
                chatMessages.innerHTML = '<div class="error-message">Erro ao carregar mensagens. Tente novamente mais tarde.</div>';
            });
    }

    // Função para adicionar uma mensagem ao DOM
    function addMessageToDOM(message) {
        // Verificar se a mensagem já existe no DOM
        if (document.querySelector(`.message[data-message-id="${message.id}"]`)) {
            return;
        }
        
        // Criar elemento de mensagem
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === currentUser.uid ? 'message-sent' : 'message-received'}`;
        messageElement.dataset.messageId = message.id;
        
        // Usar a função utilitária para obter uma data segura
        const date = safeGetDate(message.timestamp);
        const timeString = formatTimestamp(date, true);
        
        // Garantir que o texto da mensagem não seja undefined
        const messageText = message.text || '';
        
        // Definir HTML da mensagem
        messageElement.innerHTML = `
            <div class="message-content">
                ${messageText}
            </div>
            <div class="message-time">${timeString}</div>
            ${message.senderId === currentUser.uid ? `
                <div class="message-actions">
                    <button class="message-delete-btn" title="Excluir mensagem"><i class="fas fa-trash"></i></button>
                </div>
            ` : `
                <div class="message-actions">
                    <button class="message-report-btn" title="Denunciar mensagem"><i class="fas fa-flag"></i></button>
                </div>
            `}
        `;
        
        // Adicionar event listeners para botões de ação
        const deleteBtn = messageElement.querySelector('.message-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                deleteMessage(message.id);
            });
        }
        
        const reportBtn = messageElement.querySelector('.message-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', function() {
                reportMessage(message.id);
            });
        }
        
        // Adicionar à área de mensagens
        chatMessages.appendChild(messageElement);
    }

    // Função para enviar uma mensagem
    async function sendMessage() {
        // Verificar se há uma conversa ativa
        if (!currentChatId || !currentChatUser) {
            alert('Selecione uma conversa para enviar mensagens.');
            return;
        }
        
        // Obter texto da mensagem
        const messageText = chatInput.value.trim();
        
        // Verificar se a mensagem não está vazia
        if (!messageText) {
            return;
        }
        
        // Gerar um ID único para a mensagem
        const messageId = `${currentUser.uid}_${Date.now()}`;
        
        try {
            // Limpar input antes de enviar (para feedback imediato ao usuário)
            chatInput.value = '';
            
            // Verificar se o documento da conversa existe
            const conversationDoc = await db.collection('conversations').doc(currentChatId).get();
            
            if (!conversationDoc.exists) {
                // Se a conversa não existe, criá-la
                await db.collection('conversations').doc(currentChatId).set({
                    participants: [currentUser.uid, currentChatUser.id],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: messageText
                });
            }
            
            // Remover a mensagem "Nenhuma mensagem ainda" se existir
            const noMessagesElement = chatMessages.querySelector('.no-messages');
            if (noMessagesElement) {
                noMessagesElement.remove();
                hasMessages = true;
            }
            
            // Criar objeto de mensagem
            const message = {
                text: messageText, // Garantir que o campo text esteja definido
                senderId: currentUser.uid,
                senderName: currentUserProfile.nickname || 'Usuário',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            
            // Adicionar mensagem à conversa
            await db.collection('conversations').doc(currentChatId)
                .collection('messages').doc(messageId).set(message);
            
            // Adicionar ao conjunto de mensagens enviadas para evitar duplicidade
            messagesSent.add(messageId);
            
            // Atualizar última mensagem na conversa
            await db.collection('conversations').doc(currentChatId).update({
                lastMessage: messageText,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastSenderId: currentUser.uid
            });
            
            // Criar notificação para o outro usuário
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
                // Não interromper o fluxo se a notificação falhar
            }
            
            // Adicionar mensagem ao DOM imediatamente (não esperar pelo listener)
            // Usar uma data local para exibição imediata em vez do serverTimestamp
            const localDate = new Date();
            const newMessage = {
                id: messageId,
                ...message,
                text: messageText, // Garantir que o texto esteja definido
                timestamp: localDate // Usar data local para exibição imediata
            };
            
            addMessageToDOM(newMessage);
            scrollToBottom();
            
            console.log('Mensagem enviada com sucesso');
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            throw error; // Propagar o erro para ser tratado pelo event listener
        }
    }

    // Função para excluir uma mensagem
    async function deleteMessage(messageId) {
        try {
            // Confirmar exclusão
            if (!confirm('Tem certeza que deseja excluir esta mensagem?')) {
                return;
            }
            
            // Excluir mensagem
            await db.collection('conversations').doc(currentChatId)
                .collection('messages').doc(messageId).delete();
            
            // Remover elemento do DOM
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            
            console.log('Mensagem excluída com sucesso');
        } catch (error) {
            console.error('Erro ao excluir mensagem:', error);
            alert('Erro ao excluir mensagem. Tente novamente.');
        }
    }

    // Função para denunciar uma mensagem
    function reportMessage(messageId) {
        // Implementação futura
        alert('Mensagem denunciada com sucesso. Nossa equipe irá analisar o conteúdo.');
    }

    // Função para formatar timestamp
    function formatTimestamp(date, includeTime = false) {
        // Verificar se date é um objeto Date válido
        if (!(date instanceof Date) || isNaN(date)) {
            return 'Agora mesmo';
        }
        
        const now = new Date();
        const diff = now - date;
        
        // Menos de 24 horas
        if (diff < 24 * 60 * 60 * 1000) {
            if (includeTime) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                // Menos de 1 minuto
                if (diff < 60 * 1000) {
                    return 'Agora mesmo';
                }
                
                // Menos de 1 hora
                if (diff < 60 * 60 * 1000) {
                    const minutes = Math.floor(diff / (60 * 1000));
                    return `${minutes} min atrás`;
                }
                
                // Menos de 24 horas
                const hours = Math.floor(diff / (60 * 60 * 1000));
                return `${hours}h atrás`;
            }
        }
        
        // Menos de 7 dias
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return days[date.getDay()];
        }
        
        // Mais de 7 dias
        return `${date.getDate()}/${date.getMonth() + 1}`;
    }

    // Função para scroll para a última mensagem
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Função completa addMessageToDOM(message)
    function addMessageToDOM(message) {
    // Verificar se a mensagem já existe no DOM
    if (document.querySelector(`.message[data-message-id="${message.id}"]`)) {
        return;
    }

    // Criar elemento de mensagem
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === currentUser.uid ? 'message-sent' : 'message-received'}`;
    messageElement.dataset.messageId = message.id;

    // Usar a função utilitária para obter uma data segura
    const date = safeGetDate(message.timestamp);
    const timeString = formatTimestamp(date, true);

    // Garantir que o texto da mensagem não seja undefined
    const messageText = message.text || '';

    // Definir HTML da mensagem
    messageElement.innerHTML = `
        <div class="message-content">
            ${messageText}
        </div>
        <div class="message-time">${timeString}</div>
        ${message.senderId === currentUser.uid ? `
            <div class="message-actions">
                <button class="message-delete-btn" title="Excluir mensagem">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        ` : `
            <div class="message-actions">
                <button class="message-report-btn" title="Denunciar mensagem">
                    <i class="fas fa-flag"></i>
                </button>
            </div>
        `}
    `;

    // Event listener para deletar
    const deleteBtn = messageElement.querySelector('.message-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteMessage(message.id);
        });
    }

    // Event listener para denunciar
    const reportBtn = messageElement.querySelector('.message-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            reportMessage(message.id);
        });
    }

    // Adicionar ao DOM
    chatMessages.appendChild(messageElement);
}

// Função deleteMessage(messageId)

async function deleteMessage(messageId) {
    if (!currentChatId || !currentUser) return;

    try {
        const messageRef = db.collection('conversations').doc(currentChatId)
                             .collection('messages').doc(messageId);

        await messageRef.delete();

        // Remover do DOM
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }

        // Verificar se há mensagens restantes
        const messagesSnapshot = await db.collection('conversations').doc(currentChatId)
                                         .collection('messages')
                                         .orderBy('timestamp', 'desc')
                                         .limit(1)
                                         .get();

        let newLastMessage = 'Nenhuma mensagem ainda';
        let newLastMessageTime = firebase.firestore.FieldValue.serverTimestamp();
        let newLastSenderId = null;

        if (!messagesSnapshot.empty) {
            const lastMessageData = messagesSnapshot.docs[0].data();
            newLastMessage = lastMessageData.text || '';
            newLastMessageTime = lastMessageData.timestamp;
            newLastSenderId = lastMessageData.senderId;
        } else {
            const conversationDoc = await db.collection('conversations').doc(currentChatId).get();
            if (conversationDoc.exists && conversationDoc.data().createdAt) {
                newLastMessageTime = conversationDoc.data().createdAt;
            }
        }

        // Atualizar conversa
        await db.collection('conversations').doc(currentChatId).update({
            lastMessage: newLastMessage,
            lastMessageTime: newLastMessageTime,
            lastSenderId: newLastSenderId
        });

        console.log(`Mensagem ${messageId} excluída com sucesso.`);
    } catch (error) {
        console.error("Erro ao excluir mensagem:", error);
        alert("Erro ao excluir mensagem. Tente novamente.");
    }
}
// Função para adicionar uma mensagem ao DOM
function addMessageToDOM(message) {
    // Verificar se a mensagem já existe no DOM
    if (document.querySelector(`.message[data-message-id="${message.id}"]`)) {
        return;
    }
    
    // Criar elemento de mensagem
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.senderId === currentUser.uid ? 'message-sent' : 'message-received'}`;
    messageElement.dataset.messageId = message.id;
    
    // Usar a função utilitária para obter uma data segura
    const date = safeGetDate(message.timestamp);
    const timeString = formatTimestamp(date, true);
    
    // Garantir que o texto da mensagem não seja undefined
    const messageText = message.text || '';
    
    // Definir HTML da mensagem, incluindo o botão que aparece no hover
    messageElement.innerHTML = `
        <div class="message-content">
            ${messageText}
        </div>
        <div class="message-time">${timeString}</div>
        ${message.senderId === currentUser.uid ? `
            <button class="message-delete-btn" title="Excluir mensagem"><i class="fas fa-trash"></i></button>
        ` : `
            <button class="message-report-btn" title="Denunciar mensagem"><i class="fas fa-flag"></i></button>
        `}
    `;
    
    // Adicionar event listener para o botão de excluir, se existir
    const deleteBtn = messageElement.querySelector('.message-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(event) {
            event.stopPropagation(); // evita disparar outros eventos
            deleteMessage(message.id);
        });
    }
    
    // Adicionar event listener para botão denunciar (se quiser)
    const reportBtn = messageElement.querySelector('.message-report-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            reportMessage(message.id);
        });
    }
    
    // Adicionar a mensagem no container de mensagens
    chatMessages.appendChild(messageElement);
}

// Função para excluir uma mensagem
async function deleteMessage(messageId) {
    if (!currentChatId || !currentUser) return;

    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) {
        return;
    }

    try {
        const messageRef = db.collection('conversations').doc(currentChatId)
                             .collection('messages').doc(messageId);

        await messageRef.delete();

        // Remover mensagem do DOM
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }

        console.log('Mensagem excluída com sucesso');
    } catch (error) {
        console.error('Erro ao excluir mensagem:', error);
        alert('Erro ao excluir mensagem. Tente novamente.');
    }
    
   

}





});
