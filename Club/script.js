

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
});


//djflksajfkjdsakfsa

//kdjsfçljskdajfkd

//lkfdsjçkfjdsajkds

//kdsljlfjskdljfçasjdf

//tsjçllsçjdçjf