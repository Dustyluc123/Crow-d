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

    // ==========================================================
    //      INÍCIO DA CORREÇÃO
    // ==========================================================
    
    // CORREÇÃO: A variável agora busca pelo ID correto 'notifications-container'
    const notificationsContainer = document.getElementById('notifications-container');
    
    // ==========================================================
    //       FIM DA CORREÇÃO
    // ==========================================================

    const notificationFilters = document.querySelectorAll('.notification-filter');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const logoutButton = document.getElementById('logout-btn');

    // Variáveis globais
    let currentUser = null;
    let currentUserProfile = null;
    let notificationsListener = null;
    let currentFilter = 'all';

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
          const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink) {
            // Define o link para a página do utilizador logado (user.html) com o UID correto
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            loadNotifications(currentFilter); // Carrega as notificações
            markNotificationsAsRead(user.uid); // Marca as não lidas como lidas ao entrar
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // Event listener para o botão de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = '../login/login.html';
            });
        });
    }

    // Event listener para o botão de marcar todas como lidas
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllAsRead(true)); // Passa 'true' para forçar a marcação
    }

    // Função para carregar o perfil do usuário
    async function loadUserProfile(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        } else {
            console.log('Perfil do usuário não encontrado.');
            // window.location.href = '../profile/profile.html'; // Desativado para evitar redirects
        }
    }

    // Função para carregar notificações
    function loadNotifications(filter) {
        if (!notificationsContainer) return; // Checagem de segurança

        notificationsContainer.innerHTML = '<div class="notification-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        if (notificationsListener) {
            notificationsListener();
        }
        
        let query = db.collection('users').doc(currentUser.uid)
            .collection('notifications')
            .orderBy('timestamp', 'desc')
            .limit(50);
        
        notificationsListener = query.onSnapshot(snapshot => {
            notificationsContainer.innerHTML = ''; // Limpa o container
            
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

    // Função para adicionar uma notificação ao DOM
    function addNotificationToDOM(notification) {
        const notificationElement = document.createElement('a'); // Usar 'a' para ser clicável
        notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;
        
        // Define o link baseado no tipo de notificação
        if (notification.type === 'follow') {
            notificationElement.href = `../pages/user.html?uid=${notification.fromUserId}`;
        } else {
            notificationElement.href = `../home/home.html?post=${notification.postId}`;
        }
        
        const userPhoto = notification.fromUserPhoto || '../img/Design sem nome2.png';
        const timestamp = notification.timestamp ? formatTimestamp(notification.timestamp.toDate()) : '';

        notificationElement.innerHTML = `
            <img src="${userPhoto}" alt="Avatar" class="notification-avatar">
            <div class="notification-content">
                <p class="notification-text"><strong>${notification.fromUserName}</strong> ${notification.content || ''}</p>
                <span class="notification-time">${timestamp}</span>
            </div>
        `;
        
        notificationsContainer.appendChild(notificationElement);
    }
    
    // Função para marcar notificações como lidas ao carregar a página
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

    // Função para marcar TODAS como lidas via botão
    async function markAllAsRead(force = false) {
        if (!force) return;

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

    // Função para formatar timestamp
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