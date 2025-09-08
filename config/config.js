// CONTEÚDO COMPLETO E CORRIGIDO PARA O ARQUIVO: config.js

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

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- Referências aos elementos do DOM ---
    const darkModeToggle = document.getElementById('darkModeToggle');
    const profilePublicToggle = document.getElementById('profilePublicToggle');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteAccountModal = document.getElementById('deleteAccountModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtns = document.querySelectorAll('.close-modal, .secondary-btn');

    let currentUser = null;
    let userSettings = {};

    // --- PASSO 1: APLICAÇÃO IMEDIATA A PARTIR DO LOCALSTORAGE ---
    // Sincroniza o botão de toggle com o localStorage assim que ele estiver disponível.
    // Isso é rápido e evita a espera pelo Firebase, resolvendo o atraso do botão.
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (darkModeToggle) {
        darkModeToggle.checked = savedDarkMode;
    }
    // A classe no body já deve ter sido aplicada pelo script no <head>, mas garantimos aqui também.
    document.body.classList.toggle('dark-mode', savedDarkMode);

    // --- PASSO 2: AUTENTICAÇÃO E SINCRONIZAÇÃO COM FIREBASE ---
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            // Carrega as configurações do Firebase em segundo plano para garantir que tudo esteja sincronizado
            loadAndSyncUserSettings(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    async function loadAndSyncUserSettings(userId) {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            const defaultSettings = { darkMode: false, profilePublic: true };
            userSettings = { ...defaultSettings, ...userData.settings };

            // Sincroniza o localStorage e a UI com o que veio do Firebase,
            // caso haja alguma diferença (ex: usuário mudou em outro dispositivo).
            if (userSettings.darkMode !== (localStorage.getItem('darkMode') === 'true')) {
                 localStorage.setItem('darkMode', userSettings.darkMode);
                 document.body.classList.toggle('dark-mode', userSettings.darkMode);
                 if (darkModeToggle) {
                     darkModeToggle.checked = userSettings.darkMode;
                 }
            }
            // Atualiza o resto das configurações da página
            if(profilePublicToggle) {
                profilePublicToggle.checked = userSettings.profilePublic;
            }
        }
    }
    
    // Função para salvar uma configuração específica no Firestore
    async function saveSetting(key, value) {
        if (!currentUser) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.set({
                settings: { [key]: value }
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao salvar configuração:", error);
        }
    }

    // --- Listeners para os Toggles ---
    if(darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            const isEnabled = this.checked;
            document.body.classList.toggle('dark-mode', isEnabled);
            localStorage.setItem('darkMode', isEnabled); // Salva localmente (rápido)
            saveSetting('darkMode', isEnabled); // Salva no Firebase (em segundo plano)
        });
    }

    if(profilePublicToggle) {
        profilePublicToggle.addEventListener('change', function() {
            const isPublic = this.checked;
            saveSetting('profilePublic', isPublic);
        });
    }

    // --- Lógica de Exclusão de Conta ---
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            if(deleteAccountModal) deleteAccountModal.style.display = 'flex';
        });
    }

    cancelDeleteBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                if(deleteAccountModal) deleteAccountModal.style.display = 'none';
            });
        }
    });

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', deleteAccount);
    }

    async function deleteAccount() {
        if (!currentUser) return;
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        try {
            await currentUser.delete();
            alert("Sua conta foi excluída com sucesso.");
            window.location.href = '../login/login.html';
        } catch (error) {
            console.error("Erro ao excluir conta:", error);
            alert("Ocorreu um erro ao excluir sua conta: " + error.message);
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Excluir Conta';
            if(deleteAccountModal) deleteAccountModal.style.display = 'none';
        }
    }
});