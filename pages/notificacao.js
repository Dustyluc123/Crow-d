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
    let currentUserProfile = null;
    let notificationsListener = null;

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
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

    async function loadUserProfile(userId) {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        } else {
            console.error("Perfil do usuário logado não encontrado!");
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = '../login/login.html'; });
        });
    }

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllAsRead());
    }

    function loadNotifications() {
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
        } else if (notification.type === 'group_invite' && notification.groupId) { // <-- ADIÇÃO DA NOVA LÓGICA
            notificationHTML += `
                <div class="notification-item-actions">
                    <button class="notification-action-btn accept-group-btn">Aceitar</button>
                    <button class="notification-action-btn decline-group-btn">Recusar</button>
                </div>
            `;
        }
        
        notificationHTML += `</div>`;
        notificationElement.innerHTML = notificationHTML;
        
        // Listeners para solicitação de amizade
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

        // --- INÍCIO DO NOVO BLOCO DE LISTENERS PARA CONVITES DE GRUPO ---
        const acceptGroupBtn = notificationElement.querySelector('.accept-group-btn');
        if (acceptGroupBtn) {
            acceptGroupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                acceptGroupBtn.disabled = true;
                acceptGroupBtn.textContent = '...';
                acceptGroupInvite(notification); // Passa a notificação inteira
            });
        }

        const declineGroupBtn = notificationElement.querySelector('.decline-group-btn');
        if (declineGroupBtn) {
            declineGroupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                declineGroupBtn.disabled = true;
                declineGroupBtn.textContent = '...';
                rejectGroupInvite(notification); // Passa a notificação inteira
            });
        }
        // --- FIM DO NOVO BLOCO ---
        
        if (notification.type !== 'friend_request' && notification.type !== 'group_invite') {
            notificationElement.style.cursor = 'pointer';
            notificationElement.addEventListener('click', () => {
                let url = '#';
                if (notification.postId) {
                    url = `../home/home.html?post=${notification.postId}`;
                } else if (notification.groupId) { // Adicionado para levar ao grupo
                    url = `../Club/grupos.html`;
                } else if (notification.fromUserId) {
                    url = `../pages/user.html?uid=${notification.fromUserId}`;
                }
                window.location.href = url;
            });
        }
    
        notificationsContainer.appendChild(notificationElement);
    }

    async function acceptFriendRequest(requestId, fromUserId, notificationId, element) {
        try {
            if (!currentUser || !currentUserProfile) throw new Error("Usuário não autenticado.");

            const fromUserDoc = await db.collection('users').doc(fromUserId).get();
            if (!fromUserDoc.exists) throw new Error("O usuário que enviou o pedido não existe mais.");
            const fromUserData = fromUserDoc.data();

            const batch = db.batch();
            const currentUserFriendRef = db.collection('users').doc(currentUser.uid).collection('friends').doc(fromUserId);
            batch.set(currentUserFriendRef, { nickname: fromUserData.nickname || 'Usuário', photoURL: fromUserData.photoURL || null });
            const fromUserFriendRef = db.collection('users').doc(fromUserId).collection('friends').doc(currentUser.uid);
            batch.set(fromUserFriendRef, { nickname: currentUserProfile.nickname || 'Usuário', photoURL: currentUserProfile.photoURL || null });

            const acceptanceNotificationRef = db.collection("users").doc(fromUserId).collection("notifications").doc();
            batch.set(acceptanceNotificationRef, {
                type: 'friend_accept',
                fromUserId: currentUser.uid,
                fromUserName: currentUserProfile.nickname || 'Usuário',
                fromUserPhoto: currentUserProfile.photoURL || null,
                content: 'aceitou sua solicitação de amizade.',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });
            
            const requestRef = db.collection('friendRequests').doc(requestId);
            batch.delete(requestRef);

            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
            
            await batch.commit();
            showToast("Amigo adicionado com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao aceitar solicitação:", error);
            alert("Ocorreu um erro: " + error.message);
            if (element) {
                const acceptBtn = element.querySelector('.accept-btn');
                if(acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = 'Aceitar'; }
            }
        }
    }

    async function rejectFriendRequest(requestId, notificationId, element) {
        try {
            const batch = db.batch();
            const requestRef = db.collection('friendRequests').doc(requestId);
            batch.delete(requestRef);

            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notificationId);
            batch.delete(notificationRef);
            
            await batch.commit();
            showToast("Solicitação recusada.", "info");

        } catch (error) {
            console.error("Erro ao recusar solicitação:", error);
            alert("Ocorreu um erro: " + error.message);
             if (element) {
                const declineBtn = element.querySelector('.decline-btn');
                if(declineBtn) { declineBtn.disabled = false; declineBtn.textContent = 'Recusar'; }
            }
        }
    }

    // --- INÍCIO DAS NOVAS FUNÇÕES PARA CONVITES DE GRUPO ---
    async function acceptGroupInvite(notification) {
        try {
            const groupRef = db.collection('groups').doc(notification.groupId);
            const notificationRef = db.collection('users').doc(currentUser.uid).collection('notifications').doc(notification.id);

            const batch = db.batch();

            // Adiciona o usuário ao array de membros do grupo
            batch.update(groupRef, {
                members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });

            // Deleta a notificação de convite
            batch.delete(notificationRef);

            await batch.commit();
            showToast(`Você entrou no grupo "${notification.groupName}"!`, "success");
            // Redireciona para a página de grupos para ver o novo grupo
            setTimeout(() => {
                window.location.href = '../Club/grupos.html';
            }, 1500);

        } catch (error) {
            console.error("Erro ao aceitar convite de grupo:", error);
            showToast("Ocorreu um erro ao entrar no grupo.", "error");
        }
    }

    async function rejectGroupInvite(notification) {
        try {
            // Apenas apaga a notificação
            await db.collection('users').doc(currentUser.uid).collection('notifications').doc(notification.id).delete();
            showToast("Convite recusado.", "info");
        } catch (error) {
            console.error("Erro ao recusar convite de grupo:", error);
            showToast("Ocorreu um erro ao recusar o convite.", "error");
        }
    }
    // --- FIM DAS NOVAS FUNÇÕES ---

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