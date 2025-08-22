// Script para a página de criação de perfil (profile.js)

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

    // Inicializar Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const functions = firebase.functions(); // Inicializa o Firebase Functions

    // Referências aos elementos do DOM
    const profileForm = document.getElementById('profileForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoFileInput = document.getElementById('photoFile'); // Novo
    const customHobbyInput = document.getElementById('customHobby');
    const addCustomHobbyBtn = document.getElementById('addCustomHobby');
    const customHobbiesList = document.getElementById('customHobbiesList');
    
    // Variáveis globais
    let currentUser = null;
    let savingProfile = false;
    let photoBase64 = null; // Variável para armazenar a foto em Base64

    // Em profile.js, adicione este bloco após as "Variáveis globais"

// --- LÓGICA PARA O BOTÃO "VER MAIS" DOS HOBBIES ---
document.querySelectorAll('.see-more-btn').forEach(button => {
    button.addEventListener('click', function() {
        // Encontra o alvo (a div de hobbies escondidos) usando o atributo data-target
        const targetId = this.dataset.target;
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            // Alterna a classe 'visible' para mostrar ou esconder os hobbies
            targetElement.classList.toggle('visible');

            // Muda o texto do botão
            if (targetElement.classList.contains('visible')) {
                this.textContent = 'Ver menos';
            } else {
                this.textContent = 'Ver mais';
            }
        }
    });
});
// --- FIM DA LÓGICA DO BOTÃO ---

    // Verificar se o usuário está autenticado
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            // Verifica se o usuário já tem um perfil para não criar outro
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    // Se o perfil já existe, redireciona para a home
                    console.log("Perfil já existe. Redirecionando...");
                    window.location.href = '../home/home.html';
                }
            });
        } else {
            alert('Você precisa estar logado para criar um perfil.');
            window.location.href = '../login/login.html';
        }
    });
    
    // --- LÓGICA DE UPLOAD EM BASE64 ---
    photoFileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // O resultado é o texto em Base64
                photoBase64 = e.target.result;
                // Atualiza a imagem de preview na tela
                photoPreview.src = photoBase64;
            };
            reader.readAsDataURL(file); // Converte o arquivo para Base64
        }
    });
    
    // Event listener para adicionar hobby personalizado
    addCustomHobbyBtn.addEventListener('click', addCustomHobby);
    customHobbyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomHobby();
        }
    });
    
    // Event delegation para remover hobbies personalizados
    customHobbiesList.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-hobby') || e.target.parentElement.classList.contains('remove-hobby')) {
            e.target.closest('.hobby-tag')?.remove();
        }
    });
    
    // Event listener para salvar o formulário
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentUser) return alert('Você precisa estar logado.');
        if (savingProfile) return;
        
        saveProfileData(currentUser.uid);
    });
    
    // Função para adicionar hobby personalizado
    function addCustomHobby() {
        const hobbyText = customHobbyInput.value.trim();
        if (hobbyText) {
            const hobbyTag = document.createElement('span');
            hobbyTag.className = 'hobby-tag';
            hobbyTag.innerHTML = `${hobbyText} <i class="fas fa-times remove-hobby"></i>`;
            customHobbiesList.appendChild(hobbyTag);
            customHobbyInput.value = '';
        }
    }
    
    // Função para coletar hobbies personalizados do DOM
    function getCustomHobbies() {
        return Array.from(customHobbiesList.querySelectorAll('.hobby-tag'))
            .map(tag => tag.textContent.trim());
    }
// Em profile.js, substitua a função saveProfileData por esta

async function saveProfileData(userId) {
    savingProfile = true;
    const saveButton = profileForm.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const nickname = document.getElementById('nickname').value.trim();
        if (!nickname) throw new Error("O apelido é obrigatório.");

        // --- VERIFICAÇÃO DE APELIDO ÚNICO (LÓGICA ANTIGA) ---
        const nicknameQuery = await db.collection('users').where('nickname', '==', nickname).get();
        if (!nicknameQuery.empty) {
            // Se a busca não for vazia, o apelido já existe
            throw new Error("Este apelido já está em uso. Por favor, escolha outro.");
        }
        
        // Coletar outros dados do formulário
        const bio = document.getElementById('bio').value;
        const school = document.getElementById('school').value;
        const grade = document.getElementById('grade').value;
        
        const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked'))
            .map(checkbox => checkbox.value);
        
        const customHobbies = getCustomHobbies();
        const visibility = document.querySelector('input[name="visibility"]:checked').value;
        
        const profileData = {
            nickname: nickname,
            // O campo "tag" não é mais adicionado
            bio: bio,
            school: school,
            grade: grade,
            hobbies: selectedHobbies,
            customHobbies: customHobbies,
            visibility: visibility,
            photoURL: photoBase64 || '../img/Design sem nome2.png',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('users').doc(userId).set(profileData);
        
        alert('Perfil criado com sucesso!');
        window.location.href = '../home/home.html';

    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        alert('Erro ao salvar perfil: ' + error.message);
    } finally {
        savingProfile = false;
        saveButton.disabled = false;
        saveButton.textContent = 'Salvar perfil';
    }
}
});