document.addEventListener('DOMContentLoaded', function() {
    // Seleção de tema
    const themeOptions = document.querySelectorAll('.theme-option');
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remover classe active de todas as opções
            themeOptions.forEach(opt => opt.classList.remove('active'));
            
            // Adicionar classe active à opção selecionada
            this.classList.add('active');
            
            // Salvar tema selecionado
            const theme = this.getAttribute('data-theme');
            localStorage.setItem('theme', theme);
            
            // Aplicar tema (apenas para demonstração)
            if (theme === 'dark') {
                darkModeToggle.checked = true;
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'true');
            } else if (theme === 'light') {
                darkModeToggle.checked = false;
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'false');
            }
            
            // Outros temas poderiam ter implementações específicas
        });
    });
    
    // Botão salvar (apenas para demonstração)
    document.querySelector('.config-btn:not(.secondary)').addEventListener('click', function() {
        alert('Configurações salvas com sucesso!');
    });
});
auth.onAuthStateChanged(async function(user) {
    if (user) {
        // Usuário está logado
        currentUser = user;

        // ==========================================================
        //      INÍCIO DA LÓGICA ADICIONADA
        // ==========================================================
        
        // Encontra o botão/link de perfil no header pela sua classe
        const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink) {
            // Define o link para a página do utilizador logado (user.html) com o UID correto
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }

        // ==========================================================
        //      FIM DA LÓGICA ADICIONADA
        // ==========================================================
        
        // Carregar perfil do usuário
        await loadUserProfile(user.uid);
        
        // Carregar amigos, solicitações e sugestões
        loadFriendRequests();
        loadFriends();
        loadSuggestions();
    } else {
        // Usuário não está logado, redirecionar para login
        window.location.href = '../login/login.html';
    }
    function setupNotificationListener(userId) {
    const notificationsRef = db.collection('users').doc(userId).collection('notifications');

    // Escuta por qualquer alteração em notificações onde 'read' é 'false'
    notificationsRef.where('read', '==', false).onSnapshot(snapshot => {
        const unreadCount = snapshot.size; // Pega a quantidade de docs não lidos
        const badge = document.getElementById('notification-badge');

        if (badge) {
            // Se houver mais de 0 notificações não lidas, mostra a bolinha. Senão, esconde.
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    });
}
});