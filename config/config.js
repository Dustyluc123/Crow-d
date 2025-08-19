
// --- INÍCIO DO BLOCO DE CÓDIGO UNIVERSAL ---

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

    // Lógica de autenticação
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // Encontra o link do perfil no menu de navegação
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                // Define o 'href' com o ID do utilizador logado
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
        } else {
            // Se não estiver logado, redireciona para a página de login
            window.location.href = '../login/login.html';
        }
    });
    
    // O seu código existente para as configurações vai aqui...
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        // Lógica para o dark mode...
    }
});
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
