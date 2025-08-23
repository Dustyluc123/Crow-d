// Sistema de notificações para o Crow-d com Firebase
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

    const notificationsContainer = document.getElementById('notifications-container');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const logoutButton = document.getElementById('logout-btn');

    let currentUser = null;
    let currentUserProfile = null; // ADICIONADO: Para guardar os dados do perfil
    let notificationsListener = null;

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid); // ADICIONADO: Carregar perfil do usuário logado
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

    // NOVA FUNÇÃO: Carrega o perfil do usuário logado
    async function loadUserProfile(userId) {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = '../login/login.html'; });
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllAsRead(true));
    }

    function loadNotifications() {
        // ... (esta função não precisa de alterações)
        if (!notificationsContainer) return;
        notificationsContainer.innerHTML = '<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        if (notificationsListener) notificationsListener();
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

    // --- FUNÇÃO MODIFICADA ---
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

        // Se for um pedido de amizade, adiciona os botões
        if (notification.type === 'friend_request') {
            notificationHTML += `
                <div class="notification-item-actions">
                    <button class="notification-action-btn accept-btn" data-request-id="${notification.id}" data-from-id="${notification.fromUserId}">Aceitar</button>
                    <button class="notification-action-btn decline-btn" data-request-id="${notification.id}">Recusar</button>
                </div>
            `;
        }
        
        notificationHTML += `</div>`;
        notificationElement.innerHTML = notificationHTML;
        
        // Adiciona os event listeners aos botões se existirem
        const acceptBtn = notificationElement.querySelector('.accept-btn');
        const declineBtn = notificationElement.querySelector('.decline-btn');

        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                acceptFriendRequest(e.target.dataset.requestId, e.target.dataset.fromId);
            });
        }
        if (declineBtn) {
            declineBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                rejectFriendRequest(e.target.dataset.requestId);
            });
        }
        
        // Adiciona um clique geral para outros tipos de notificação
        if (notification.type !== 'friend_request' && notification.type !== 'group_invite') {
            notificationElement.style.cursor = 'pointer';
            notificationElement.addEventListener('click', () => {
                let url = `../home/home.html?post=${notification.postId}`;
                if (notification.type === 'follow' || notification.type === 'friend_accept') {
                    url = `../pages/user.html?uid=${notification.fromUserId}`;
                }
                window.location.href = url;
            });
        }

        notificationsContainer.appendChild(notificationElement);
    }
    
    // --- NOVAS FUNÇÕES (adaptadas de friends/scripts.js) ---
    async function acceptFriendRequest(notificationId, fromUserId) {
        try {
            const userDoc = await db.collection('users').doc(fromUserId).get();
            if (!userDoc.exists) return;
            
            const fromUserData = userDoc.data();
            const batch = db.batch();

            // Adiciona amigo em ambos os lados
            const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
            batch.set(currentUserFriendRef, {
                nickname: fromUserData.nickname || 'Usuário',
                photoURL: fromUserData.photoURL || null,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
            batch.set(fromUserFriendRef, {
                nickname: currentUserProfile.nickname || 'Usuário',
                photoURL: currentUserProfile.photoURL || null,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Deleta a notificação de pedido
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
            
            // Cria uma nova notificação para o outro usuário a informar que o pedido foi aceite
            const newNotificationRef = db.collection('users').doc(fromUserId).collection('notifications').doc();
            batch.set(newNotificationRef, {
                type: 'friend_accept',
                fromUserId: currentUser.uid,
                fromUserName: currentUserProfile.nickname || 'Usuário',
                fromUserPhoto: currentUserProfile.photoURL || null,
                content: 'aceitou a sua solicitação de amizade.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            await batch.commit();

        } catch (error) {
            console.error("Erro ao aceitar solicitação:", error);
            alert("Ocorreu um erro ao aceitar a solicitação.");
        }
    }

    async function rejectFriendRequest(notificationId) {
        try {
            // Apenas apaga a notificação
            await db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId).delete();
        } catch (error) {
            console.error("Erro ao recusar solicitação:", error);
        }
    }

    async function markNotificationsAsRead(userId) {
        // ... (função sem alterações)
        const notificationsRef = db.collection('users').doc(userId).collection('notifications');
        const snapshot = await notificationsRef.where('read', '==', false).get();
        if (snapshot.empty) return;
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    }

    async function markAllAsRead(force = false) {
        // ... (função sem alterações)
        if (!force || !currentUser) return;
        const notificationsRef = db.collection('users').doc(currentUser.uid).collection('notifications');
        const snapshot = await notificationsRef.where('read', '==', false).get();
        if (snapshot.empty) {
            alert("Todas as notificações já estão lidas.");
            return;
        }
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
        alert(`${snapshot.size} notificações marcadas como lidas.`);
    }

    function formatTimestamp(date) {
        // ... (função sem alterações)
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Agora mesmo';
        if (diff < 3600000) return `${Math.floor(diff/60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
        return `${Math.floor(diff/86400000)}d atrás`;
    }
});