// Ficheiro: Crow-d/config/global.js

document.addEventListener('DOMContentLoaded', function() {
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

    /**
     * Atualiza o atributo href de todos os links de perfil na página.
     * @param {string} uid - O ID do utilizador autenticado.
     */
    function updateUserProfileLinks(uid) {
        // Seleciona TODOS os elementos com a classe .profile-link
        const profileLinks = document.querySelectorAll('.profile-link');
        
        profileLinks.forEach(link => {
            if (uid) {
                link.href = `../pages/user.html?uid=${uid}`;
            } else {
                // Se não houver utilizador, aponta para a página de login como fallback
                link.href = '../login/login.html';
            }
        });
    }

    /**
     * Fica "escutando" por notificações não lidas em tempo real.
     * @param {string} userId - O ID do utilizador.
     */
    function setupNotificationListener(userId) {
        const notificationsRef = db.collection('users').doc(userId).collection('notifications');
        
        notificationsRef.where('read', '==', false).onSnapshot(snapshot => {
            const unreadCount = snapshot.size;
            const badge = document.getElementById('header-notification-badge');

            if (badge) {
                badge.style.display = unreadCount > 0 ? 'block' : 'none';
            }
        });
    }

    // Ponto central de autenticação
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // Se o utilizador estiver logado, atualiza os links e inicia o listener
            updateUserProfileLinks(user.uid);
            setupNotificationListener(user.uid);
        } else {
            // Se não houver utilizador, garante que os links não fiquem quebrados
            updateUserProfileLinks(null);
            console.log("Nenhum utilizador logado.");
        }
    });
    // Adicione este código ao final do ficheiro: Crow-d/config/global.js

document.addEventListener('DOMContentLoaded', function() {
    // ... (o código existente do global.js fica aqui) ...

    // --- NOVA LÓGICA PARA O MENU MOBILE ---
    const leftSidebarToggle = document.getElementById('left-sidebar-toggle');
    const leftSidebar = document.querySelector('.sidebar.left-sidebar'); // Seleciona a sidebar pela classe

    if (leftSidebarToggle && leftSidebar) {
        leftSidebarToggle.addEventListener('click', () => {
            // A classe 'active' fará a sidebar aparecer
            leftSidebar.classList.toggle('active'); 
        });

        // Opcional: Fechar a sidebar se clicar fora dela
        document.addEventListener('click', function(event) {
            const isClickInsideSidebar = leftSidebar.contains(event.target);
            const isClickOnToggleButton = leftSidebarToggle.contains(event.target);

            if (!isClickInsideSidebar && !isClickOnToggleButton && leftSidebar.classList.contains('active')) {
                leftSidebar.classList.remove('active');
            }
        });
    }
});
// config/global.js
document.addEventListener('DOMContentLoaded', () => {
    const leftSidebarToggle = document.getElementById('left-sidebar-toggle');
    const leftSidebar = document.querySelector('.left-sidebar');

    if (leftSidebarToggle && leftSidebar) {
        leftSidebarToggle.addEventListener('click', () => {
            leftSidebar.classList.toggle('active');
        });
    }

    // Adiciona funcionalidade para fechar a sidebar se clicar fora dela (opcional, mas recomendado)
    document.addEventListener('click', (event) => {
        if (leftSidebar && leftSidebar.classList.contains('active')) {
            const isClickInsideSidebar = leftSidebar.contains(event.target);
            const isClickOnToggleButton = leftSidebarToggle.contains(event.target);

            if (!isClickInsideSidebar && !isClickOnToggleButton) {
                leftSidebar.classList.remove('active');
            }
        }
    });
});
});