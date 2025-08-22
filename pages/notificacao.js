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
    let notificationsListener = null;

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
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

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = '../login/login.html'; });
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllAsRead(true));
    }

    // Função para carregar notificações
    function loadNotifications() {
        if (!notificationsContainer) return;

        notificationsContainer.innerHTML = '<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        if (notificationsListener) {
            notificationsListener();
        }
        
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

    // Adiciona uma notificação ao DOM (MODIFICADA)
    function addNotificationToDOM(notification) {
        const notificationElement = document.createElement('div'); // Alterado de 'a' para 'div'
        notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;
        
        const userPhoto = notification.fromUserPhoto || '../img/Design sem nome2.png';
        const timestamp = notification.timestamp ? formatTimestamp(notification.timestamp.toDate()) : '';

        // Constrói o HTML base da notificação
        let notificationHTML = `
            <img src="${userPhoto}" alt="Avatar" class="notification-avatar">
            <div class="notification-content">
                <p class="notification-text"><strong>${notification.fromUserName}</strong> ${notification.content || ''}</p>
                <span class="notification-time">${timestamp}</span>
        `;

        // Se for um convite de grupo, adiciona os botões
        if (notification.type === 'group_invite') {
            notificationHTML += `
                <div class="notification-item-actions">
                    <button class="notification-action-btn accept-btn" data-group-id="${notification.groupId}" data-notification-id="${notification.id}">Aceitar</button>
                    <button class="notification-action-btn decline-btn" data-notification-id="${notification.id}">Recusar</button>
                </div>
            `;
        }
        
        notificationHTML += `</div>`; // Fecha notification-content
        notificationElement.innerHTML = notificationHTML;
        
        // Adiciona os event listeners aos botões se existirem
        const acceptBtn = notificationElement.querySelector('.accept-btn');
        const declineBtn = notificationElement.querySelector('.decline-btn');

        if (acceptBtn) {
            acceptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                acceptGroupInvite(e.target.dataset.groupId, e.target.dataset.notificationId);
            });
        }
        if (declineBtn) {
            declineBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                declineGroupInvite(e.target.dataset.notificationId);
            });
        }
        
        // Adiciona um clique geral para outros tipos de notificação
        if (notification.type !== 'group_invite') {
            notificationElement.style.cursor = 'pointer';
            notificationElement.addEventListener('click', () => {
                let url = '#';
                if (notification.type === 'follow') {
                    url = `../pages/user.html?uid=${notification.fromUserId}`;
                } else {
                    url = `../home/home.html?post=${notification.postId}`;
                }
                window.location.href = url;
            });
        }

        notificationsContainer.appendChild(notificationElement);
    }

    // --- NOVAS FUNÇÕES ---

    // Função para aceitar um convite de grupo
    async function acceptGroupInvite(groupId, notificationId) {
        if (!currentUser) return;

        const groupRef = db.collection('groups').doc(groupId);
        try {
            // Adiciona o usuário ao array de membros do grupo
            await groupRef.update({
                members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });

            // Deleta a notificação após aceitar
            await db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId).delete();
            
            alert("Você entrou no grupo com sucesso!");
            
        } catch (error) {
            console.error("Erro ao aceitar convite:", error);
            alert("Não foi possível entrar no grupo. Ele pode ter sido excluído.");
        }
    }

    // Função para recusar um convite de grupo (apenas deleta a notificação)
    async function declineGroupInvite(notificationId) {
        if (!currentUser) return;
        try {
            await db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId).delete();
        } catch (error) {
            console.error("Erro ao recusar convite:", error);
        }
    }
    
    // --- FUNÇÕES EXISTENTES ---

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

    async function markAllAsRead(force = false) {
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
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Agora mesmo';
        if (diff < 3600000) return `${Math.floor(diff/60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
        return `${Math.floor(diff/86400000)}d atrás`;
    }
});