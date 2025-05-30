// Script para a página de edição de perfil
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

    // Referências aos elementos do DOM
    const profileForm = document.getElementById('profileEditForm');
    const photoPreview = document.getElementById('photoPreview');
    const photoURLInput = document.getElementById('photoURL');
    const nicknameInput = document.getElementById('nickname');
    const bioInput = document.getElementById('bio');
    const schoolSelect = document.getElementById('school');
    const gradeSelect = document.getElementById('grade');
    const hobbyCheckboxes = document.querySelectorAll('input[name="hobbies"]');
    const customHobbiesContainer = document.getElementById('customHobbiesContainer');
    const addCustomHobbyBtn = document.getElementById('addCustomHobbyBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const logoutButton = document.getElementById('logout-btn');

    // Variáveis globais
    let currentUser = null;
    let currentUserProfile = null;
    let customHobbies = [];
    let oldPhotoURL = ''; // Para armazenar a URL anterior da foto
    let isSubmitting = false; // Flag para evitar múltiplos submits

    // Verificar autenticação do usuário
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            // Usuário está logado
            currentUser = user;
            
            // Carregar perfil do usuário
            await loadUserProfile(user.uid);
        } else {
            // Usuário não está logado, redirecionar para login
            window.location.href = '../login/login.html';
        }
    });

    // Event listener para o botão de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            auth.signOut()
                .then(() => {
                    window.location.href = '../login/login.html';
                })
                .catch(error => {
                    console.error('Erro ao fazer logout:', error);
                    alert('Erro ao fazer logout. Tente novamente.');
                });
        });
    }

    // Event listener para o input de URL da foto (preview em tempo real)
    if (photoURLInput) {
        photoURLInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url) {
                photoPreview.src = url;
            } else {
                photoPreview.src = '../img/Design sem nome2.png';
            }
        });
    }

    // Event listener para o botão de adicionar hobby personalizado
    if (addCustomHobbyBtn) {
        addCustomHobbyBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Evitar comportamento padrão do botão
            addCustomHobbyField();
        });
    }

    // Event listener para o formulário de perfil
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Evitar múltiplos submits
            if (isSubmitting) {
                console.log('Já existe um envio em andamento, ignorando clique adicional');
                return;
            }
            
            saveProfile();
        });
    }

    // Função para carregar o perfil do usuário
    async function loadUserProfile(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            
            if (doc.exists) {
                currentUserProfile = doc.data();
                oldPhotoURL = currentUserProfile.photoURL || ''; // Salvar URL atual para comparação posterior
                
                // Preencher campos do formulário com dados do perfil
                fillProfileForm(currentUserProfile);
            } else {
                console.log('Perfil do usuário não encontrado. Criando novo perfil...');
                // Não redirecionar, permitir que o usuário crie seu perfil aqui mesmo
            }
        } catch (error) {
            console.error('Erro ao carregar perfil do usuário:', error);
            alert('Erro ao carregar perfil. Tente novamente mais tarde.');
        }
    }

    // Função para preencher o formulário com os dados do perfil
    function fillProfileForm(profile) {
        if (!profile) return;
        
        // Preencher URL da foto e atualizar preview
        if (profile.photoURL) {
            photoURLInput.value = profile.photoURL;
            photoPreview.src = profile.photoURL;
        }
        
        // Preencher campos de texto
        if (profile.nickname) nicknameInput.value = profile.nickname;
        if (profile.bio) bioInput.value = profile.bio;
        
        // Selecionar escola e série
        if (profile.school) schoolSelect.value = profile.school;
        if (profile.grade) gradeSelect.value = profile.grade;
        
        // Marcar hobbies
        if (profile.hobbies && profile.hobbies.length > 0) {
            hobbyCheckboxes.forEach(checkbox => {
                if (profile.hobbies.includes(checkbox.value)) {
                    checkbox.checked = true;
                }
            });
        }
        
        // Adicionar hobbies personalizados
        if (profile.customHobbies && profile.customHobbies.length > 0) {
            customHobbies = [...profile.customHobbies];
            
            // Limpar container de hobbies personalizados
            if (customHobbiesContainer) {
                customHobbiesContainer.innerHTML = '';
                
                // Adicionar cada hobby personalizado
                customHobbies.forEach(hobby => {
                    addCustomHobbyField(hobby);
                });
            }
        }
    }

    // Função para adicionar campo de hobby personalizado
    function addCustomHobbyField(value = '') {
        if (!customHobbiesContainer) return;
        
        const hobbyIndex = document.querySelectorAll('.custom-hobby-input').length;
        
        const hobbyGroup = document.createElement('div');
        hobbyGroup.className = 'custom-hobby-group';
        
        const hobbyInput = document.createElement('input');
        hobbyInput.type = 'text';
        hobbyInput.className = 'custom-hobby-input';
        hobbyInput.name = `customHobby_${hobbyIndex}`;
        hobbyInput.placeholder = 'Digite um hobby personalizado';
        hobbyInput.value = value;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-hobby-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Evitar comportamento padrão
            hobbyGroup.remove();
        });
        
        hobbyGroup.appendChild(hobbyInput);
        hobbyGroup.appendChild(removeBtn);
        
        customHobbiesContainer.appendChild(hobbyGroup);
    }

    // Função para atualizar a foto do usuário em todos os posts
    async function updateUserPhotoInPosts(newPhotoURL) {
        try {
            // Buscar todos os posts do usuário
            const postsSnapshot = await db.collection('posts')
                .where('authorId', '==', currentUser.uid)
                .get();
            
            if (postsSnapshot.empty) {
                console.log('Nenhum post encontrado para atualizar.');
                return;
            }
            
            // Criar um batch para atualizar múltiplos documentos de uma vez
            const batch = db.batch();
            
            // Adicionar cada post ao batch para atualização
            postsSnapshot.forEach(doc => {
                const postRef = db.collection('posts').doc(doc.id);
                batch.update(postRef, { authorPhoto: newPhotoURL });
            });
            
            // Executar o batch
            await batch.commit();
            
            console.log(`Foto atualizada em ${postsSnapshot.size} posts.`);
        } catch (error) {
            console.error('Erro ao atualizar foto nos posts:', error);
            // Não interromper o fluxo se houver erro aqui
        }
    }

    // Função para salvar o perfil
    async function saveProfile() {
        try {
            // Verificar se já está em processo de envio
            if (isSubmitting) {
                console.log('Já existe um envio em andamento');
                return;
            }
            
            // Marcar como em processo de envio
            isSubmitting = true;
            
            if (!currentUser) {
                alert('Você precisa estar logado para salvar o perfil.');
                isSubmitting = false;
                return;
            }
            
            // Desabilitar botão de salvar
            if (saveProfileBtn) {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            }
            
            // Coletar dados do formulário
            const photoURL = photoURLInput.value.trim();
            const nickname = nicknameInput.value.trim();
            const bio = bioInput.value.trim();
            const school = schoolSelect.value;
            const grade = gradeSelect.value;
            
            // Coletar hobbies selecionados
            const selectedHobbies = [];
            hobbyCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedHobbies.push(checkbox.value);
                }
            });
            
            // Coletar hobbies personalizados
            const customHobbyInputs = document.querySelectorAll('.custom-hobby-input');
            const newCustomHobbies = [];
            
            customHobbyInputs.forEach(input => {
                const value = input.value.trim();
                if (value) {
                    newCustomHobbies.push(value);
                }
            });
            
            // Validar campos obrigatórios
            if (!nickname) {
                alert('Por favor, digite um nome de usuário.');
                if (saveProfileBtn) {
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.innerHTML = 'Salvar Perfil';
                }
                isSubmitting = false;
                return;
            }
            
            if (!school) {
                alert('Por favor, selecione sua escola.');
                if (saveProfileBtn) {
                    saveProfileBtn.disabled = false;
                    saveProfileBtn.innerHTML = 'Salvar Perfil';
                }
                isSubmitting = false;
                return;
            }
            
            // Criar objeto de perfil
            const profileData = {
                photoURL,
                nickname,
                bio,
                school,
                grade,
                hobbies: selectedHobbies,
                customHobbies: newCustomHobbies,
                visibility: 'public', // Padrão: perfil público
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Se for a primeira vez, adicionar data de criação
            if (!currentUserProfile) {
                profileData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            // Salvar perfil no Firestore
            await db.collection('users').doc(currentUser.uid).set(profileData, { merge: true });
            
            // Verificar se a foto foi alterada
            if (photoURL !== oldPhotoURL) {
                console.log('Foto de perfil alterada. Atualizando em posts...');
                await updateUserPhotoInPosts(photoURL);
            }
            
            // Atualizar perfil local
            currentUserProfile = {
                ...currentUserProfile,
                ...profileData
            };
            
            // Exibir mensagem de sucesso
            alert('Perfil salvo com sucesso!');
            
            // Usar setTimeout para evitar problemas de layout durante o redirecionamento
            setTimeout(() => {
                // Redirecionar para a página inicial
                window.location.href = '../home/home.html';
            }, 100);
            
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            alert('Erro ao salvar perfil. Tente novamente.');
            
            // Reativar botão de salvar
            if (saveProfileBtn) {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = 'Salvar Perfil';
            }
            
            // Resetar flag de envio
            isSubmitting = false;
        }
    }
});
