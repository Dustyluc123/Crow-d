// Script para gerenciar o modo escuro global
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se já existe uma preferência salva
    const darkMode = localStorage.getItem('darkMode') === 'true';
    
    // Aplicar modo escuro se estiver salvo
    if (darkMode) {
        document.body.classList.add('dark-mode');
        
        // Se estiver na página de configurações, marcar o toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.checked = true;
        }
    }
    
    // Adicionar listener ao toggle na página de configurações
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            toggleDarkMode(this.checked);
        });
    }
    
    // Função para alternar o modo escuro
    function toggleDarkMode(enable) {
        if (enable) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    }
});
