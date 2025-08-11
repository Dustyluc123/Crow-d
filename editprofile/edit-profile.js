document.addEventListener('DOMContentLoaded', function() {
    // Configuração Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
        authDomain: "tcclogin-7e7b8.firebaseapp.com",
        projectId: "tcclogin-7e7b8",
        messagingSenderId: "1066633833169",
        appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
    };
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Elementos DOM
    const profileForm = document.getElementById('profileEditForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoFileInput = document.getElementById('photoFile');
    const nicknameInput = document.getElementById('nickname');
    const bioInput = document.getElementById('bio');
    const schoolSelect = document.getElementById('school');
    const gradeSelect = document.getElementById('grade');
    const hobbyCheckboxes = document.querySelectorAll('input[name="hobbies"]');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const logoutButton = document.getElementById('logout-btn');

    // Variáveis
    let currentUser = null;
    let currentUserProfile = null;
    let base64Photo = '';
    let isSubmitting = false;

    // Autenticação
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // Logout
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = '../login/login.html';
            });
        });
    }

    // Upload de arquivo → Base64
    if (photoFileInput) {
        photoFileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    base64Photo = e.target.result;
                    photoPreview.src = base64Photo;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Submissão do formulário
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!isSubmitting) saveProfile();
        });
    }

    // Carregar dados do Firestore
    async function loadUserProfile(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                currentUserProfile = doc.data();
                fillProfileForm(currentUserProfile);
            }
        } catch (err) {
            console.error('Erro ao carregar perfil:', err);
        }
    }

    function fillProfileForm(profile) {
        if (profile.photoURL) {
            photoPreview.src = profile.photoURL;
        }
        if (profile.nickname) nicknameInput.value = profile.nickname;
        if (profile.bio) bioInput.value = profile.bio;
        if (profile.school) schoolSelect.value = profile.school;
        if (profile.grade) gradeSelect.value = profile.grade;
        if (profile.hobbies) {
            hobbyCheckboxes.forEach(c => {
                if (profile.hobbies.includes(c.value)) c.checked = true;
            });
        }
    }

    async function saveProfile() {
        try {
            isSubmitting = true;
            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

            if (!currentUser) return alert('Você precisa estar logado.');

            const nickname = nicknameInput.value.trim();
            const bio = bioInput.value.trim();
            const school = schoolSelect.value;
            const grade = gradeSelect.value;
            const selectedHobbies = [...hobbyCheckboxes].filter(c => c.checked).map(c => c.value);

            if (!nickname || !school) {
                alert('Preencha nome e escola.');
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = 'Salvar alterações';
                isSubmitting = false;
                return;
            }

            const photoData = base64Photo || currentUserProfile?.photoURL || '../img/Design sem nome2.png';

            const profileData = {
                photoURL: photoData,
                nickname,
                bio,
                school,
                grade,
                hobbies: selectedHobbies,
                visibility: 'public',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (!currentUserProfile) {
                profileData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await db.collection('users').doc(currentUser.uid).set(profileData, { merge: true });

            alert('Perfil salvo com sucesso!');
            window.location.href = '../home/home.html';

        } catch (err) {
            console.error('Erro ao salvar perfil:', err);
            alert('Erro ao salvar perfil.');
            saveProfileBtn.disabled = false;
            saveProfileBtn.innerHTML = 'Salvar alterações';
            isSubmitting = false;
        }
    }
});
