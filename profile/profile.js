document.addEventListener('DOMContentLoaded', function() {
    // --- Configuração Firebase e Variáveis ---
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

    // --- Referências ao DOM ---
    const profileForm = document.getElementById('profileForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoFileInput = document.getElementById('photoFile');

    // Elementos dos Modais
    const confirmationModal = document.getElementById('confirmationModal');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const termsModal = document.getElementById('termsModal');
    const editBtn = document.getElementById('editBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const acceptTermsBtn = document.getElementById('acceptTermsBtn');
    const declineTermsBtn = document.getElementById('declineTermsBtn');

    // Elementos do Modal do Cropper
    const cropperModal = document.getElementById('cropperModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const cropSaveBtn = document.getElementById('cropSaveBtn');
    const cropCancelBtn = document.getElementById('cropCancelBtn');
    const rotateBtn = document.getElementById('rotateBtn');
    const flipHorizontalBtn = document.getElementById('flipHorizontalBtn');
    const flipVerticalBtn = document.getElementById('flipVerticalBtn');

    let currentUser = null;
    let savingProfile = false;
    let photoBase64 = null;
    let cropper = null;
    let scaleX = 1;
    let scaleY = 1;

    // --- Lógica do "Ver Mais" ---
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

    // --- Lógica do Contador de Caracteres ---
    const nicknameInput = document.getElementById('nickname');
    const nicknameCounter = document.getElementById('nickname-char-counter');
    if (nicknameInput && nicknameCounter) {
        nicknameInput.addEventListener('input', () => {
            const currentLength = nicknameInput.value.length;
            nicknameCounter.textContent = `${currentLength}/30`;
            nicknameCounter.style.color = currentLength > 30 ? '#ff6b6b' : '';
        });
    }

    // --- Autenticação ---
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

    // --- Lógica do Editor de Imagem (Cropper.js) ---
    photoFileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageToCrop.src = e.target.result;
                cropperModal.style.display = 'flex';
                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1,
                    viewMode: 1,
                    background: false,
                    autoCropArea: 0.8,
                });
            };
            reader.readAsDataURL(file);
        }
    });

    rotateBtn.addEventListener('click', () => cropper?.rotate(90));
    flipHorizontalBtn.addEventListener('click', () => {
        if (cropper) {
            scaleX = -scaleX;
            cropper.scaleX(scaleX);
        }
    });
    flipVerticalBtn.addEventListener('click', () => {
        if (cropper) {
            scaleY = -scaleY;
            cropper.scaleY(scaleY);
        }
    });
    cropCancelBtn.addEventListener('click', () => {
        cropperModal.style.display = 'none';
        cropper?.destroy();
        photoFileInput.value = '';
    });
    cropSaveBtn.addEventListener('click', () => {
        if (cropper) {
            const canvas = cropper.getCroppedCanvas({
                width: 512, height: 512, imageSmoothingQuality: 'high'
            });
            photoBase64 = canvas.toDataURL('image/jpeg');
            photoPreview.src = photoBase64;
            cropperModal.style.display = 'none';
            cropper.destroy();
        }
    });

    // --- Fluxo de Submissão do Formulário ---
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentUser || savingProfile) return;
        showConfirmationModal();
    });

    editBtn.addEventListener('click', () => confirmationModal.style.display = 'none');
    confirmBtn.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        termsModal.style.display = 'flex';
    });
    declineTermsBtn.addEventListener('click', () => termsModal.style.display = 'none');
    acceptTermsBtn.addEventListener('click', () => {
        termsModal.style.display = 'none';
        loadingOverlay.style.display = 'flex';
        saveProfileData(currentUser.uid);
    });

    function showConfirmationModal() {
        const nickname = document.getElementById('nickname').value.trim();
        if (nickname.length > 30) {
            showToast("O apelido não pode ter mais de 30 caracteres.", "error");
            return;
        }

        const school = document.getElementById('school').value;
        const grade = document.getElementById('grade').value;
        if (!nickname || !school || !grade) {
            showToast("Por favor, preencha os campos obrigatórios: Apelido, Escola e Curso/Ano.", "error");
            return;
        }
        
        const bio = document.getElementById('bio').value.trim();
        const allHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);

        document.getElementById('confirmPhoto').src = photoBase64 || photoPreview.src;
        document.getElementById('confirmNickname').textContent = nickname;
        document.getElementById('confirmSchool').textContent = school;
        document.getElementById('confirmGrade').textContent = grade;
        document.getElementById('confirmBio').textContent = bio || "Nenhuma biografia informada.";
        
        const hobbiesContainer = document.getElementById('confirmHobbies');
        hobbiesContainer.innerHTML = '';
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

        confirmationModal.style.display = 'flex';
    }

    async function saveProfileData(userId) {
        savingProfile = true;
        try {
            const nickname = document.getElementById('nickname').value.trim();
            const nicknameQuery = await db.collection('users').where('nickname', '==', nickname).get();
            if (!nicknameQuery.empty) {
                throw new Error("Este apelido já está em uso. Por favor, escolha outro.");
            }
            
            const profileData = {
                nickname,
                bio: document.getElementById('bio').value.trim(),
                school: document.getElementById('school').value,
                grade: document.getElementById('grade').value,
                hobbies: Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value),
                customHobbies: [], // Removido, mas o campo continua existindo para consistência
                photoURL: photoBase64 || '../img/Design sem nome2.png',
                settings: { profilePublic: true, darkMode: true },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                termsAccepted: true
            };
            
            await db.collection('users').doc(userId).set(profileData);
            window.location.href = '../home/home.html';
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            showCustomAlert('Erro ao salvar perfil: ' + error.message);
            loadingOverlay.style.display = 'none';
        } finally {
            savingProfile = false;
        }
    }
});