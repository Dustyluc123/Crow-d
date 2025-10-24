document.addEventListener('DOMContentLoaded', () => {
    // Inicialize o Firebase (assumindo que global.js faz isso)
    const db = firebase.firestore();
    const auth = firebase.auth();

    const reportForm = document.getElementById('report-form');
    const submitBtn = document.getElementById('submit-report-btn');
    const reportedItemIdInput = document.getElementById('reported-item-id');
    const reportedItemTypeInput = document.getElementById('reported-item-type');

    let reportedItemId = null;
    let reportedItemType = null;

    // --- Passo 1: Obter o ID e o Tipo da URL ---
    // Isso é crucial. O link para esta página DEVE ter parâmetros
    // Ex: denuncia.html?type=post&id=abc12345
    // ----------------------------------------------------
    try {
        const urlParams = new URLSearchParams(window.location.search);
        reportedItemId = urlParams.get('id');
        reportedItemType = urlParams.get('type');

        if (!reportedItemId || !reportedItemType) {
            throw new Error('Informação do item a ser denunciado não encontrada.');
        }

        // Preenche os campos ocultos (opcional, mas bom para debug)
        reportedItemIdInput.value = reportedItemId;
        reportedItemTypeInput.value = reportedItemType;

    } catch (error) {
        console.error("Erro ao ler parâmetros da URL:", error);
        showToast("Erro: Não foi possível identificar o item a ser denunciado.", "error");
        if (submitBtn) submitBtn.disabled = true;
    }


    // --- Passo 2: Lidar com o envio do formulário ---
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!submitBtn.disabled) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
            }

            const currentUser = auth.currentUser;
            if (!currentUser) {
                showToast("Você precisa estar logado para fazer uma denúncia.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Denúncia';
                return;
            }

            try {
                // Obter os valores do formulário
                const reason = reportForm['report-reason'].value;
                const details = reportForm['report-details'].value.trim();

                if (!reason) {
                    showToast("Por favor, selecione um motivo.", "error");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Denúncia';
                    return;
                }

                // --- Passo 3: Salvar no Firebase ---
                // Vamos criar uma nova coleção "reports"
                await db.collection('reports').add({
                    reporterUid: currentUser.uid,       // Quem denunciou
                    reportedItemType: reportedItemType, // 'post', 'comment', ou 'user'
                    reportedItemId: reportedItemId,     // ID do post, comentário ou usuário
                    reason: reason,                     // Motivo selecionado
                    details: details,                   // Detalhes adicionais
                    status: 'pending',                  // Status inicial
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Sucesso!
                showToast("Denúncia enviada com sucesso. Obrigado por ajudar!", "success");
                
                // Redireciona de volta após 2 segundos
                setTimeout(() => {
                    window.history.back(); // Volta para a página anterior
                }, 2000);

            } catch (error) {
                console.error("Erro ao enviar denúncia:", error);
                // ESTE É O ERRO QUE VOCÊ ESTAVA VENDO!
                showToast("Não foi possível enviar sua denúncia. Tente novamente.", "error");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Denúncia';
            }
        });
    }
});