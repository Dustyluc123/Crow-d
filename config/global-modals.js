// Ficheiro: Crow-d/config/global-modals.js

/**
 * Exibe um modal de confirmação (Sim/Não) e retorna uma promessa.
 * @param {string} title O título do modal.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} confirmText Texto para o botão de confirmação.
 * @param {string} cancelText Texto para o botão de cancelar.
 * @returns {Promise<boolean>} Resolve `true` se confirmado, `false` se cancelado.
 */
function showConfirmationModal(title, message, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        // Remove qualquer modal antigo para evitar duplicatas
        const oldModal = document.getElementById('dynamicConfirmationModal');
        if (oldModal) {
            oldModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'dynamicConfirmationModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-actions">
                    <button class="secondary-btn">${cancelText}</button>
                    <button class="primary-btn">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmBtn = modal.querySelector('.primary-btn');
        const cancelBtn = modal.querySelector('.secondary-btn');
        const closeBtn = modal.querySelector('.close-modal');

        const closeModal = (decision) => {
            modal.remove();
            resolve(decision);
        };

        confirmBtn.onclick = () => closeModal(true);
        cancelBtn.onclick = () => closeModal(false);
        closeBtn.onclick = () => closeModal(false);
    });
}

/**
 * Exibe um modal com um campo de texto (prompt) e retorna uma promessa.
 * @param {string} title O título do modal.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} inputType O tipo do input (ex: 'text', 'password').
 * @returns {Promise<string|null>} Resolve com o texto inserido, ou `null` se cancelado.
 */
function showPromptModal(title, message, inputType = 'text') {
     return new Promise((resolve) => {
        const oldModal = document.getElementById('dynamicPromptModal');
        if (oldModal) {
            oldModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'dynamicPromptModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                    <input type="${inputType}" id="promptInput" class="modal-input" />
                </div>
                <div class="modal-actions">
                    <button class="secondary-btn">Cancelar</button>
                    <button class="primary-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const confirmBtn = modal.querySelector('.primary-btn');
        const cancelBtn = modal.querySelector('.secondary-btn');
        const closeBtn = modal.querySelector('.close-modal');
        const input = modal.querySelector('#promptInput');
        
        input.focus();

        const closeModal = (value) => {
            modal.remove();
            resolve(value);
        };

        confirmBtn.onclick = () => closeModal(input.value);
        cancelBtn.onclick = () => closeModal(null);
        closeBtn.onclick = () => closeModal(null);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                closeModal(input.value);
            }
        });
    });
}