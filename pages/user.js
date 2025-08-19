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
    let isFollowing = false;
    let likeInProgress = {};
    let commentLikeInProgress = {};

    // ==========================================================
    // LÓGICA PRINCIPAL DA PÁGINA
    // ==========================================================

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
                checkFollowStatus();
            }

            await loadProfileUser(profileUserId);
            loadUserPosts();
            loadUserFriends();
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
        followBtn.addEventListener('click', toggleFollow);
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

    async function loadProfileUser(userId) {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            profileUser = doc.data();
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

    async function checkFollowStatus() {
        const followDoc = await db.collection('users').doc(currentUser.uid).collection('following').doc(profileUserId).get();
        isFollowing = followDoc.exists;
        updateFollowButton();
    }

    async function toggleFollow() {
        if (!currentUserProfile) {
            alert("Seu perfil não foi carregado. Tente novamente.");
            return;
        }
        try {
            const followingRef = db.collection('users').doc(currentUser.uid).collection('following').doc(profileUserId);
            const followerRef = db.collection('users').doc(profileUserId).collection('followers').doc(currentUser.uid);

            if (isFollowing) {
                await followingRef.delete();
                await followerRef.delete();
            } else {
                await followingRef.set({
                    nickname: profileUser.nickname || 'Usuário',
                    photoURL: profileUser.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                await followerRef.set({
                    nickname: currentUserProfile.nickname || 'Usuário',
                    photoURL: currentUserProfile.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                await db.collection('users').doc(profileUserId).collection('notifications').add({
                    type: 'follow',
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || 'Usuário',
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    content: 'começou a seguir você',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }
            isFollowing = !isFollowing;
            updateFollowButton();
        } catch (error) {
            console.error('Erro ao alternar seguir:', error);
        }
    }

    function updateFollowButton() {
        if (isFollowing) {
            followBtn.innerHTML = '<i class="fas fa-user-check"></i> Seguindo';
            followBtn.classList.add('following');
        } else {
            followBtn.innerHTML = '<i class="fas fa-user-plus"></i> Seguir';
            followBtn.classList.remove('following');
        }
    }

    function loadUserPosts() {
        postsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        db.collection('posts').where('authorId', '==', profileUserId).orderBy('timestamp', 'desc').limit(20)
        .onSnapshot(snapshot => {
            postsContainer.innerHTML = '';
            if (snapshot.empty) {
                postsContainer.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Nenhuma publicação encontrada.</div>';
                return;
            }
            snapshot.forEach(doc => {
                addPostToDOM({ id: doc.id, ...doc.data() });
            });
        });
    }

    async function loadUserFriends() {
        friendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        const followersSnapshot = await db.collection('users').doc(profileUserId).collection('followers').limit(12).get();
        
        if (followersSnapshot.empty) {
            friendsGrid.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Este usuário ainda não tem amigos.</div>';
            return;
        }
        
        friendsGrid.innerHTML = '';
        followersSnapshot.forEach(doc => {
            addFriendToDOM({ id: doc.id, ...doc.data() });
        });
    }

    function addFriendToDOM(friend) {
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-item';
        friendElement.innerHTML = `
            <a href="user.html?uid=${friend.id}">
                <img src="${friend.photoURL || '../img/Design sem nome2.png'}" alt="Foto de perfil" class="friend-photo">
                <p class="friend-name">${friend.nickname || 'Usuário'}</p>
            </a>
        `;
        friendsGrid.appendChild(friendElement);
    }

    function addPostToDOM(post) { 
    
    if (!postsContainer || !postTemplate) return;

    const postClone = document.importNode(postTemplate.content, true);
    const postElement = postClone.querySelector(".post");

    
    if (!isSingleView && !post.isRepost) {
        postElement.style.cursor = 'pointer';
        postElement.addEventListener('click', (e) => {
            // AQUI ESTÁ A MUDANÇA: Adicionamos '.post-comments' à lista para ignorar
            // Agora, cliques nos botões, links, barra de ações E na seção de comentários não levarão ao post único.
            if (e.target.closest('button, a, .post-actions, .post-comments')) {
                return;
            }
            
           window.location.href = `../home/home.html?post=${post.id}`;
        });
    }

    // Se for uma republicação, adicione o cabeçalho e modifique o comportamento
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
        
        // --- INÍCIO DA ALTERAÇÃO ---

        // 1. Adiciona o evento de clique para redirecionar ao post original
        originalPostContainer.style.cursor = 'pointer'; // Muda o cursor para indicar que é clicável
        originalPostContainer.addEventListener('click', () => {
            // Usa o ID do post original para criar o link
            window.location.href = `home.html?post=${post.originalPostId}`;
        });

        postElement.insertBefore(originalPostContainer, postElement.querySelector('.post-actions'));

        // 2. Esconde a barra de ações (curtir, comentar, etc.)
        const postActions = postClone.querySelector('.post-actions');
        if (postActions) {
            postActions.style.display = 'none';
        }

        // --- FIM DA ALTERAÇÃO ---

        // Modifica os dados do post para mostrar o conteúdo original
        post.content = post.originalPost.content;
        post.authorName = post.originalPost.authorName;
        post.authorPhoto = post.originalPost.authorPhoto;
        post.timestamp = post.originalPost.timestamp;
        post.authorId = post.originalPost.authorId;
    }

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

    postElement.dataset.postId = post.id;
    postElement.dataset.authorId = post.authorId;
    postElement.dataset.originalPostId = post.originalPostId;

    if (post.savedBy && post.savedBy.includes(currentUser.uid)) {
        saveButton.classList.add("saved");
        saveButton.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
    }

if (post.repostedBy && post.repostedBy.includes(currentUser.uid)) {
    repostButton.classList.add("reposted");
    // Define o texto inicial como "Republicado"
    repostButton.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
}

    if (post.authorPhoto) authorPhotoElement.src = post.authorPhoto;
    authorPhotoElement.addEventListener("click", () => redirectToUserProfile(post.authorId));

    authorNameElement.textContent = post.authorName;
    authorNameElement.addEventListener("click", () => redirectToUserProfile(post.authorId));

    if (post.timestamp) {
      const date = post.timestamp instanceof Date ? post.timestamp : post.timestamp.toDate();
      timestampElement.textContent = formatTimestamp(date);
    } else {
      timestampElement.textContent = "Agora mesmo";
    }

    contentElement.textContent = post.content;
    likeCount.textContent = post.likes || 0;

    if (post.likedBy && post.likedBy.includes(currentUser.uid)) {
      likeButton.classList.add("liked");
      likeButton.querySelector("i").className = "fas fa-heart";
    }

    commentCount.textContent = post.commentCount || 0;

    if (currentUserProfile && currentUserProfile.photoURL) {
      commentUserPhoto.src = currentUserProfile.photoURL;
    }

    likeButton.addEventListener("click", () => toggleLike(post.id));
    saveButton.addEventListener("click", (e) => toggleSavePost(post.id, e.currentTarget));
    repostButton.addEventListener("click", (e) => toggleRepost(post.id, e.currentTarget));
    shareButton.addEventListener("click", () => sharePost(post.id)); 

 
commentButton.addEventListener("click", () => {
      commentsSection.classList.toggle("active");
      if (commentsSection.classList.contains("active")) {
        // A mesma lógica da alteração 2: encontrar a lista e passá-la
        const commentsList = commentsSection.querySelector('.comments-list');
        if (commentsList) {
            loadComments(post.id, commentsList);
        }
        commentInput.focus();
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
            const content = commentInput.value.trim();
            if (content) {
                addComment(post.id, content);
                commentInput.value = "";
            }
        }
    });

    return postElement;  }
    function formatTimestamp(date) { // Verificar se date é um objeto Date válido
    if (!(date instanceof Date) || isNaN(date)) {
      return "Agora mesmo";
    }

    const now = new Date();
    const diff = now - date;

    // Menos de 1 minuto
    if (diff < 60 * 1000) {
      return "Agora mesmo";
    }

    // Menos de 1 hora
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} ${minutes === 1 ? "minuto" : "minutos"} atrás`;
    }

    // Menos de 1 dia
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} ${hours === 1 ? "hora" : "horas"} atrás`;
    }

    // Menos de 7 dias
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} ${days === 1 ? "dia" : "dias"} atrás`;
    }

    // Formato de data completo
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${day}/${month}/${year} às ${hours}:${minutes}`; }

    async function toggleLike(postId) {  try {
      // Verificar se já há uma operação de like em andamento para este post
      if (likeInProgress[postId]) {
        return;
      }

      // Marcar como em andamento
      likeInProgress[postId] = true;

      // Verificar se o usuário está autenticado
      if (!currentUser) {
            showCustomAlert("Você precisa estar logado para curtir.");
        likeInProgress[postId] = false;
        return;
      }

      // Obter referência ao post
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

      // Atualizar UI imediatamente para feedback rápido
      const likeButton = document.querySelector(
        `.post[data-post-id="${postId}"] .like-btn`
      );
      const likeIcon = likeButton.querySelector("i");
      const likeCountElement = document.querySelector(
        `.post[data-post-id="${postId}"] .like-count`
      );

      if (isLiked) {
        // Remover curtida
        await postRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.remove("liked");
        likeIcon.className = "far fa-heart";
        likeCountElement.textContent = Math.max(
          0,
          parseInt(likeCountElement.textContent) - 1
        );
      } else {
        // Adicionar curtida
        await postRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.add("liked");
        likeIcon.className = "fas fa-heart";
        likeCountElement.textContent =
          parseInt(likeCountElement.textContent) + 1;

        // Criar notificação para o autor do post (se não for o próprio usuário)
        if (postData.authorId !== currentUser.uid) {
          await db
            .collection("users")
            .doc(postData.authorId)
            .collection("notifications")
            .add({
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

      // Marcar como concluído
      likeInProgress[postId] = false;
    } catch (error) {
      console.error("Erro ao curtir post:", error);
      likeInProgress[postId] = false;
    } }
    async function toggleRepost(postId, buttonElement) {  try {
        // 1. VERIFICAÇÕES INICIAIS DE SEGURANÇA
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

        // Impede que alguém republique uma republicação
        if (originalPostData.isRepost) {
            showCustomAlert("Não é possível republicar uma republicação.");
            return;
        }

        // 2. DETERMINA A AÇÃO (REPUBLICAR OU DESFAZER)
        const repostedBy = originalPostData.repostedBy || [];
        const hasReposted = repostedBy.includes(currentUser.uid);
        
        // Pega a referência do botão na tela para poder atualizá-lo
        const repostButtonUI = buttonElement || document.querySelector(`.post[data-post-id="${postId}"] .repost-btn`);

        if (hasReposted) {
            // --- AÇÃO: DESFAZER REPUBLICAÇÃO ---

            // Encontra e deleta a republicação do banco de dados
            const repostQuery = db.collection("posts")
                .where("originalPostId", "==", postId)
                .where("authorId", "==", currentUser.uid);
            
            const repostSnapshot = await repostQuery.get();
            if (!repostSnapshot.empty) {
                const deletePromises = [];
                repostSnapshot.forEach(doc => deletePromises.push(doc.ref.delete()));
                await Promise.all(deletePromises);
            }

            // Remove o usuário da lista de 'repostedBy' no post original
            await postRef.update({
                repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });

            // ATUALIZAÇÃO DA INTERFACE EM TEMPO REAL:
            // Encontra o elemento da republicação que está visível na tela para removê-lo
            const repostElementToRemove = document.querySelector(
                `.post[data-original-post-id="${postId}"][data-author-id="${currentUser.uid}"]`
            );

            // Se o elemento for encontrado, remove-o imediatamente
            if (repostElementToRemove) {
                repostElementToRemove.remove();
            }

            // Atualiza o botão e mostra a notificação
            if (repostButtonUI) {
                repostButtonUI.classList.remove('reposted');
                repostButtonUI.innerHTML = `<i class="fas fa-retweet"></i> Republicar`;
            }
            showToast("Republicação removida.", "info");

        } else {
            // --- AÇÃO: CRIAR REPUBLICAÇÃO ---

            // Cria o objeto da nova publicação
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

            // Adiciona o novo documento de republicação ao banco de dados
            await db.collection("posts").add(repostData);

            // Adiciona o usuário na lista 'repostedBy' do post original
            await postRef.update({
                repostedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
            
            // Envia uma notificação para o autor do post original
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
            
            // Atualiza a interface: adiciona a classe e troca o texto do botão
            if (repostButtonUI) {
                repostButtonUI.classList.add('reposted');
                repostButtonUI.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
            }
            showToast("Publicação republicada!", "success");
        }

    } catch (error) {
        console.error("Erro ao republicar/desrepublicar:", error);
        showCustomAlert("Ocorreu um erro. Tente novamente.");
    }}
    async function toggleSavePost(postId, buttonElement) { if (!currentUser) {
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
            // --- AÇÃO: REMOVER DOS SALVOS ---
            await postRef.update({
                savedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
            if (saveButtonUI) {
                saveButtonUI.classList.remove('saved');
                saveButtonUI.innerHTML = `<i class="far fa-bookmark"></i> Salvar`;
            }
            
        } else {
            // --- AÇÃO: SALVAR O POST ---
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
    } }
    async function sharePost(postId) { // Pega a URL da página atual e remove quaisquer parâmetros antigos (? e #)
    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    
    // Cria a nova URL com o parâmetro do post
    const postUrl = `${cleanUrl}?post=${postId}`;

    try {
      // Usa a API de Clipboard do navegador para copiar a URL
      await navigator.clipboard.writeText(postUrl);
      
      // Mostra uma notificação de sucesso
      showToast("Link da publicação copiado!", "success");

    } catch (error) {
      console.error("Erro ao copiar o link:", error);
      
      // Se a cópia automática falhar, mostra um alerta com o link para cópia manual
      showCustomAlert(`Não foi possível copiar o link. Copie manualmente: ${postUrl}`);
    } }
    function loadComments(postId, commentsListElement) { if (!commentsListElement) {
      console.error("Elemento da lista de comentários não foi fornecido para loadComments.");
      return;
  }

  // Mostra o "Carregando..." apenas se a lista estiver vazia
  if (commentsListElement.innerHTML === '') {
      commentsListElement.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando comentários...</div>';
  }

  return db
    .collection("posts")
    .doc(postId)
    .collection("comments")
    .orderBy("timestamp", "asc") // Usar 'asc' para adicionar novos comentários no final
    .onSnapshot((snapshot) => {
      // Remove o indicador de "carregando" ou "nenhum comentário" se existirem
      const initialMessage = commentsListElement.querySelector('.loading-comments, .no-comments');
      if (initialMessage) {
          initialMessage.remove();
      }

      // ESTA É A MUDANÇA PRINCIPAL:
      // Em vez de apagar tudo, vamos processar apenas as alterações.
      snapshot.docChanges().forEach((change) => {
          const commentData = { id: change.doc.id, ...change.doc.data() };
          
          if (change.type === "added") {
              // Se um novo comentário foi ADICIONADO, nós o criamos e o adicionamos ao final da lista
              // Isso não afeta o que outros usuários estão digitando
              addCommentToDOM(postId, commentData, commentsListElement);
          }
          if (change.type === "modified") {
              // Se um comentário foi MODIFICADO (ex: curtida), encontramos o elemento e o atualizamos
              const commentElement = commentsListElement.querySelector(`.comment[data-comment-id="${commentData.id}"]`);
              if (commentElement) {
                  // Exemplo: atualizar a contagem de curtidas
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
              // Se um comentário foi REMOVIDO, nós o encontramos e o removemos da tela
              const commentElement = commentsListElement.querySelector(`.comment[data-comment-id="${commentData.id}"]`);
              if (commentElement) {
                  commentElement.remove();
              }
          }
      });

      // Se após processar as mudanças a lista estiver vazia, mostramos a mensagem
      if (commentsListElement.children.length === 0) {
          commentsListElement.innerHTML = '<div class="no-comments">Nenhum comentário ainda.</div>';
      }

    }, (error) => {
      console.error("Erro ao escutar comentários:", error);
      commentsListElement.innerHTML = '<div class="error-message">Erro ao carregar comentários.</div>';
    });}
    function addCommentToDOM(postId, comment, commentsList) { if (!commentTemplate || !commentsList) return;

    // Clonar template
    const commentClone = document.importNode(commentTemplate.content, true);
    const commentElement = commentClone.querySelector(".comment");

    // Referências aos elementos do comentário
    const authorPhotoElement = commentClone.querySelector(".comment-author-photo");
    const authorNameElement = commentClone.querySelector(".comment-author-name");
    const timestampElement = commentClone.querySelector(".comment-timestamp");
    const contentElement = commentClone.querySelector(".comment-text");
    const likeButton = commentClone.querySelector(".comment-like-btn");
    const likeCount = commentClone.querySelector(".comment-like-count");

    // ==========================================================
    // ESTA É A PARTE IMPORTANTE QUE ESTAVA FALTANDO
    // Adiciona a ação de clique ao botão de curtir
    likeButton.addEventListener("click", function () {
      toggleCommentLike(postId, comment.id);
    });
    // ==========================================================

    // Definir IDs
    commentElement.dataset.commentId = comment.id;
    commentElement.dataset.authorId = comment.authorId;

    // Definir foto do autor
    if (comment.authorPhoto) {
      authorPhotoElement.src = comment.authorPhoto;
    }

    // Adicionar evento de clique para redirecionar ao perfil do autor
    authorPhotoElement.addEventListener("click", function() {
      redirectToUserProfile(comment.authorId);
    });

    // Definir nome do autor
    authorNameElement.textContent = comment.authorName;
    authorNameElement.addEventListener("click", function() {
      redirectToUserProfile(comment.authorId);
    });

    // Definir timestamp
    if (comment.timestamp) {
      const date = comment.timestamp instanceof Date ? comment.timestamp : comment.timestamp.toDate();
      timestampElement.textContent = formatTimestamp(date);
    } else {
      timestampElement.textContent = "Agora mesmo";
    }

    // Definir conteúdo do comentário
    contentElement.textContent = comment.content;

    // Definir contagem de likes
    likeCount.textContent = comment.likes || 0;

    // Verificar se o usuário atual já curtiu o comentário
    if (comment.likedBy && comment.likedBy.includes(currentUser.uid)) {
      likeButton.classList.add("liked");
    }

    // Adicionar comentário à lista
    commentsList.appendChild(commentClone);}
   async function addComment(postId, content) {
    try {
      // Verificar se o usuário está autenticado
      if (!currentUser || !currentUserProfile) {
            showCustomAlert("Você precisa estar logado para comentar.");
        return;
      }

      // Criar objeto de comentário
      const commentData = {
        content,
        authorId: currentUser.uid,
        authorName: currentUserProfile.nickname || "Usuário",
        authorPhoto: currentUserProfile.photoURL || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0,
        likedBy: [],
      };

      // Adicionar comentário ao Firestore
      const commentRef = await db
        .collection("posts")
        .doc(postId)
        .collection("comments")
        .add(commentData);

      // Incrementar contagem de comentários no post
      await db
        .collection("posts")
        .doc(postId)
        .update({
          commentCount: firebase.firestore.FieldValue.increment(1),
        });



      // Obter dados do post para notificação
      const postDoc = await db.collection("posts").doc(postId).get();
      const postData = postDoc.data();

      // Criar notificação para o autor do post (se não for o próprio usuário)
      if (postData && postData.authorId !== currentUser.uid) {
        await db
          .collection("users")
          .doc(postData.authorId)
          .collection("notifications")
          .add({
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

  // Função para alternar curtida em um comentário
  async function toggleCommentLike(postId, commentId) {
    try {
      // Verificar se já há uma operação de like em andamento para este comentário
      const commentKey = `${postId}_${commentId}`;
      if (commentLikeInProgress[commentKey]) {
        return;
      }

      // Marcar como em andamento
      commentLikeInProgress[commentKey] = true;

      // Verificar se o usuário está autenticado
      if (!currentUser) {
            showCustomAlert("Você precisa estar logado para curtir.");
        commentLikeInProgress[commentKey] = false;
        return;
      }

      // Obter referência ao comentário
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

      // Atualizar UI imediatamente para feedback rápido
      const likeButton = document.querySelector(
        `.comment[data-comment-id="${commentId}"] .comment-like-btn`
      );
      const likeCountElement = document.querySelector(
        `.comment[data-comment-id="${commentId}"] .comment-like-count`
      );

      if (isLiked) {
        // Remover curtida
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.remove("liked");
        likeCountElement.textContent = Math.max(
          0,
          parseInt(likeCountElement.textContent) - 1
        );
      } else {
        // Adicionar curtida
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.add("liked");
        likeCountElement.textContent =
          parseInt(likeCountElement.textContent) + 1;

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

      // Marcar como concluído
      commentLikeInProgress[commentKey] = false;
    } catch (error) {
      console.error("Erro ao curtir comentário:", error);
      commentLikeInProgress[`${postId}_${commentId}`] = false;
    }
}
    async function toggleCommentLike(postId, commentId) {  try {
      // Verificar se já há uma operação de like em andamento para este comentário
      const commentKey = `${postId}_${commentId}`;
      if (commentLikeInProgress[commentKey]) {
        return;
      }

      // Marcar como em andamento
      commentLikeInProgress[commentKey] = true;

      // Verificar se o usuário está autenticado
      if (!currentUser) {
            showCustomAlert("Você precisa estar logado para curtir.");
        commentLikeInProgress[commentKey] = false;
        return;
      }

      // Obter referência ao comentário
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

      // Atualizar UI imediatamente para feedback rápido
      const likeButton = document.querySelector(
        `.comment[data-comment-id="${commentId}"] .comment-like-btn`
      );
      const likeCountElement = document.querySelector(
        `.comment[data-comment-id="${commentId}"] .comment-like-count`
      );

      if (isLiked) {
        // Remover curtida
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.remove("liked");
        likeCountElement.textContent = Math.max(
          0,
          parseInt(likeCountElement.textContent) - 1
        );
      } else {
        // Adicionar curtida
        await commentRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        });

        // Atualizar UI
        likeButton.classList.add("liked");
        likeCountElement.textContent =
          parseInt(likeCountElement.textContent) + 1;

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

      // Marcar como concluído
      commentLikeInProgress[commentKey] = false;
    } catch (error) {
      console.error("Erro ao curtir comentário:", error);
      commentLikeInProgress[`${postId}_${commentId}`] = false;
    } }
});