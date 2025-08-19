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
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Referências aos elementos do DOM
    const profileForm = document.getElementById('profileForm');
    const photoURLInput = document.getElementById('photoURL');
    const photoPreview = document.getElementById('photoPreview');
    const customHobbyInput = document.getElementById('customHobby');
    const addCustomHobbyBtn = document.getElementById('addCustomHobby');
    const customHobbiesList = document.getElementById('customHobbiesList');
    
    // Variáveis globais
    let currentUser = null;
    let savingProfile = false;
    let loadingMessage = null;
    
    // Verificar se o usuário está autenticado
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // Usuário está logado, carregar dados do perfil
            currentUser = user;
            loadProfileData(user.uid);
        } else {
            // Usuário não está logado, redirecionar para login
            alert('Você precisa estar logado para acessar esta página.');
            window.location.href = '../login/login.html';
        }
    });
    
    // Event listener para preview de foto ao inserir URL
    photoURLInput.addEventListener('input', function() {
        const url = photoURLInput.value.trim();
        if (url) {
            // Atualizar a imagem de preview
            photoPreview.src = url;
            
            // Adicionar listener para tratar erros de carregamento da imagem
            photoPreview.onerror = function() {
                photoPreview.src = '../img/Design sem nome2.png';
                console.log('Erro ao carregar imagem da URL fornecida');
            };
        } else {
            // Se a URL estiver vazia, usar a imagem padrão
            photoPreview.src = '../img/Design sem nome2.png';
        }
    });
    
    // Event listener para adicionar hobby personalizado
    addCustomHobbyBtn.addEventListener('click', function() {
        addCustomHobby();
    });
    
    // Permitir adicionar hobby ao pressionar Enter
    customHobbyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomHobby();
        }
    });
    
    // Event delegation para remover hobbies personalizados
    customHobbiesList.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-hobby') || e.target.parentElement.classList.contains('remove-hobby')) {
            const hobbyTag = e.target.closest('.hobby-tag');
            if (hobbyTag) {
                hobbyTag.remove();
            }
        }
    });
    
    // Event listener para salvar o formulário
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Verificar se o usuário está autenticado
        if (!currentUser) {
            alert('Você precisa estar logado para salvar seu perfil.');
            return;
        }
        
        // Evitar múltiplos envios
        if (savingProfile) {
            alert('Aguarde, seu perfil está sendo salvo...');
            return;
        }
        
        savingProfile = true;
        
        // Mostrar mensagem de carregamento
        loadingMessage = showMessage('Salvando perfil...', 'loading');
        
        // Salvar dados do perfil
        saveProfileData(currentUser.uid)
            .then(() => {
                // Remover mensagem de carregamento
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                
                // Mostrar mensagem de sucesso
                showSaveMessage();
                
                // Redirecionar para a página home após 2 segundos
                setTimeout(() => {
                    window.location.href = '../home/home.html';
                }, 2000);
            })
            .catch(error => {
                // Remover mensagem de carregamento
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                
                // Mostrar mensagem de erro
                alert('Erro ao salvar perfil: ' + error.message);
                console.error('Erro ao salvar perfil:', error);
            })
            .finally(() => {
                savingProfile = false;
            });
    });
    
    // Função para adicionar hobby personalizado
    function addCustomHobby() {
        const hobbyText = customHobbyInput.value.trim();
        if (hobbyText) {
            // Criar elemento de hobby
            const hobbyTag = document.createElement('span');
            hobbyTag.className = 'hobby-tag';
            hobbyTag.innerHTML = `${hobbyText} <i class="fas fa-times remove-hobby"></i>`;
            
            // Adicionar à lista
            customHobbiesList.appendChild(hobbyTag);
            
            // Limpar o input
            customHobbyInput.value = '';
        }
    }
    
    // Função para coletar hobbies personalizados
    function getCustomHobbies() {
        const hobbies = [];
        const hobbyTags = customHobbiesList.querySelectorAll('.hobby-tag');
        
        hobbyTags.forEach(tag => {
            // Obter o texto do hobby (sem o ícone de remover)
            const hobbyText = tag.textContent.trim();
            hobbies.push(hobbyText);
        });
        
        return hobbies;
    }
    
    // Função para carregar hobbies personalizados
    function loadCustomHobbies(hobbies) {
        // Limpar a lista atual
        customHobbiesList.innerHTML = '';
        
        // Adicionar cada hobby à lista
        if (hobbies && hobbies.length > 0) {
            hobbies.forEach(hobby => {
                const hobbyTag = document.createElement('span');
                hobbyTag.className = 'hobby-tag';
                hobbyTag.innerHTML = `${hobby} <i class="fas fa-times remove-hobby"></i>`;
                customHobbiesList.appendChild(hobbyTag);
            });
        }
    }
    
    // Função para salvar todos os dados do perfil no Firestore
    async function saveProfileData(userId) {
        try {
            const nickname = document.getElementById('nickname').value.trim();

            // --- INÍCIO DA VERIFICAÇÃO DE NICKNAME ---
            if (nickname) {
                const querySnapshot = await db.collection('users').where('nickname', '==', nickname).get();
                if (!querySnapshot.empty) {
                    // Nickname já existe, joga um erro para ser pego pelo catch
                    throw new Error("Este apelido já está em uso. Por favor, escolha outro.");
                }
            } else {
                throw new Error("O apelido é obrigatório.");
            }
            // --- FIM DA VERIFICAÇÃO DE NICKNAME ---

            // Coletar outros dados do formulário
            const bio = document.getElementById('bio').value;
            const school = document.getElementById('school').value;
            const grade = document.getElementById('grade').value;
            const photoURL = document.getElementById('photoURL').value.trim();
            
            const selectedHobbies = [];
            const hobbyCheckboxes = document.querySelectorAll('input[name="hobbies"]:checked');
            hobbyCheckboxes.forEach(checkbox => {
                selectedHobbies.push(checkbox.value);
            });
            
            const customHobbies = getCustomHobbies();
            const visibility = document.querySelector('input[name="visibility"]:checked').value;
            
            const profileData = {
                nickname,
                bio,
                school,
                grade,
                hobbies: selectedHobbies,
                customHobbies,
                visibility,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (photoURL) {
                profileData.photoURL = photoURL;
            }
            
            if (loadingMessage) {
                loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando dados do perfil...';
            }
            
            await db.collection('users').doc(userId).set(profileData, { merge: true });
            
            return true;
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            throw error; // Re-joga o erro para o .catch() do listener do formulário
        }
    }
    
    // Função para carregar dados do perfil do Firestore
    function loadProfileData(userId) {
        // Mostrar mensagem de carregamento
        loadingMessage = showMessage('Carregando perfil...', 'loading');
        
        // Buscar dados do perfil no Firestore
        db.collection('users').doc(userId).get()
            .then(doc => {
                // Remover mensagem de carregamento
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                
                if (doc.exists) {
                    const profileData = doc.data();
                    
                    // Preencher campos do formulário
                    document.getElementById('nickname').value = profileData.nickname || '';
                    document.getElementById('bio').value = profileData.bio || '';
                    
                    if (profileData.school) {
                        const schoolSelect = document.getElementById('school');
                        for (let i = 0; i < schoolSelect.options.length; i++) {
                            if (schoolSelect.options[i].value === profileData.school) {
                                schoolSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                    
                    if (profileData.grade) {
                        const gradeSelect = document.getElementById('grade');
                        for (let i = 0; i < gradeSelect.options.length; i++) {
                            if (gradeSelect.options[i].value === profileData.grade) {
                                gradeSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                    
                    if (profileData.hobbies && profileData.hobbies.length > 0) {
                        const hobbyCheckboxes = document.querySelectorAll('input[name="hobbies"]');
                        hobbyCheckboxes.forEach(checkbox => {
                            if (profileData.hobbies.includes(checkbox.value)) {
                                checkbox.checked = true;
                            }
                        });
                    }
                    
                    if (profileData.customHobbies) {
                        loadCustomHobbies(profileData.customHobbies);
                    }
                    
                    if (profileData.visibility) {
                        const visibilityRadios = document.querySelectorAll('input[name="visibility"]');
                        visibilityRadios.forEach(radio => {
                            radio.checked = (radio.value === profileData.visibility);
                        });
                    }
                    
                    if (profileData.photoURL) {
                        photoURLInput.value = profileData.photoURL;
                        photoPreview.src = profileData.photoURL;
                    }
                }
            })
            .catch(error => {
                // Remover mensagem de carregamento
                if (loadingMessage) {
                    document.body.removeChild(loadingMessage);
                    loadingMessage = null;
                }
                
                console.error('Erro ao carregar perfil:', error);
                alert('Erro ao carregar perfil. Tente novamente mais tarde.');
            });
    }
    
    // Função para mostrar mensagem de carregamento
    function showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        document.body.appendChild(messageElement);
        return messageElement;
    }
    
    // Função para mostrar mensagem de sucesso
    function showSaveMessage() {
        const messageElement = document.createElement('div');
        messageElement.className = 'message success';
        messageElement.innerHTML = '<i class="fas fa-check-circle"></i> Perfil salvo com sucesso!';
        document.body.appendChild(messageElement);
        
        // Remover mensagem após 3 segundos
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 3000);
    }
});