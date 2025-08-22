document.addEventListener('DOMContentLoaded', function() {
    // --- Configuração Firebase e Variáveis (sem alterações) ---
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

    // --- Referências aos elementos do DOM (com adições) ---
    const profileForm = document.getElementById('profileForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoFileInput = document.getElementById('photoFile');
    const customHobbyInput = document.getElementById('customHobby');
    const addCustomHobbyBtn = document.getElementById('addCustomHobby');
    const customHobbiesList = document.getElementById('customHobbiesList');

    // Elementos do Modal
    const confirmationModal = document.getElementById('confirmationModal');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const editBtn = document.getElementById('editBtn');
    const confirmBtn = document.getElementById('confirmBtn');

    let currentUser = null;
    let savingProfile = false;
    let photoBase64 = null;

    // --- Lógica do "Ver Mais" (sem alterações) ---
    document.querySelectorAll('.see-more-btn').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.classList.toggle('visible');
                this.textContent = targetElement.classList.contains('visible') ? 'Ver menos' : 'Ver mais';
            }
        });
    });

    // --- Autenticação (sem alterações) ---
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    window.location.href = '../home/home.html';
                }
            });
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // --- Upload Base64 (sem alterações) ---
    photoFileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                photoBase64 = e.target.result;
                photoPreview.src = photoBase64;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // --- Hobbies Personalizados (sem alterações) ---
    addCustomHobbyBtn.addEventListener('click', addCustomHobby);
    // ... (resto da lógica de hobbies)

    // --- LÓGICA PRINCIPAL ALTERADA ---
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentUser || savingProfile) return;
        
        // Em vez de salvar, agora mostramos o modal de confirmação
        showConfirmationModal();
    });
    
    editBtn.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
    });

    confirmBtn.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        loadingOverlay.style.display = 'flex'; // Mostra o carregamento
        saveProfileData(currentUser.uid); // Agora sim, salva os dados
    });


    function showConfirmationModal() {
        // Coleta todos os dados do formulário
        const nickname = document.getElementById('nickname').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const school = document.getElementById('school').value;
        const grade = document.getElementById('grade').value;
        const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);
        const customHobbies = getCustomHobbies();
        const allHobbies = [...selectedHobbies, ...customHobbies];

        // Validação básica
        if (!nickname || !school || !grade) {
            alert("Por favor, preencha os campos obrigatórios: Apelido, Escola e Curso/Ano.");
            return;
        }

        // Preenche o modal com os dados
        document.getElementById('confirmPhoto').src = photoBase64 || photoPreview.src;
        document.getElementById('confirmNickname').textContent = nickname;
        document.getElementById('confirmSchool').textContent = school;
        document.getElementById('confirmGrade').textContent = grade;
        document.getElementById('confirmBio').textContent = bio || "Nenhuma biografia informada.";
        
        const hobbiesContainer = document.getElementById('confirmHobbies');
        hobbiesContainer.innerHTML = ''; // Limpa antes de adicionar
        if (allHobbies.length > 0) {
            allHobbies.forEach(hobby => {
                const tag = document.createElement('span');
                tag.className = 'hobby-tag';
                tag.textContent = hobby;
                hobbiesContainer.appendChild(tag);
            });
        } else {
            hobbiesContainer.textContent = "Nenhum hobby selecionado.";
        }

        // Mostra o modal
        confirmationModal.style.display = 'flex';
    }

    async function saveProfileData(userId) {
        savingProfile = true;

        try {
            // Coleta os dados novamente para garantir que estão corretos
            const nickname = document.getElementById('nickname').value.trim();
            const bio = document.getElementById('bio').value.trim();
            const school = document.getElementById('school').value;
            const grade = document.getElementById('grade').value;
            const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);
            const customHobbies = getCustomHobbies();
            const visibility = document.querySelector('input[name="visibility"]:checked').value;

            // Verificação de apelido único
            const nicknameQuery = await db.collection('users').where('nickname', '==', nickname).get();
            if (!nicknameQuery.empty) {
                throw new Error("Este apelido já está em uso. Por favor, escolha outro.");
            }
            
            const profileData = {
                nickname,
                bio,
                school,
                grade,
                hobbies: selectedHobbies,
                customHobbies: customHobbies,
                visibility,
                photoURL: photoBase64 || '../img/Design sem nome2.png',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(userId).set(profileData);
            
            // Não precisa de alert, apenas redireciona
            window.location.href = '../home/home.html';

        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            alert('Erro ao salvar perfil: ' + error.message);
        } finally {
            // Esconde o overlay de carregamento em qualquer caso (sucesso ou erro)
            loadingOverlay.style.display = 'none';
            savingProfile = false;
        }
    }

    // --- Funções de Hobby (sem alterações) ---
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
    
    function getCustomHobbies() {
        return Array.from(customHobbiesList.querySelectorAll('.hobby-tag'))
            .map(tag => tag.textContent.trim());
    }
    
    customHobbiesList.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-hobby') || e.target.parentElement.classList.contains('remove-hobby')) {
            e.target.closest('.hobby-tag')?.remove();
        }
    });
});