// CONTEÚDO COMPLETO PARA O ARQUIVO: config.js

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
    
    // --- Referências para Exclusão de Conta ---
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteAccountModal = document.getElementById('deleteAccountModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    // Junta os dois botões de cancelar em uma única lista
    const cancelDeleteBtns = document.querySelectorAll('.close-modal, .secondary-btn');


    let currentUser = null;
    let userSettings = {}; 

    // Lógica de autenticação
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            loadUserSettings(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    async function loadUserSettings(userId) {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            const defaultSettings = { darkMode: false, profilePublic: true };
            userSettings = { ...defaultSettings, ...userData.settings };
            
            // Sincroniza as configurações para garantir que estão salvas
            await userRef.set({ settings: userSettings }, { merge: true });

            updateUIFromSettings();
        }
    }

    function updateUIFromSettings() {
        if(darkModeToggle) {
            darkModeToggle.checked = userSettings.darkMode;
            document.body.classList.toggle('dark-mode', userSettings.darkMode);
            localStorage.setItem('darkMode', userSettings.darkMode);
        }
        if(profilePublicToggle) {
            profilePublicToggle.checked = userSettings.profilePublic;
        }
    }

    async function saveSetting(key, value) {
        if (!currentUser) return;
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.set({
                settings: { [key]: value }
            }, { merge: true });
            console.log(`Configuração '${key}' salva.`);
        } catch (error) {
            console.error("Erro ao salvar configuração:", error);
            alert("Não foi possível salvar a alteração.");
        }
    }

    // --- Event Listeners para os Toggles ---
    if(darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            const isEnabled = this.checked;
            document.body.classList.toggle('dark-mode', isEnabled);
            localStorage.setItem('darkMode', isEnabled);
            saveSetting('darkMode', isEnabled);
        });
    }

    if(profilePublicToggle) {
        profilePublicToggle.addEventListener('change', function() {
            const isPublic = this.checked;
            saveSetting('profilePublic', isPublic);
        });
    }

    // --- LÓGICA DE EXCLUSÃO DE CONTA ---
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
        if (!currentUser) {
            alert("Nenhum usuário logado.");
            return;
        }

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';

        try {
            await currentUser.delete();
            alert("Sua conta foi excluída com sucesso. Sentiremos sua falta!");
            window.location.href = '../login/login.html';
        } catch (error) {
            console.error("Erro ao excluir conta:", error);
            if (error.code === 'auth/requires-recent-login') {
                alert("Por segurança, esta é uma operação sensível e requer que você tenha feito login recentemente. Por favor, saia e entre novamente na sua conta antes de tentar excluir.");
            } else {
                alert("Ocorreu um erro ao excluir sua conta: " + error.message);
            }
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Excluir Conta';
            if(deleteAccountModal) deleteAccountModal.style.display = 'none';
        }
    }
});