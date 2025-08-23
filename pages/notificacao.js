// Ficheiro Completo: pages/notificacao/notificacao.js

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

    // Referências aos elementos do DOM
    const notificationsContainer = document.getElementById('notifications-container');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const logoutButton = document.getElementById('logout-btn');

    // Variáveis Globais
    let currentUser = null;
    let currentUserProfile = null; // Essencial para a nova lógica
    let notificationsListener = null;

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid); // Carrega os dados do perfil do usuário logado
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            loadNotifications();
            markNotificationsAsRead(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // Função para carregar o perfil do usuário logado (necessário para obter o nickname, etc.)
    async function loadUserProfile(userId) {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        } else {
            console.error("Perfil do usuário logado não encontrado!");
        }
    }

    // Listener do botão de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = '../login/login.html'; });
        });
    }

    // Listener do botão de marcar todas como lidas
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllAsRead());
    }

    // Carrega as notificações em tempo real
    function loadNotifications() {
        if (!notificationsContainer) return;
        notificationsContainer.innerHTML = '<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        if (notificationsListener) notificationsListener(); // Limpa o listener anterior para evitar duplicados

        let query = db.collection('users').doc(currentUser.uid)
            .collection('notifications')
            .orderBy('timestamp', 'desc')
            .limit(50);
        
        notificationsListener = query.onSnapshot(snapshot => {
            notificationsContainer.innerHTML = '';
            
            if (snapshot.empty) {
                notificationsContainer.innerHTML = `
                    <div class="notification-empty">
                        <i class="fas fa-bell-slash"></i>
                        <p>Nenhuma notificação encontrada.</p>
                    </div>`;
                return;
            }
            
            snapshot.forEach(doc => {
                const notification = { id: doc.id, ...doc.data() };
                addNotificationToDOM(notification);
            });
        }, error => {
            console.error('Erro ao carregar notificações:', error);
            notificationsContainer.innerHTML = '<div class="error-message">Erro ao carregar notificações.</div>';
        });
    }

    // --- CÓDIGO ATUALIZADO ---
    // Constrói cada item de notificação no HTML
    function addNotificationToDOM(notification) {
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;
        
        const userPhoto = notification.fromUserPhoto || '../img/Design sem nome2.png';
        const timestamp = notification.timestamp ? formatTimestamp(notification.timestamp.toDate()) : '';
    
        let notificationHTML = `
            <img src="${userPhoto}" alt="Avatar" class="notification-avatar">
            <div class="notification-content">
                <p class="notification-text"><strong>${notification.fromUserName}</strong> ${notification.content || ''}</p>
                <span class="notification-time">${timestamp}</span>
        `;
    
        if (notification.type === 'friend_request' && notification.requestId) {
            notificationHTML += `
                <div class="notification-item-actions">
                    <button class="notification-action-btn accept-btn">Aceitar</button>
                    <button class="notification-action-btn decline-btn">Recusar</button>
                </div>
            `;
        }
        
        notificationHTML += `</div>`;
        notificationElement.innerHTML = notificationHTML;
        
        const acceptBtn = notificationElement.querySelector('.accept-btn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                acceptBtn.disabled = true;
                acceptBtn.textContent = '...';
                acceptFriendRequest(notification.requestId, notification.fromUserId, notification.id, notificationElement);
            });
        }
    
        const declineBtn = notificationElement.querySelector('.decline-btn');
        if (declineBtn) {
            declineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                declineBtn.disabled = true;
                declineBtn.textContent = '...';
                rejectFriendRequest(notification.requestId, notification.id, notificationElement);
            });
        }
        
        if (notification.type !== 'friend_request') {
            notificationElement.style.cursor = 'pointer';
            notificationElement.addEventListener('click', () => {
                let url = '#';
                if (notification.postId) {
                    url = `../home/home.html?post=${notification.postId}`;
                } else if (notification.fromUserId) {
                    url = `../pages/user.html?uid=${notification.fromUserId}`;
                }
                window.location.href = url;
            });
        }
    
        notificationsContainer.appendChild(notificationElement);
    }

    // --- CÓDIGO ATUALIZADO ---
    // Função para ACEITAR pedido (lógica no cliente)
    async function acceptFriendRequest(requestId, fromUserId, notificationId, element) {
        try {
            if (!currentUser || !currentUserProfile) {
                throw new Error("Utilizador não autenticado ou perfil não carregado.");
            }
    
            const fromUserDoc = await db.collection('users').doc(fromUserId).get();
            if (!fromUserDoc.exists) {
                throw new Error("O utilizador que enviou o pedido não existe mais.");
            }
            const fromUserData = fromUserDoc.data();
    
            const batch = db.batch();
    
            // 1. Adiciona o remetente à lista de amigos do utilizador atual
            const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
            batch.set(currentUserFriendRef, {
                nickname: fromUserData.nickname || 'Usuário',
                photoURL: fromUserData.photoURL || null
            });
    
            // 2. Adiciona o utilizador atual à lista de amigos do remetente
            const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
            batch.set(fromUserFriendRef, {
                nickname: currentUserProfile.nickname || 'Usuário',
                photoURL: currentUserProfile.photoURL || null
            });
    
            // 3. APAGA o documento da solicitação de amizade
            const requestRef = db.collection('friendRequests').doc(requestId);
            batch.delete(requestRef);
    
            // 4. APAGA a notificação sobre este pedido
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
    
            await batch.commit();
            showToast("Amigo adicionado com sucesso!", "success");
    
        } catch (error) {
            console.error("Erro ao aceitar solicitação:", error);
            alert("Ocorreu um erro ao aceitar a solicitação: " + error.message);
            if (element) {
                const acceptBtn = element.querySelector('.accept-btn');
                if(acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = 'Aceitar'; }
            }
        }
    }

    // --- CÓDIGO ATUALIZADO ---
    // Função para RECUSAR pedido (lógica no cliente)
    async function rejectFriendRequest(requestId, notificationId, element) {
        try {
            const batch = db.batch();
    
            // 1. APAGA o documento da solicitação de amizade
            const requestRef = db.collection('friendRequests').doc(requestId);
            batch.delete(requestRef);
    
            // 2. APAGA a notificação sobre este pedido
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
            
            await batch.commit();
            showToast("Solicitação recusada.", "info");
    
        } catch (error) {
            console.error("Erro ao recusar solicitação:", error);
            alert("Ocorreu um erro ao recusar a solicitação: " + error.message);
            if (element) {
                const declineBtn = element.querySelector('.decline-btn');
                if(declineBtn) { declineBtn.disabled = false; declineBtn.textContent = 'Recusar'; }
            }
        }
    }

    // Marca as notificações como lidas ao carregar a página
    async function markNotificationsAsRead(userId) {
        const notificationsRef = db.collection('users').doc(userId).collection('notifications');
        const snapshot = await notificationsRef.where('read', '==', false).get();
        if (snapshot.empty) return;

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    }

    // Marca TODAS como lidas através do botão
    async function markAllAsRead() {
        if (!currentUser) return;
        const notificationsRef = db.collection('users').doc(currentUser.uid).collection('notifications');
        const snapshot = await notificationsRef.where('read', '==', false).get();
        if (snapshot.empty) {
            showToast("Todas as notificações já estão lidas.", "info");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
        showToast(`${snapshot.size} notificações marcadas como lidas.`, "success");
    }

    // Formata o tempo para exibição
    function formatTimestamp(date) {
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Agora mesmo';
        if (diff < 3600000) return `${Math.floor(diff/60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
        return `${Math.floor(diff/86400000)}d atrás`;
    }

    // Função auxiliar para mostrar alertas rápidos
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`; // Adicione classes CSS para 'success', 'error', 'info'
        toast.textContent = message;
        
        // Adiciona o toast ao container e remove após 3 segundos
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});