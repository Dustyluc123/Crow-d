// CONTEÚDO COMPLETO PARA O NOVO ARQUIVO pages/user.js

document.addEventListener('DOMContentLoaded', function() {
  
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

    const profilePhoto = document.getElementById('profilePhoto');
    const profileName = document.getElementById('profileName');
    const profileSchool = document.getElementById('profileSchool').querySelector('span');
    const profileHobbies = document.getElementById('profileHobbies');
    const followBtn = document.getElementById('followBtn');
    const messageBtn = document.getElementById('messageBtn');
    const postsContainer = document.getElementById('postsContainer');
    const friendsGrid = document.getElementById('friendsGrid');
    const postsSection = document.getElementById('postsSection');
    const friendsSection = document.getElementById('friendsSection');
    const profileTabs = document.querySelectorAll('.profile-tab');
    const logoutButton = document.getElementById('logout-btn');
    const postTemplate = document.getElementById('post-template');
    const commentTemplate = document.getElementById('comment-template');

    let currentUser = null;
    let currentUserProfile = null; // Perfil de quem está logado
    let profileUser = null;          // Perfil de quem estamos visitando
    let profileUserId = null;        // ID de quem estamos visitando
    let isFriend = false;
    let likeInProgress = {};
    let commentLikeInProgress = {};
     let postsListener = null;
    let lastVisiblePost = null;
     let isLoadingMorePosts = false;
     let activeCommentListeners = {}; // Armazena os listeners de comentários ativos

    // ==========================================================
    // LÓGICA PRINCIPAL DA PÁGINA
   
    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadCurrentUserProfile(user.uid);
            
            const urlParams = new URLSearchParams(window.location.search);
            profileUserId = urlParams.get('uid');
            
            if (!profileUserId) {
                window.location.href = '../home/home.html';
                return;
            }
            const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink) {
            // Define o link para a página do utilizador logado (user.html) com o UID correto
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }
            
            if (profileUserId === currentUser.uid) {
                if (followBtn) followBtn.style.display = 'none';
                if (messageBtn) messageBtn.style.display = 'none';
                const profileActions = document.querySelector('.profile-actions');
                if (profileActions && !document.getElementById('editProfileBtn')) {
                    const editProfileBtn = document.createElement('button');
                    editProfileBtn.className = 'profile-btn message-btn';
                    editProfileBtn.id = 'editProfileBtn';
                    editProfileBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Editar Perfil';
                    editProfileBtn.onclick = () => { window.location.href = '../editprofile/edit-profile.html'; };
                    profileActions.appendChild(editProfileBtn);
                }
            } else {
                if (followBtn) followBtn.style.display = 'flex';
                if (messageBtn) messageBtn.style.display = 'flex';
                checkFriendStatus();
            }

            await loadProfileUser(profileUserId);
            loadUserPosts();
            loadUserFriends();
            // Adicionar o listener de scroll para o feed do utilizador
            window.addEventListener('scroll', () => {
                
                // Se o utilizador estiver perto do fundo da página E não estiver a carregar mais posts
                if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200 && !isLoadingMorePosts) {
                    loadMoreUserPosts();
                }
            });
        } else {
            window.location.href = '../login/login.html';
        }
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = '../login/login.html'; });
        });
    }

    profileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            profileTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.tab;
            if (tabName === 'posts') {
                postsSection.style.display = 'block';
                friendsSection.style.display = 'none';
            } else if (tabName === 'friends') {
                postsSection.style.display = 'none';
                friendsSection.style.display = 'block';
            }
        });
    });

    if (followBtn) {
        followBtn.addEventListener('click', toggleFriendship);
    }
    if (messageBtn) {
        messageBtn.addEventListener('click', () => { window.location.href = `../mensagen/mensagens.html?uid=${profileUserId}`; });
    }

    // ==========================================================
    // FUNÇÕES DE CARREGAMENTO DE DADOS (Firestore)
    // ==========================================================

    async function loadCurrentUserProfile(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) currentUserProfile = doc.data();
    }

    // EM pages/user.js

async function loadProfileUser(userId) {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
        profileUser = doc.data();

        // --- INÍCIO DA LÓGICA DE PRIVACIDADE ---
        const settings = profileUser.settings || { profilePublic: true };
        const isPublic = settings.profilePublic;
        const isMyProfile = currentUser.uid === userId;

        // Verifica se o perfil é privado e se o visitante não é o dono
        if (!isPublic && !isMyProfile) {
            // Checa se são amigos
            const friendDoc = await db.collection('users').doc(currentUser.uid).collection('friends').doc(userId).get();
            if (!friendDoc.exists) {
                // Se não forem amigos, bloqueia o conteúdo
                document.getElementById('postsSection').innerHTML = '<div class="no-content"><i class="fas fa-lock"></i> Este perfil é privado.</div>';
                document.getElementById('friendsSection').innerHTML = '<div class="no-content"><i class="fas fa-lock"></i> Este perfil é privado.</div>';
                // Esconde os botões de abas (posts/amigos)
                document.querySelector('.profile-tabs').style.display = 'none';
            }
        }
        // --- FIM DA LÓGICA DE PRIVACIDADE ---

        updateProfileUI();
    } else {
        window.location.href = '../home/home.html';
    }
}
    function updateProfileUI() {
        if (profileUser.photoURL) profilePhoto.src = profileUser.photoURL;
        profileName.textContent = profileUser.nickname || 'Usuário';
        profileSchool.textContent = profileUser.school || 'Escola não informada';
        profileHobbies.innerHTML = '';
        const hobbies = [...(profileUser.hobbies || []), ...(profileUser.customHobbies || [])];
        if (hobbies.length > 0) {
            hobbies.forEach(hobby => {
                const hobbyTag = document.createElement('span');
                hobbyTag.className = 'hobby-tag';
                hobbyTag.textContent = hobby;
                profileHobbies.appendChild(hobbyTag);
            });
        } else {
            profileHobbies.innerHTML = '<span class="hobby-tag">Nenhum hobby informado</span>';
        }
    }
    function updateFriendButton() {
    if (isFriend) {
        followBtn.innerHTML = '<i class="fas fa-user-check"></i> Seguindo';
        followBtn.classList.add('following');
    } else {
        followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Seguir';
        followBtn.classList.remove('following');
    }
}

    // Em pages/user.js

async function checkFriendStatus() {
    // 1. Verifica se já são amigos (isto não muda)
    const friendDoc = await db.collection('users').doc(currentUser.uid).collection('friends').doc(profileUserId).get();
    if (friendDoc.exists) {
        isFriend = true;
        updateFriendButton();
        return;
    }

    // 2. Verifica se existe um pedido pendente na nova coleção principal
    // Verifica se eu enviei um pedido para eles
    const sentRequestQuery = db.collection('friendRequests')
        .where('from', '==', currentUser.uid)
        .where('to', '==', profileUserId)
        .where('status', '==', 'pending');
    
    // Verifica se eles me enviaram um pedido
    const receivedRequestQuery = db.collection('friendRequests')
        .where('from', '==', profileUserId)
        .where('to', '==', currentUser.uid)
        .where('status', '==', 'pending');
    
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
        sentRequestQuery.get(),
        receivedRequestQuery.get()
    ]);
    
    if (!sentSnapshot.empty) {
        isFriend = 'pending'; // Eu enviei o pedido
    } else if (!receivedSnapshot.empty) {
        isFriend = 'respond'; // Eles enviaram um pedido, preciso de responder
    } else {
        isFriend = false; // Não há pedidos nem amizade
    }
    updateFriendButton();
}

function updateFriendButton() {
    if (!followBtn) return;
    
    // Desativa e reativa o botão para evitar cliques duplos e reatribuir o evento de clique
    followBtn.disabled = true;

    if (isFriend === true) {
        followBtn.innerHTML = '<i class="fas fa-user-check"></i> Seguindo';
        followBtn.classList.add('following');
        followBtn.onclick = toggleFriendship; // Função para deixar de seguir
    } else if (isFriend === 'pending') {
        followBtn.innerHTML = '<i class="fas fa-clock"></i> Pendente';
        followBtn.classList.add('following'); 
        // Ação de clique é desativada ao final da função
    } else if (isFriend === 'respond') {
        followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Responder Solicitação';
        followBtn.classList.remove('following');
        // Redireciona para a página de notificações para aceitar/recusar
        followBtn.onclick = () => { window.location.href = '../pages/notificacao.html'; }; 
    } else {
        followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Seguir';
        followBtn.classList.remove('following');
        followBtn.onclick = toggleFriendship; // Função para seguir
    }
    
    // Reativa o botão, exceto se o estado for 'pending'
    followBtn.disabled = (isFriend === 'pending');
}
// Em pages/user.js

async function toggleFriendship() {
    // --- INÍCIO DA CORREÇÃO DE SEGURANÇA ---
    if (!currentUserProfile || !currentUserProfile.nickname) {
        showToast("Seu perfil ainda não foi carregado, tente novamente em um instante.", "error");
        return;
    }
    // --- FIM DA CORREÇÃO DE SEGURANÇA ---

    followBtn.disabled = true;

    if (isFriend === true) { // Deixar de seguir
        // ... seu código de deixar de seguir continua aqui ...
    } else if (isFriend === false) { // Enviar pedido
        try {
            const requestId = [currentUser.uid, profileUserId].sort().join('_');
            const requestRef = db.collection('friendRequests').doc(requestId);
            const notificationRef = db.collection("users").doc(profileUserId).collection("notifications").doc();
            const batch = db.batch();

            batch.set(requestRef, {
                from: currentUser.uid,
                to: profileUserId,
                fromUserName: currentUserProfile.nickname, // Agora é seguro usar
                fromUserPhoto: currentUserProfile.photoURL || null, // Agora é seguro usar
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            batch.set(notificationRef, {
                type: 'friend_request',
                fromUserId: currentUser.uid,
                fromUserName: currentUserProfile.nickname,
                fromUserPhoto: currentUserProfile.photoURL || null,
                content: 'enviou uma solicitação de amizade',
                requestId: requestRef.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            await batch.commit();
            
            isFriend = 'pending';
            updateFriendButton();
            // REMOVI o showToast daqui para evitar a mensagem duplicada

        } catch (error) {
            console.error("Erro ao enviar solicitação:", error);
            showToast("Erro ao enviar solicitação: " + error.message, "error");
            isFriend = false;
            updateFriendButton();
        }
    }
}
    function loadUserPosts() {
    postsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    isLoadingMorePosts = true; // Previne carregamentos duplicados

    const query = db.collection('posts')
        .where('authorId', '==', profileUserId)
        .orderBy('timestamp', 'desc')
        .limit(10); // Carrega os primeiros 10 posts

    query.get().then(snapshot => {
        postsContainer.innerHTML = '';
        if (snapshot.empty) {
            postsContainer.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Nenhuma publicação foi feita ainda.</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const postElement = addPostToDOM({ id: doc.id, ...doc.data() });
            if (postElement) {
                postsContainer.appendChild(postElement);
            }
        });

        // Guarda a referência do último post para a próxima consulta
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        isLoadingMorePosts = false;
    });
}
async function loadMoreUserPosts() {
    if (!lastVisiblePost) return; // Não carrega mais se a primeira página não carregou

    isLoadingMorePosts = true;
    
    // Opcional: Adicionar um indicador de "a carregar mais" no fundo da página
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    postsContainer.appendChild(loadingIndicator);

    const query = db.collection('posts')
        .where('authorId', '==', profileUserId)
        .orderBy('timestamp', 'desc')
        .startAfter(lastVisiblePost) // Começa a busca depois do último post visível
        .limit(10); // Carrega mais 10 posts

    const snapshot = await query.get();
    
    // Remove o indicador de "a carregar mais"
    loadingIndicator.remove();

    if (snapshot.empty) {
        lastVisiblePost = null; // Indica que não há mais posts para carregar
        isLoadingMorePosts = false;
        return;
    }

    snapshot.forEach(doc => {
        const postElement = addPostToDOM({ id: doc.id, ...doc.data() });
        if (postElement) {
            postsContainer.appendChild(postElement);
        }
    });

    lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
    isLoadingMorePosts = false;
}

    // ==========================================================
    //      INÍCIO DA CORREÇÃO 2: CARREGAR AMIGOS
    // ==========================================================
    async function loadUserFriends() {
        friendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    
        try {
            // CORREÇÃO: A consulta agora aponta para a coleção 'friends'
            const friendsSnapshot = await db.collection('users').doc(profileUserId)
                .collection('friends').limit(12).get();
    
            if (friendsSnapshot.empty) {
                friendsGrid.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Este usuário ainda não possui amigos.</div>';
                return;
            }
    
            friendsGrid.innerHTML = ''; // Limpa o "a carregar"
            friendsSnapshot.forEach(doc => {
                addFriendToDOM({ id: doc.id, ...doc.data() });
            });
        } catch (error) {
            console.error("Erro ao carregar amigos:", error);
            friendsGrid.innerHTML = '<div class="error-message">Ocorreu um erro ao carregar os amigos.</div>';
        }
    }
    // ==========================================================
    //      FIM DA CORREÇÃO 2
    // ==========================================================

    function addFriendToDOM(friend) {
        const friendLink = document.createElement('a');
        friendLink.href = `user.html?uid=${friend.id}`;
        friendLink.className = 'friend-card';
    
        const friendAvatar = document.createElement('img');
        friendAvatar.src = friend.photoURL || '../img/Design sem nome2.png';
        friendAvatar.alt = 'Foto de perfil';
        friendAvatar.className = 'friend-avatar';
    
        const friendName = document.createElement('h4');
        friendName.className = 'friend-name';
        friendName.textContent = friend.nickname || 'Usuário';

        friendLink.appendChild(friendAvatar);
        friendLink.appendChild(friendName);
    
        friendsGrid.appendChild(friendLink);
    }

    function addPostToDOM(post, isSingleView = false) {
        if (!postsContainer || !postTemplate) return;
    
        const postClone = document.importNode(postTemplate.content, true);
        const postElement = postClone.querySelector(".post");
    
        // Lógica de clique para abrir a visualização de post único
        if (!isSingleView && !post.isRepost) {
            postElement.style.cursor = 'pointer';
            postElement.addEventListener('click', (e) => {
                // Impede a navegação se o clique for em um elemento interativo
                if (e.target.closest('button, a, .post-actions, .post-comments, .original-post-container, .post-image')) {
                    return;
                }
                window.location.href = `../home/home.html?post=${post.id}`;
            });
        }
    
        // Lógica para tratar e exibir uma republicação
        if (post.isRepost) {
            const repostHeader = document.createElement('div');
            repostHeader.className = 'repost-header';
            repostHeader.innerHTML = `<i class="fas fa-retweet"></i> <strong>${post.authorName}</strong> republicou`;
            postElement.insertBefore(repostHeader, postElement.querySelector('.post-header'));
    
            const originalPostContainer = document.createElement('div');
            originalPostContainer.className = 'original-post-container';
            const originalPostHeader = postClone.querySelector('.post-header');
            const originalPostContent = postClone.querySelector('.post-content');
            
            originalPostContainer.appendChild(originalPostHeader);
            originalPostContainer.appendChild(originalPostContent);
            
            originalPostContainer.style.cursor = 'pointer';
            originalPostContainer.addEventListener('click', () => {
                window.location.href = `../home/home.html?post=${post.originalPostId}`;
            });
    
            postElement.insertBefore(originalPostContainer, postElement.querySelector('.post-actions'));
    
            const postActions = postClone.querySelector('.post-actions');
            if (postActions) {
                postActions.style.display = 'none';
            }
    
            // Sobrescreve os dados do post com os dados do post original para exibição
            post.content = post.originalPost.content;
            post.authorName = post.originalPost.authorName;
            post.authorPhoto = post.originalPost.authorPhoto;
            post.timestamp = post.originalPost.timestamp;
            post.authorId = post.originalPost.authorId;
            post.imageUrl = post.originalPost.imageUrl; // Garante que a imagem do post original seja usada
        }
    
        // --- Seleciona todos os elementos do post ---
        const authorPhotoElement = postClone.querySelector(".post-author-photo");
        const authorNameElement = postClone.querySelector(".post-author-name");
        const timestampElement = postClone.querySelector(".post-timestamp");
        const contentElement = postClone.querySelector(".post-text");
        const likeButton = postClone.querySelector(".like-btn");
        const likeCount = postClone.querySelector(".like-count");
        const commentButton = postClone.querySelector(".comment-btn");
        const commentCount = postClone.querySelector(".comment-count");
        const repostButton = postClone.querySelector(".repost-btn");
        const saveButton = postClone.querySelector(".save-btn");
        const shareButton = postClone.querySelector(".share-btn");
        const commentsSection = postClone.querySelector(".post-comments");
        const commentInput = postClone.querySelector(".comment-text");
        const sendCommentButton = postClone.querySelector(".send-comment-btn");
        const commentUserPhoto = postClone.querySelector(".comment-user-photo");
        const postMediaContainer = postClone.querySelector(".post-media");
        const postImageElement = postClone.querySelector(".post-image");
        const deletePostBtn = postClone.querySelector('.post-delete-btn');
    
        // --- Preenche os dados do post ---
        postElement.dataset.postId = post.id;
        postElement.dataset.authorId = post.authorId;
    
        if (post.authorPhoto) authorPhotoElement.src = post.authorPhoto;
        authorNameElement.textContent = post.authorName;
        if (post.timestamp) {
            const date = post.timestamp.toDate();
            timestampElement.textContent = formatTimestamp(date);
        }
        contentElement.textContent = post.content;
        likeCount.textContent = post.likes || 0;
        commentCount.textContent = post.commentCount || 0;
    
        if (post.likedBy && post.likedBy.includes(currentUser.uid)) {
            likeButton.classList.add("liked");
        }
        if (post.savedBy && post.savedBy.includes(currentUser.uid)) {
            saveButton.classList.add("saved");
        }
        if (currentUserProfile && currentUserProfile.photoURL) {
          commentUserPhoto.src = currentUserProfile.photoURL;
        }
    
        // --- Lógica para Imagem e Botão de Excluir ---
        if (post.imageUrl) {
            postImageElement.src = post.imageUrl;
            postMediaContainer.style.display = 'block';
        } else {
            postMediaContainer.style.display = 'none';
        }
    
        if (!post.isRepost && post.authorId === currentUser.uid) {
            deletePostBtn.style.display = 'block';
            deletePostBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePost(post.id);
            });
        }
    
        // --- Adiciona os Event Listeners ---
        authorPhotoElement.addEventListener("click", () => redirectToUserProfile(post.authorId));
        authorNameElement.addEventListener("click", () => redirectToUserProfile(post.authorId));
        likeButton.addEventListener("click", () => toggleLike(post.id));
        saveButton.addEventListener("click", (e) => toggleSavePost(post.id, e.currentTarget));
        repostButton.addEventListener("click", (e) => toggleRepost(post.id, e.currentTarget));
        shareButton.addEventListener("click", () => sharePost(post.id));
    
        commentButton.addEventListener("click", () => {
            commentsSection.classList.toggle("active");
            if (commentsSection.classList.contains("active")) {
                const commentsList = commentsSection.querySelector('.comments-list');
                if (activeCommentListeners[post.id]) {
                    activeCommentListeners[post.id]();
                }
                activeCommentListeners[post.id] = loadComments(post.id, commentsList);
            } else {
                if (activeCommentListeners[post.id]) {
                    activeCommentListeners[post.id]();
                    delete activeCommentListeners[post.id];
                }
            }
        });
    
        sendCommentButton.addEventListener("click", () => {
            const content = commentInput.value.trim();
            if (content) {
                addComment(post.id, content);
                commentInput.value = "";
            }
        });
        
        commentInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const content = commentInput.value.trim();
                if (content) {
                    addComment(post.id, content);
                    commentInput.value = "";
                }
            }
        });
    
        return postElement;  
    }
    function formatTimestamp(date) { 
    if (!(date instanceof Date) || isNaN(date)) {
      return "Agora mesmo";
    }

    const now = new Date();
    const diff = now - date;

    if (diff < 60 * 1000) {
      return "Agora mesmo";
    }

    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} ${minutes === 1 ? "minuto" : "minutos"} atrás`;
    }

    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} ${hours === 1 ? "hora" : "horas"} atrás`;
    }

    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} ${days === 1 ? "dia" : "dias"} atrás`;
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day}/${month}/${year} às ${hours}:${minutes}`; 
}

   async function toggleLike(postId) {  
        try {
            if (likeInProgress[postId]) {
                return;
            }
            likeInProgress[postId] = true;

            if (!currentUser) {
                showCustomAlert("Você precisa estar logado para curtir.");
                likeInProgress[postId] = false;
                return;
            }

            const postRef = db.collection("posts").doc(postId);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                console.error("Post não encontrado.");
                likeInProgress[postId] = false;
                return;
            }

            const postData = postDoc.data();
            const likedBy = postData.likedBy || [];
            const isLiked = likedBy.includes(currentUser.uid);

            const likeButton = document.querySelector(`.post[data-post-id="${postId}"] .like-btn`);
            const likeIcon = likeButton.querySelector("i");
            const likeCountElement = document.querySelector(`.post[data-post-id="${postId}"] .like-count`);

            if (isLiked) {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                });
                likeButton.classList.remove("liked");
                likeIcon.className = "far fa-heart";
                likeCountElement.textContent = Math.max(0, parseInt(likeCountElement.textContent) - 1);
            } else {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                });
                likeButton.classList.add("liked");
                likeIcon.className = "fas fa-heart";
                likeCountElement.textContent = parseInt(likeCountElement.textContent) + 1;

                if (postData.authorId !== currentUser.uid) {
                    await db.collection("users").doc(postData.authorId).collection("notifications").add({
                        type: "like",
                        postId,
                        fromUserId: currentUser.uid,
                        fromUserName: currentUserProfile.nickname || "Usuário",
                        fromUserPhoto: currentUserProfile.photoURL || null,
                        content: "curtiu sua publicação",
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                }
            }
            likeInProgress[postId] = false;
        } catch (error) {
            console.error("Erro ao curtir post:", error);
            likeInProgress[postId] = false;
        } 
    }

    async function toggleRepost(postId, buttonElement) {  
        try {
            if (!currentUser || !currentUserProfile) {
                showCustomAlert("Você precisa estar logado para republicar.");
                return;
            }

            const postRef = db.collection("posts").doc(postId);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                showCustomAlert("Esta publicação não existe mais.");
                return;
            }
            
            const originalPostData = postDoc.data();

            if (originalPostData.isRepost) {
                showCustomAlert("Não é possível republicar uma republicação.");
                return;
            }

            const repostedBy = originalPostData.repostedBy || [];
            const hasReposted = repostedBy.includes(currentUser.uid);
            
            const repostButtonUI = buttonElement || document.querySelector(`.post[data-post-id="${postId}"] .repost-btn`);

            if (hasReposted) {
                const repostQuery = db.collection("posts")
                    .where("originalPostId", "==", postId)
                    .where("authorId", "==", currentUser.uid);
                
                const repostSnapshot = await repostQuery.get();
                if (!repostSnapshot.empty) {
                    const deletePromises = [];
                    repostSnapshot.forEach(doc => deletePromises.push(doc.ref.delete()));
                    await Promise.all(deletePromises);
                }

                await postRef.update({
                    repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });

                const repostElementToRemove = document.querySelector(
                    `.post[data-original-post-id="${postId}"][data-author-id="${currentUser.uid}"]`
                );

                if (repostElementToRemove) {
                    repostElementToRemove.remove();
                }

                if (repostButtonUI) {
                    repostButtonUI.classList.remove('reposted');
                    repostButtonUI.innerHTML = `<i class="fas fa-retweet"></i> Republicar`;
                }
                showToast("Republicação removida.", "info");

            } else {
                const repostData = {
                    isRepost: true,
                    originalPostId: postId,
                    originalPost: {
                        content: originalPostData.content,
                        authorName: originalPostData.authorName,
                        authorPhoto: originalPostData.authorPhoto,
                        authorId: originalPostData.authorId,
                        timestamp: originalPostData.timestamp,
                    },
                    authorId: currentUser.uid,
                    authorName: currentUserProfile.nickname || "Usuário",
                    authorPhoto: currentUserProfile.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: 0,
                    likedBy: [],
                    commentCount: 0,
                };

                await db.collection("posts").add(repostData);

                await postRef.update({
                    repostedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                
                if (originalPostData.authorId !== currentUser.uid) {
                    await db.collection("users").doc(originalPostData.authorId).collection("notifications").add({
                        type: "repost",
                        postId: postId,
                        fromUserId: currentUser.uid,
                        fromUserName: currentUserProfile.nickname || "Usuário",
                        fromUserPhoto: currentUserProfile.photoURL || null,
                        content: "republicou sua publicação.",
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false,
                    });
                }
                
                if (repostButtonUI) {
                    repostButtonUI.classList.add('reposted');
                    repostButtonUI.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
                }
                showToast("Publicação republicada!", "success");
            }

        } catch (error) {
            console.error("Erro ao republicar/desrepublicar:", error);
            showCustomAlert("Ocorreu um erro. Tente novamente.");
        }
    }

    async function toggleSavePost(postId, buttonElement) { 
        if (!currentUser) {
            showCustomAlert("Você precisa estar logado para salvar publicações.");
            return;
        }

        const postRef = db.collection("posts").doc(postId);
        try {
            const doc = await postRef.get();
            if (!doc.exists) return;

            const postData = doc.data();
            const savedBy = postData.savedBy || [];
            const isSaved = savedBy.includes(currentUser.uid);

            const saveButtonUI = buttonElement || document.querySelector(`.post[data-post-id="${postId}"] .save-btn`);

            if (isSaved) {
                await postRef.update({
                    savedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
                if (saveButtonUI) {
                    saveButtonUI.classList.remove('saved');
                    saveButtonUI.innerHTML = `<i class="far fa-bookmark"></i> Salvar`;
                }
            } else {
                await postRef.update({
                    savedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                if (saveButtonUI) {
                    saveButtonUI.classList.add('saved');
                    saveButtonUI.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
                }
            }
        } catch (error) {
            console.error("Erro ao salvar/remover post:", error);
            showCustomAlert("Ocorreu um erro ao tentar salvar a publicação.");
        } 
    }

  /**
     * Gera e copia o link de um post para a área de transferência.
     * O link sempre apontará para a home.html para uma visualização única.
     * @param {string} postId O ID do post a ser compartilhado.
     */
  async function sharePost(postId) {
    const homeUrl = new URL('../home/home.html', window.location.href).href;
    const postUrl = `${homeUrl}?post=${postId}`;

    try {
        await navigator.clipboard.writeText(postUrl);
        showToast("Link da publicação copiado!", "success");
    } catch (error) {
        console.error("Erro ao copiar o link:", error);
        showCustomAlert(`Não foi possível copiar o link. Copie manualmente: ${postUrl}`);
    }
}

    function loadComments(postId, commentsListElement) { 
        if (!commentsListElement) {
            console.error("Elemento da lista de comentários não foi fornecido para loadComments.");
            return;
        }

        if (commentsListElement.innerHTML === '') {
            commentsListElement.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando comentários...</div>';
        }

        return db.collection("posts").doc(postId).collection("comments").orderBy("timestamp", "asc")
            .onSnapshot((snapshot) => {
                const initialMessage = commentsListElement.querySelector('.loading-comments, .no-comments');
                if (initialMessage) {
                    initialMessage.remove();
                }

                snapshot.docChanges().forEach((change) => {
                    const commentData = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === "added") {
                        addCommentToDOM(postId, commentData, commentsListElement);
                    }
                    if (change.type === "modified") {
                        const commentElement = commentsListElement.querySelector(`.comment[data-comment-id="${commentData.id}"]`);
                        if (commentElement) {
                            const likeCount = commentElement.querySelector('.comment-like-count');
                            const likeButton = commentElement.querySelector('.comment-like-btn');
                            if(likeCount) likeCount.textContent = commentData.likes || 0;
                            if(likeButton) {
                                if(commentData.likedBy && commentData.likedBy.includes(currentUser.uid)) {
                                    likeButton.classList.add('liked');
                                } else {
                                    likeButton.classList.remove('liked');
                                }
                            }
                        }
                    }
                    if (change.type === "removed") {
                        const commentElement = commentsListElement.querySelector(`.comment[data-comment-id="${commentData.id}"]`);
                        if (commentElement) {
                            commentElement.remove();
                        }
                    }
                });

                if (commentsListElement.children.length === 0) {
                    commentsListElement.innerHTML = '<div class="no-comments">Nenhum comentário ainda.</div>';
                }
            }, (error) => {
                console.error("Erro ao escutar comentários:", error);
                commentsListElement.innerHTML = '<div class="error-message">Erro ao carregar comentários.</div>';
            });
    }

    function addCommentToDOM(postId, comment, commentsList) { 
        if (!commentTemplate || !commentsList) return;

        const commentClone = document.importNode(commentTemplate.content, true);
        const commentElement = commentClone.querySelector(".comment");
        const authorPhotoElement = commentClone.querySelector(".comment-author-photo");
        const authorNameElement = commentClone.querySelector(".comment-author-name");
        const timestampElement = commentClone.querySelector(".comment-timestamp");
        const contentElement = commentClone.querySelector(".comment-text");
        const likeButton = commentClone.querySelector(".comment-like-btn");
        const likeCount = commentClone.querySelector(".comment-like-count");

        likeButton.addEventListener("click", function () {
            toggleCommentLike(postId, comment.id);
        });

        commentElement.dataset.commentId = comment.id;
        commentElement.dataset.authorId = comment.authorId;

        if (comment.authorPhoto) {
            authorPhotoElement.src = comment.authorPhoto;
        }

        authorPhotoElement.addEventListener("click", function() {
            redirectToUserProfile(comment.authorId);
        });

        authorNameElement.textContent = comment.authorName;
        authorNameElement.addEventListener("click", function() {
            redirectToUserProfile(comment.authorId);
        });

        if (comment.timestamp) {
            const date = comment.timestamp instanceof Date ? comment.timestamp : comment.timestamp.toDate();
            timestampElement.textContent = formatTimestamp(date);
        } else {
            timestampElement.textContent = "Agora mesmo";
        }

        contentElement.textContent = comment.content;
        likeCount.textContent = comment.likes || 0;

        if (comment.likedBy && comment.likedBy.includes(currentUser.uid)) {
            likeButton.classList.add("liked");
        }
        commentsList.appendChild(commentClone);
    }

    async function addComment(postId, content) {
        try {
            if (!currentUser || !currentUserProfile) {
                showCustomAlert("Você precisa estar logado para comentar.");
                return;
            }
    
            const commentData = {
                content,
                authorId: currentUser.uid,
                authorName: currentUserProfile.nickname || "Usuário",
                authorPhoto: currentUserProfile.photoURL || null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [],
            };
    
            const commentRef = await db.collection("posts").doc(postId).collection("comments").add(commentData);
    
            await db.collection("posts").doc(postId).update({
                commentCount: firebase.firestore.FieldValue.increment(1),
            });
            
            // --- INÍCIO DA CORREÇÃO ---
            // Atualiza a contagem de comentários na tela imediatamente.
            const commentCountElement = document.querySelector(`.post[data-post-id="${postId}"] .comment-count`);
            if (commentCountElement) {
                const currentCount = parseInt(commentCountElement.textContent) || 0;
                commentCountElement.textContent = currentCount + 1;
            }
            // --- FIM DA CORREÇÃO ---
    
            const postDoc = await db.collection("posts").doc(postId).get();
            const postData = postDoc.data();
    
            if (postData && postData.authorId !== currentUser.uid) {
                await db.collection("users").doc(postData.authorId).collection("notifications").add({
                    type: "comment",
                    postId,
                    commentId: commentRef.id,
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || "Usuário",
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    content: "comentou em sua publicação",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
            }
        } catch (error) {
            console.error("Erro ao adicionar comentário:", error);
            showCustomAlert("Erro ao adicionar comentário. Tente novamente.");
        }
    }

    function showCustomAlert(message, title = "Aviso") {
        const modal = document.getElementById('customAlertModal');
        const modalTitle = document.getElementById('customAlertTitle');
        const modalMessage = document.getElementById('customAlertMessage');
        const closeBtn = document.getElementById('customAlertCloseBtn');
        const okBtn = document.getElementById('customAlertOkBtn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';

        function closeModal() {
            modal.style.display = 'none';
        }

        closeBtn.onclick = closeModal;
        okBtn.onclick = closeModal;

        window.onclick = function(event) {
            if (event.target == modal) {
                closeModal();
            }
        };
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || document.createElement('div');
        if (!document.getElementById('toast-container')) {
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async function toggleCommentLike(postId, commentId) {
    try {
      const commentKey = `${postId}_${commentId}`;
      if (commentLikeInProgress[commentKey]) {
        return;
      }
      commentLikeInProgress[commentKey] = true;

      if (!currentUser) {
            showCustomAlert("Você precisa estar logado para curtir.");
        commentLikeInProgress[commentKey] = false;
        return;
      }

      const commentRef = db
        .collection("posts")
        .doc(postId)
        .collection("comments")
        .doc(commentId);
      const commentDoc = await commentRef.get();

      if (!commentDoc.exists) {
        console.error("Comentário não encontrado.");
        commentLikeInProgress[commentKey] = false;
        return;
      }

      const commentData = commentDoc.data();
      const likedBy = commentData.likedBy || [];
      const isLiked = likedBy.includes(currentUser.uid);

      if (isLiked) {
        // Ação: REMOVER a curtida do banco de dados
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
        });
      } else {
        // Ação: ADICIONAR a curtida no banco de dados
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        });

        // Criar notificação para o autor do comentário (se não for o próprio usuário)
        if (commentData.authorId !== currentUser.uid) {
          await db
            .collection("users")
            .doc(commentData.authorId)
            .collection("notifications")
            .add({
              type: "comment_like",
              postId,
              commentId,
              fromUserId: currentUser.uid,
              fromUserName: currentUserProfile.nickname || "Usuário",
              fromUserPhoto: currentUserProfile.photoURL || null,
              content: "curtiu seu comentário",
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              read: false,
            });
        }
      }
      // A interface será atualizada automaticamente pelo listener 'onSnapshot'
      commentLikeInProgress[commentKey] = false;
    } catch (error) {
      console.error("Erro ao curtir comentário:", error);
      commentLikeInProgress[`${postId}_${commentId}`] = false;
    }
  }
    
    function redirectToUserProfile(userId) {
        window.location.href = `../pages/user.html?uid=${userId}`;
    }

    /**
     * Exclui uma publicação do Firestore após a confirmação do usuário.
     * @param {string} postId O ID da publicação a ser excluída.
     */
    async function deletePost(postId) {
        if (!confirm("Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.")) {
            return;
        }
        try {
            await db.collection('posts').doc(postId).delete();
            showToast("Publicação excluída com sucesso.", "success");
            // A página recarregará os posts para refletir a mudança
            loadUserPosts(); 
        } catch (error) {
            console.error("Erro ao excluir publicação:", error);
            showCustomAlert("Ocorreu um erro ao excluir a publicação.");
        }
    }


});