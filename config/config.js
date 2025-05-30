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
