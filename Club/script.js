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

    // O seu código existente para o modal de criar grupo vai aqui...
    const createGroupBtn = document.getElementById('createGroupBtn');
    const createGroupModal = document.getElementById('createGroupModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', function() {
            createGroupModal.style.display = 'flex';
        });
    }
    
    if (closeModalBtns) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                createGroupModal.style.display = 'none';
            });
        });
    }
    
    // Fechar modal ao clicar fora dele
    window.addEventListener('click', function(event) {
        if (event.target === createGroupModal) {
            createGroupModal.style.display = 'none';
        }
    });
    
    // Prevenir envio do formulário (apenas para demonstração)
    const modalForm = document.querySelector('#createGroupModal .modal-form');
    if (modalForm) {
        modalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Grupo criado com sucesso!');
            createGroupModal.style.display = 'none';
        });
    }
});

  // Script para o modal de criar grupo
  document.addEventListener('DOMContentLoaded', function() {
    const createGroupBtn = document.getElementById('createGroupBtn');
    const createGroupModal = document.getElementById('createGroupModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    
    createGroupBtn.addEventListener('click', function() {
        createGroupModal.style.display = 'flex';
    });
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            createGroupModal.style.display = 'none';
        });
    });
    
    // Fechar modal ao clicar fora dele
    window.addEventListener('click', function(event) {
        if (event.target === createGroupModal) {
            createGroupModal.style.display = 'none';
        }
    });
    
    // Prevenir envio do formulário (apenas para demonstração)
    document.querySelector('.modal-form').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Grupo criado com sucesso!');
        createGroupModal.style.display = 'none';
    });
});
