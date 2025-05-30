

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

//djflksajfkjdsakfsa

//kdjsfçljskdajfkd

//lkfdsjçkfjdsajkds

//kdsljlfjskdljfçasjdf

//tsjçllsçjdçjf