// Ficheiro: Crow-d/config/global-notifications.js

/**
 * Exibe uma notificação "toast" no canto da tela.
 * @param {string} message A mensagem a ser exibida.
 * @param {string} type O tipo de toast ('info', 'success', 'error').
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-exclamation-circle';

    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/**
 * Exibe um modal de alerta customizado no centro da tela.
 * @param {string} message A mensagem a ser exibida no corpo do modal.
 * @param {string} title O título do modal (opcional).
 */
function showCustomAlert(message, title = "Aviso") {
    let modal = document.getElementById('customAlertModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customAlertModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="customAlertTitle"></h2>
                    <button class="close-modal" id="customAlertCloseBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <p id="customAlertMessage"></p>
                </div>
                <div class="modal-actions">
                    <button class="primary-btn" id="customAlertOkBtn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const modalTitle = modal.querySelector('#customAlertTitle');
    const modalMessage = modal.querySelector('#customAlertMessage');
    const closeBtn = modal.querySelector('#customAlertCloseBtn');
    const okBtn = modal.querySelector('#customAlertOkBtn');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = 'flex';

    function closeModal() {
        modal.style.display = 'none';
    }

    closeBtn.onclick = closeModal;
    okBtn.onclick = closeModal;

    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    };
}