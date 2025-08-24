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
            
            // ATUALIZA O CONTADOR QUANDO A PÁGINA CARREGA
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
    // LÓGICA DO CONTADOR DE CARACTERES
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

    // LÓGICA DE SALVAR O PERFIL
    profileEditForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        if (!currentUser) return;

           const nicknameValue = nicknameInput.value.trim();
        if (nicknameValue.length > 40) {
            alert("O nome de usuário não pode ter mais de 40 caracteres.");
            return;
        }

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Salvando...';

        try {
            const nicknameChanged = nicknameInput.value !== originalProfileData.nickname;
            const photoChanged = !!croppedImageBase64;
            const needsPostUpdate = nicknameChanged || photoChanged;

            const updatedData = {};
            if (nicknameChanged) updatedData.nickname = nicknameInput.value;
            if (photoChanged) updatedData.photoURL = croppedImageBase64;
            if (bioInput.value !== originalProfileData.bio) updatedData.bio = bioInput.value;
            if (schoolInput.value !== originalProfileData.school) updatedData.school = schoolInput.value;

            const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);
            updatedData.hobbies = selectedHobbies;
            updatedData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

            await db.collection('users').doc(currentUser.uid).update(updatedData);

            if (needsPostUpdate) {
                const finalUserData = {
                    nickname: nicknameInput.value,
                    photoURL: croppedImageBase64 || originalProfileData.photoURL
                };
                await updateUserContent(currentUser.uid, finalUserData);
            }

            showToast("Perfil atualizado com sucesso!", "success");
            setTimeout(() => {
                window.location.href = `../pages/user.html?uid=${currentUser.uid}`;
            }, 1500);

        } catch (error) {
            console.error("Erro ao salvar o perfil:", error);
            showToast("Ocorreu um erro ao salvar. Tente novamente.", "error");
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = 'Salvar Alterações';
        }
    });

    // --- FUNÇÃO PARA ATUALIZAR CONTEÚDO ANTIGO ---
    async function updateUserContent(userId, newProfileData) {
        console.log("Iniciando atualização de conteúdo antigo (posts, reposts e lista de amigos)...");
        const batch = db.batch();

        // 1. Encontra e atualiza todos os POSTS onde o usuário é o AUTOR DIRETO
        const authorQuery = db.collection('posts').where('authorId', '==', userId);
        const authorSnapshot = await authorQuery.get();
        
        authorSnapshot.forEach(doc => {
            const postRef = doc.ref;
            batch.update(postRef, {
                authorName: newProfileData.nickname,
                authorPhoto: newProfileData.photoURL
            });
        });

        // 2. Encontra e atualiza todos os REPOSTS onde o usuário é o AUTOR ORIGINAL
        const originalAuthorQuery = db.collection('posts').where('originalPost.authorId', '==', userId);
        const originalAuthorSnapshot = await originalAuthorQuery.get();

        originalAuthorSnapshot.forEach(doc => {
            const postRef = doc.ref;
            batch.update(postRef, {
                'originalPost.authorName': newProfileData.nickname,
                'originalPost.authorPhoto': newProfileData.photoURL
            });
        });
        
        // 3. Encontra todos os amigos do usuário atual e atualiza a sua própria informação na lista deles
        const friendsSnapshot = await db.collection('users').doc(userId).collection('friends').get();
    
        friendsSnapshot.forEach(friendDoc => {
            const friendRef = db.collection('users').doc(friendDoc.id).collection('friends').doc(userId);
            batch.update(friendRef, {
                nickname: newProfileData.nickname,
                photoURL: newProfileData.photoURL
            });
        });

        await batch.commit();
        console.log(`Conteúdo antigo atualizado. ${authorSnapshot.size + originalAuthorSnapshot.size} posts e ${friendsSnapshot.size} amigos verificados.`);
    }

    
    // Lógica dos Hobbies "Ver mais"
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

// Função de Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 500);
        }, 3000);
    }, 100);
}