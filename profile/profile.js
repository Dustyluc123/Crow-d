document.addEventListener('DOMContentLoaded', function() {
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

    const profileForm = document.getElementById('profileForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoFileInput = document.getElementById('photoFile');
    const customHobbyInput = document.getElementById('customHobby');
    const addCustomHobbyBtn = document.getElementById('addCustomHobby');
    const customHobbiesList = document.getElementById('customHobbiesList');

    let currentUser = null;
    let base64Photo = '';
    let savingProfile = false;
    let loadingMessage = null;

    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
        } else {
            alert('Você precisa estar logado para acessar esta página.');
            window.location.href = '../login/login.html';
        }
    });

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

    addCustomHobbyBtn.addEventListener('click', addCustomHobby);
    customHobbyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomHobby();
        }
    });
    customHobbiesList.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-hobby') || e.target.parentElement.classList.contains('remove-hobby')) {
            const hobbyTag = e.target.closest('.hobby-tag');
            if (hobbyTag) hobbyTag.remove();
        }
    });

    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!currentUser) return alert('Você precisa estar logado.');
        if (savingProfile) return alert('Aguarde, salvando perfil...');
        savingProfile = true;
        loadingMessage = showMessage('Salvando perfil...', 'loading');

        saveProfileData(currentUser.uid)
            .then(() => {
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                showSaveMessage();
                setTimeout(() => {
                    window.location.href = '../home/home.html';
                }, 2000);
            })
            .catch(err => {
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                alert('Erro ao salvar perfil: ' + err.message);
                console.error(err);
            })
            .finally(() => savingProfile = false);
    });

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

    async function saveProfileData(userId) {
        const nickname = document.getElementById('nickname').value.trim();
        const bio = document.getElementById('bio').value.trim();
        const school = document.getElementById('school').value;
        const grade = document.getElementById('grade').value;
        const selectedHobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked'))
            .map(c => c.value);
        const customHobbies = getCustomHobbies();
        const visibility = document.querySelector('input[name="visibility"]:checked').value;

        const photoData = base64Photo || '../img/Design sem nome2.png';

        const profileData = {
            nickname,
            bio,
            school,
            grade,
            hobbies: selectedHobbies,
            customHobbies,
            visibility,
            photoURL: photoData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(userId).set(profileData, { merge: true });
        return true;
    }

    function showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        document.body.appendChild(messageElement);
        return messageElement;
    }

    function showSaveMessage() {
        const messageElement = document.createElement('div');
        messageElement.className = 'message success';
        messageElement.innerHTML = '<i class="fas fa-check-circle"></i> Perfil criado com sucesso!';
        document.body.appendChild(messageElement);
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 3000);
    }
});
