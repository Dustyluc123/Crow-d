// CONTEÚDO COMPLETO E FINAL PARA O ARQUIVO: edit-profile.js

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

    // Referências aos elementos do DOM
    const photoInput = document.getElementById('photoFile');
    const profileImagePreview = document.getElementById('photoPreview');
    const nicknameInput = document.getElementById('nickname');
    const bioInput = document.getElementById('bio');
    const schoolInput = document.getElementById('school');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const profileEditForm = document.getElementById('profileEditForm');

    // Referências do Modal de Corte
    const cropperModal = document.getElementById('cropperModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const confirmCropBtn = document.getElementById('confirmCropBtn');
    const cancelCropBtn = document.getElementById('cancelCropBtn');
    
    let cropper;
    let croppedImageBase64 = null;
    let currentUser = null;
    let originalProfileData = {};

    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            loadUserProfile(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    async function loadUserProfile(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            originalProfileData = doc.data();
            nicknameInput.value = originalProfileData.nickname || '';
            bioInput.value = originalProfileData.bio || '';
            schoolInput.value = originalProfileData.school || '';
            profileImagePreview.src = originalProfileData.photoURL || '../img/Design sem nome2.png';
            
            const nicknameCounter = document.getElementById('nickname-char-counter');
            if (nicknameCounter) {
                nicknameCounter.textContent = `${nicknameInput.value.length}/40`;
            }
            
            const userHobbies = originalProfileData.hobbies || [];
            document.querySelectorAll('input[name="hobbies"]').forEach(checkbox => checkbox.checked = false);
            userHobbies.forEach(hobby => {
                const checkbox = document.querySelector(`input[name="hobbies"][value="${hobby}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }

    // Lógica do Cropper
    photoInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageToCrop.src = e.target.result;
                cropperModal.style.display = 'flex';
                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, { aspectRatio: 1, viewMode: 1, background: false });
            };
            reader.readAsDataURL(files[0]);
        }
    });

    confirmCropBtn.addEventListener('click', () => {
        const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
        croppedImageBase64 = canvas.toDataURL('image/jpeg');
        profileImagePreview.src = croppedImageBase64;
        cropperModal.style.display = 'none';
        cropper.destroy();
    });

    cancelCropBtn.addEventListener('click', () => {
        cropperModal.style.display = 'none';
        cropper.destroy();
        photoInput.value = '';
    });

    // Lógica do contador de caracteres
    const nicknameCounter = document.getElementById('nickname-char-counter');
    if (nicknameInput && nicknameCounter) {
        nicknameInput.addEventListener('input', () => {
            const currentLength = nicknameInput.value.length;
            nicknameCounter.textContent = `${currentLength}/40`;
            if (currentLength > 40) {
                nicknameCounter.style.color = '#ff6b6b';
            } else {
                nicknameCounter.style.color = '';
            }
        });
    }

    // LÓGICA DE SALVAR O PERFIL (COM A VERIFICAÇÃO DE NOME DUPLICADO)
    profileEditForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        if (!currentUser) return;
    
        const nicknameValue = nicknameInput.value.trim();
        if (nicknameValue.length > 40) {
            showToast("O nome de usuário não pode ter mais de 40 caracteres.", "error");
            return;
        }
    
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Salvando...';
    
        try {
            // --- Verificação de apelido (essencial) ---
            const nicknameChanged = nicknameValue !== originalProfileData.nickname;
            if (nicknameChanged) {
                const nicknameQuery = await db.collection('users').where('nickname', '==', nicknameValue).get();
                if (!nicknameQuery.empty) {
                    showToast("Este nome de usuário já está em uso. Por favor, escolha outro.", "error");
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.textContent = 'Salvar Alterações';
                    return;
                }
            }
    
            // --- Preparação dos dados para salvar ---
            const photoChanged = !!croppedImageBase64;
            const needsPostUpdate = nicknameChanged || photoChanged;
    
            const updatedData = {};
            if (nicknameChanged) updatedData.nickname = nicknameValue;
            if (photoChanged) updatedData.photoURL = croppedImageBase64;
            if (bioInput.value !== originalProfileData.bio) updatedData.bio = bioInput.value;
            if (schoolInput.value !== originalProfileData.school) updatedData.school = schoolInput.value;
    
            const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);
            updatedData.hobbies = selectedHobbies;
            updatedData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    
            // --- 1. Executa a atualização principal e crítica ---
            await db.collection('users').doc(currentUser.uid).update(updatedData);
    
            // --- 2. Mostra o sucesso IMEDIATAMENTE ---
            showToast("Perfil atualizado com sucesso!", "success");
    
            // --- 3. Tenta fazer as atualizações secundárias em segundo plano ---
            if (needsPostUpdate) {
                const finalUserData = {
                    nickname: nicknameValue,
                    photoURL: croppedImageBase64 || originalProfileData.photoURL
                };
                // Chama a função, mas não espera por ela e captura o erro para não quebrar a experiência
                updateUserContent(currentUser.uid, finalUserData).catch(err => {
                    console.error("Erro não-crítico ao atualizar conteúdo antigo:", err);
                    // Não mostramos erro ao usuário aqui, pois o perfil já foi salvo.
                });
            }
    
            // --- 4. Redireciona o usuário para o perfil ---
            setTimeout(() => {
                window.location.href = `../pages/user.html?uid=${currentUser.uid}`;
            }, 1500);
    
        } catch (error) {
            // Este bloco agora só vai capturar erros da atualização principal ou da verificação de apelido
            console.error("Erro CRÍTICO ao salvar o perfil:", error);
            showToast("Ocorreu um erro ao salvar. Tente novamente.", "error");
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = 'Salvar Alterações';
        }
    });
    async function updateUserContent(userId, newProfileData) {
        console.log("Iniciando atualização de conteúdo antigo (posts, reposts e lista de amigos)...");
        const batch = db.batch();

        const authorQuery = db.collection('posts').where('authorId', '==', userId);
        const authorSnapshot = await authorQuery.get();
        authorSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                authorName: newProfileData.nickname,
                authorPhoto: newProfileData.photoURL
            });
        });

        const originalAuthorQuery = db.collection('posts').where('originalPost.authorId', '==', userId);
        const originalAuthorSnapshot = await originalAuthorQuery.get();
        originalAuthorSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                'originalPost.authorName': newProfileData.nickname,
                'originalPost.authorPhoto': newProfileData.photoURL
            });
        });
        
        const friendsSnapshot = await db.collection('users').doc(userId).collection('friends').get();
        friendsSnapshot.forEach(friendDoc => {
            const friendRef = db.collection('users').doc(friendDoc.id).collection('friends').doc(userId);
            batch.update(friendRef, {
                nickname: newProfileData.nickname,
                photoURL: newProfileData.photoURL
            });
        });

        await batch.commit();
        console.log(`Conteúdo antigo atualizado.`);
    }

    document.querySelectorAll('.see-more-btn').forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.classList.toggle('visible');
                this.textContent = targetElement.classList.contains('visible') ? 'Ver menos' : 'Ver mais';
            }
        });
    });
});