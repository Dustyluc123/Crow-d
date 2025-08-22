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
    let currentUser = null;
    let userSettings = {}; // Objeto para guardar as configurações

    // Lógica de autenticação
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            // Define o link do perfil no menu
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            // Carrega as configurações do usuário do Firestore
            loadUserSettings(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    /**
     * Carrega as configurações do usuário do Firestore e atualiza a interface.
     */
    async function loadUserSettings(userId) {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (doc.exists) {
            const userData = doc.data();
            // Pega as configurações salvas ou define um padrão
            userSettings = userData.settings || {
                darkMode: false,
                profilePublic: true
            };
            updateUIFromSettings();
        }
    }

    /**
     * Atualiza os interruptores na tela com base nas configurações carregadas.
     */
    function updateUIFromSettings() {
        // Atualiza o toggle de Modo Escuro
        darkModeToggle.checked = userSettings.darkMode;
        // Aplica a classe dark-mode no body se necessário
        document.body.classList.toggle('dark-mode', userSettings.darkMode);
        // ADICIONE ESTA LINHA: Sincroniza o localStorage com a configuração do Firestore
        localStorage.setItem('darkMode', userSettings.darkMode);

        // Atualiza o toggle de Perfil Público
        profilePublicToggle.checked = userSettings.profilePublic;
    }

    /**
     * Salva uma configuração específica no Firestore.
     * @param {string} key - O nome da configuração (ex: 'darkMode').
     * @param {boolean} value - O valor da configuração (true ou false).
     */
    async function saveSetting(key, value) {
        if (!currentUser) return;

        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            // Atualiza o campo específico dentro do objeto 'settings'
            await userRef.set({
                settings: {
                    [key]: value
                }
            }, { merge: true }); // 'merge: true' garante que outras configurações não sejam apagadas

            console.log(`Configuração '${key}' salva com o valor '${value}'`);
        } catch (error) {
            console.error("Erro ao salvar configuração:", error);
            alert("Não foi possível salvar a alteração. Tente novamente.");
        }
    }

    // --- Event Listeners para os Toggles ---

    // Listener para o Modo Escuro
    darkModeToggle.addEventListener('change', function() {
        const isEnabled = this.checked;
        document.body.classList.toggle('dark-mode', isEnabled);
        saveSetting('darkMode', isEnabled);
        // ADICIONE ESTA LINHA: Atualiza o localStorage quando o usuário muda o toggle
        localStorage.setItem('darkMode', isEnabled);
    });

    // Listener para o Perfil Público
    profilePublicToggle.addEventListener('change', function() {
        const isPublic = this.checked;
        saveSetting('profilePublic', isPublic);
    });
});