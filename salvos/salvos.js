document.addEventListener("DOMContentLoaded", function () {
    // ==========================================================
    // CONFIGURAÇÃO DO FIREBASE
    // ==========================================================
    const firebaseConfig = {
        apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
        authDomain: "tcclogin-7e7b8.firebaseapp.com",
        projectId: "tcclogin-7e7b8",
        storageBucket: "tcclogin-7e7b8.appspot.com",
        messagingSenderId: "1066633833169",
        appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0",
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ==========================================================
    // VARIÁVEIS E REFERÊNCIAS DO DOM
    // ==========================================================
    let currentUser = null;
    let currentUserProfile = null;
    let likeInProgress = {};
    let commentLikeInProgress = {};


    // ACRESCENTE ESTAS VARIÁVEIS

    let activeCommentListeners = {}; // Guarda os listeners de comentários ativos


    const savedPostsContainer = document.getElementById("saved-posts-container");
    const postTemplate = document.getElementById("post-template");
    const commentTemplate = document.getElementById("comment-template");
    const logoutButton = document.getElementById("logout-btn");

    // ==========================================================
    // LÓGICA PRINCIPAL DA PÁGINA
    // ==========================================================

    auth.onAuthStateChanged(async function (user) {
        const profileLink = document.querySelector('.main-nav a.profile-link');
        if (profileLink) {
            // Define o link para a página do utilizador logado (user.html) com o UID correto
            profileLink.href = `../pages/user.html?uid=${user.uid}`;
        }
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            loadSavedPosts();
        } else {
            window.location.href = "../login/login.html";
        }
    });

    // ==========================================================
    // COLE TODAS ESTAS FUNÇÕES DE COMENTÁRIOS NO SEU SCRIPT
    // ==========================================================

    function toggleComments(postId) {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        if (!postElement) return;

        const commentsSection = postElement.querySelector('.post-comments');
        const isActive = commentsSection.classList.toggle('active');

        if (isActive && !activeCommentListeners[postId]) {
            loadComments(postId);
        }
    }

    function loadComments(postId) {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        const commentsList = postElement.querySelector('.comments-list');
        commentsList.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i></div>';

        const commentsRef = db.collection('posts').doc(postId).collection('comments').orderBy('timestamp', 'asc');

        activeCommentListeners[postId] = commentsRef.onSnapshot(snapshot => {
            commentsList.innerHTML = '';
            if (snapshot.empty) {
                commentsList.innerHTML = '<div class="no-comments">Nenhum comentário ainda.</div>';
                return;
            }
            snapshot.forEach(doc => {
                const commentData = { id: doc.id, ...doc.data() };
                addCommentToDOM(postId, commentData);
            });
        }, error => {
            console.error("Erro ao carregar comentários:", error);
            commentsList.innerHTML = '<div class="error-message">Erro ao carregar.</div>';
        });
    }

    function addCommentToDOM(postId, comment) {
        if (!commentTemplate) return;
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        const commentsList = postElement.querySelector('.comments-list');

        const commentClone = document.importNode(commentTemplate.content, true);
        const commentElement = commentClone.querySelector('.comment');

        const authorPhoto = commentClone.querySelector('.comment-author-photo');
        const authorName = commentClone.querySelector('.comment-author-name');
        const text = commentClone.querySelector('.comment-text');
        const timestamp = commentClone.querySelector('.comment-timestamp');
        const likeBtn = commentClone.querySelector('.comment-like-btn');
        const likeCount = commentClone.querySelector('.comment-like-count');
        const deleteBtn = commentClone.querySelector('.comment-delete-btn');

        authorPhoto.src = comment.authorPhoto || '../img/Design sem nome2.png';
        authorName.textContent = comment.authorName;
        text.textContent = comment.content;
        timestamp.textContent = comment.timestamp ? formatTimestamp(comment.timestamp.toDate()) : 'agora';
        likeCount.textContent = comment.likes || 0;

        if (comment.likedBy?.includes(currentUser.uid)) {
            likeBtn.classList.add('liked');
        }

        if (comment.authorId === currentUser.uid) {
            deleteBtn.style.display = 'block';
        }

        likeBtn.addEventListener('click', () => toggleCommentLike(postId, comment.id, comment));
        deleteBtn.addEventListener('click', () => deleteComment(postId, comment.id));

        commentsList.appendChild(commentClone);
    }

    // Em salvos.js
    async function sendComment(postId) {
        const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
        const input = postElement.querySelector('.comment-text');
        const content = input.value.trim();

        if (!content) return;
        input.value = '';

        try {
            const commentRef = db.collection('posts').doc(postId).collection('comments');
            await commentRef.add({
                content,
                authorId: currentUser.uid,
                authorName: currentUserProfile.nickname,
                authorPhoto: currentUserProfile.photoURL,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: []
            });

            const postRef = db.collection('posts').doc(postId);
            await postRef.update({
                commentCount: firebase.firestore.FieldValue.increment(1)
            });

            // --- ADICIONE ESTE BLOCO PARA ATUALIZAR A CONTAGEM NA TELA ---
            const commentCountElement = postElement.querySelector('.comment-count');
            if (commentCountElement) {
                const currentCount = parseInt(commentCountElement.textContent) || 0;
                commentCountElement.textContent = currentCount + 1;
            }
            // --- FIM DO BLOCO A SER ADICIONADO ---
            const commentsSection = postElement.querySelector('.post-comments');
            // Se a secção de comentários estiver fechada, abre-a para mostrar o novo comentário
            if (!commentsSection.classList.contains('active')) {
                toggleComments(postId);
            }
            //
        } catch (error) {
            console.error("Erro ao enviar comentário:", error);
            showCustomAlert("Não foi possível enviar o seu comentário.");
        }
    }
    async function deleteComment(postId, commentId) {
        const confirmed = await showConfirmationModal("Excluir Comentário", "Tem a certeza que deseja excluir este comentário?");
        if (confirmed) {
            try {
                await db.collection('posts').doc(postId).collection('comments').doc(commentId).delete();
                await db.collection('posts').doc(postId).update({
                    commentCount: firebase.firestore.FieldValue.increment(-1)
                });
                showToast("Comentário excluído.", "info");
            } catch (error) {
                console.error("Erro ao excluir comentário:", error);
                showCustomAlert("Ocorreu um erro ao excluir o comentário.");
            }
        }
    }

    async function toggleCommentLike(postId, commentId, commentData) {
        const commentKey = `${postId}_${commentId}`;
        if (commentLikeInProgress[commentKey]) return;
        commentLikeInProgress[commentKey] = true;

        const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
        const isLiked = (commentData.likedBy || []).includes(currentUser.uid);

        try {
            if (isLiked) {
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
            } else {
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                if (commentData.authorId !== currentUser.uid) {
                    // Lógica de notificação (opcional)
                }
            }
            commentLikeInProgress[commentKey] = false;
        } catch (error) {
            console.error("Erro ao curtir comentário:", error);
            commentLikeInProgress[commentKey] = false;
        }
    }

    async function loadUserProfile(userId) {
        const doc = await db.collection("users").doc(userId).get();
        if (doc.exists) {
            currentUserProfile = doc.data();
        }
    }

    async function loadSavedPosts() {
        if (!currentUser) return;
        savedPostsContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        try {
            const snapshot = await db.collection('posts')
                .where('savedBy', 'array-contains', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .get();

            savedPostsContainer.innerHTML = '';

            if (snapshot.empty) {
                savedPostsContainer.innerHTML = '<div class="error-message">Você ainda não salvou nenhuma publicação.</div>';
                return;
            }

            snapshot.forEach(doc => {
                const postData = { id: doc.id, ...doc.data() };
                const postElement = addPostToDOM(postData);
                if (postElement) {
                    savedPostsContainer.appendChild(postElement);
                }
            });

        } catch (error) {
            console.error("Erro ao carregar posts salvos:", error);
            savedPostsContainer.innerHTML = '<div class="error-message">Ocorreu um erro ao buscar suas publicações.</div>';
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", (e) => {
            e.preventDefault();
            auth.signOut().then(() => { window.location.href = "../login/login.html"; });
        });
    }

    // ==========================================================
    // FUNÇÕES DE SUPORTE COMPLETAS
    // ==========================================================




    async function toggleSavePost(postId, buttonElement) {
        if (!currentUser) return;
        const postRef = db.collection("posts").doc(postId);
        const doc = await postRef.get();
        if (!doc.exists) return;

        const postData = doc.data();
        const isSaved = (postData.savedBy || []).includes(currentUser.uid);

        if (isSaved) {
            await postRef.update({
                savedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
            // FIX 3: Remove o post da tela imediatamente
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postElement) postElement.remove();
            showToast("Publicação removida dos salvos.", "info");
        } else {
            await postRef.update({
                savedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
            if (buttonElement) {
                buttonElement.classList.add('saved');
                buttonElement.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
            }
            showToast("Publicação salva!", "success");
        }
    }

    function formatTimestamp(date) {
        if (!(date instanceof Date) || isNaN(date)) return "Agora mesmo";
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return "Agora mesmo";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
        return date.toLocaleDateString('pt-BR');
    }
    // Em salvos.js
    function addPostToDOM(post) {
        if (!savedPostsContainer || !postTemplate) return null;

        const postClone = document.importNode(postTemplate.content, true);
        const postElement = postClone.querySelector(".post");

        // --- Lógica para tratar e exibir uma republicação ---
        if (post.isRepost) {
            // ... (toda a sua lógica de republicação existente pode ser mantida) ...
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
                window.location.href = `../index.html?post=${post.originalPostId}`;
            });

            postElement.insertBefore(originalPostContainer, postElement.querySelector('.post-actions'));

            post.content = post.originalPost.content;
            post.authorName = post.originalPost.authorName;
            post.authorPhoto = post.originalPost.authorPhoto;
            post.timestamp = post.originalPost.timestamp;
            post.authorId = post.originalPost.authorId;
            post.imageUrl = post.originalPost.imageUrl;
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
        const saveButton = postClone.querySelector(".save-btn");
        const commentInput = postClone.querySelector(".comment-text");
        const sendCommentButton = postClone.querySelector(".send-comment-btn");
        const postMediaContainer = postClone.querySelector(".post-media");
        const postImageElement = postClone.querySelector(".post-image");

        // === INÍCIO DA CORREÇÃO ===
        // Seleciona os botões que estavam faltando
        const repostButton = postClone.querySelector(".repost-btn");
        const shareButton = postClone.querySelector(".share-btn");
        // === FIM DA CORREÇÃO ===

        // --- Preenche os dados do post ---
        postElement.dataset.postId = post.id;
        postElement.dataset.authorId = post.authorId;

        if (post.authorPhoto) authorPhotoElement.src = post.authorPhoto;
        authorNameElement.textContent = post.authorName;
        if (post.timestamp) timestampElement.textContent = formatTimestamp(post.timestamp.toDate ? post.timestamp.toDate() : post.timestamp);
        contentElement.textContent = post.content;
        likeCount.textContent = post.likes || 0;
        commentCount.textContent = post.commentCount || 0;

        if (post.likedBy?.includes(currentUser.uid)) likeButton.classList.add("liked");
        if (post.savedBy?.includes(currentUser.uid)) saveButton.classList.add("saved");
        // === INÍCIO DA CORREÇÃO ===
        // Atualiza a aparência do botão de republicar
        if (post.repostedBy?.includes(currentUser.uid)) {
            repostButton.classList.add("reposted");
            repostButton.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
        }
        // === FIM DA CORREÇÃO ===

        // --- Lógica para exibir a imagem do post ---
        if (post.imageUrl) {
            postImageElement.src = post.imageUrl;
            postMediaContainer.style.display = 'block';
        } else {
            postMediaContainer.style.display = 'none';
        }

        // --- Adiciona os Event Listeners ---
        likeButton.addEventListener("click", () => toggleLike(post.id));
        saveButton.addEventListener("click", (e) => toggleSavePost(post.id, e.currentTarget));

        // === INÍCIO DA CORREÇÃO ===
        // Adiciona os listeners que estavam faltando
        repostButton.addEventListener("click", (e) => toggleRepost(post.id, e.currentTarget));
        shareButton.addEventListener("click", () => sharePost(post.id));
        // === FIM DA CORREÇÃO ===

        commentButton.addEventListener("click", () => toggleComments(post.id));
        sendCommentButton.addEventListener("click", () => sendComment(post.id));
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendComment(post.id);
            }
        });

        return postElement;
    }

    function addCommentToDOM(postId, comment, commentsList) {
        if (!commentTemplate || !commentsList) return;
        const commentClone = document.importNode(commentTemplate.content, true);
        const commentElement = commentClone.querySelector(".comment");
        const authorPhotoElement = commentClone.querySelector(".comment-author-photo");
        const authorNameElement = commentClone.querySelector(".comment-author-name");
        const timestampElement = commentClone.querySelector(".comment-timestamp");
        const contentElement = commentClone.querySelector(".comment-text-content");
        const likeButton = commentClone.querySelector(".comment-like-btn");
        const likeCount = commentClone.querySelector(".comment-like-count");

        likeButton.addEventListener("click", () => toggleCommentLike(postId, comment.id));
        commentElement.dataset.commentId = comment.id;
        if (comment.authorPhoto) authorPhotoElement.src = comment.authorPhoto;
        authorNameElement.textContent = comment.authorName;
        if (comment.timestamp) timestampElement.textContent = formatTimestamp(comment.timestamp.toDate());
        contentElement.textContent = comment.content;
        likeCount.textContent = comment.likes || 0;
        if (comment.likedBy && comment.likedBy.includes(currentUser.uid)) {
            likeButton.classList.add("liked");
        }
        commentsList.appendChild(commentClone);
    }



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

        return `${day}/${month}/${year} às ${hours}:${minutes}`;
    }

    async function toggleLike(postId) {
        try {
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
        }
    }
    // Em salvos.js
    async function toggleRepost(basePostId, buttonElement) {
        if (buttonElement) buttonElement.disabled = true;

        try {
            if (!currentUser || !currentUserProfile) {
                showCustomAlert("Você precisa estar logado para republicar.");
                return;
            }

            const postRef = db.collection("posts").doc(basePostId);
            const postDoc = await postRef.get();
            if (!postDoc.exists) {
                showCustomAlert("Esta publicação não existe mais.");
                return;
            }

            const originalPostData = postDoc.data();
            const hasReposted = (originalPostData.repostedBy || []).includes(currentUser.uid);

            if (hasReposted) {
                // --- AÇÃO PARA DESFAZER A REPUBLICAÇÃO ---
                const repostQuery = db.collection("posts")
                    .where("originalPostId", "==", basePostId)
                    .where("authorId", "==", currentUser.uid);

                const repostSnapshot = await repostQuery.get();
                const batch = db.batch();

                repostSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                batch.update(postRef, {
                    repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
                await batch.commit();

                showToast("Republicação removida.", "info");
                // Atualiza a UI do botão
                if (buttonElement) {
                    buttonElement.classList.remove('reposted');
                    buttonElement.innerHTML = `<i class="fas fa-retweet"></i> Republicar`;
                }

            } else {
                // --- AÇÃO PARA CRIAR A REPUBLICAÇÃO ---
                if (originalPostData.authorId === currentUser.uid) {
                    showCustomAlert("Você não pode republicar as suas próprias publicações.");
                    return;
                }
                if (originalPostData.isRepost) {
                    showCustomAlert("Não é possível republicar uma republicação.");
                    return;
                }

                const repostData = {
                    isRepost: true,
                    originalPostId: basePostId,
                    authorId: currentUser.uid,
                    authorName: currentUserProfile.nickname || "Usuário",
                    authorPhoto: currentUserProfile.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                };

                await db.collection("posts").add(repostData);
                await postRef.update({
                    repostedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });

                showToast("Publicação republicada!", "success");
                // Atualiza a UI do botão
                if (buttonElement) {
                    buttonElement.classList.add('reposted');
                    buttonElement.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
                }
            }
        } catch (error) {
            console.error("Erro ao republicar:", error);
            showCustomAlert("Ocorreu um erro ao republicar. Tente novamente.");
        } finally {
            if (buttonElement) buttonElement.disabled = false;
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
        }
    }
    /**
  * Exclui uma publicação do Firestore após a confirmação do usuário.
  * @param {string} postId O ID da publicação a ser excluída.
  */
    async function deletePost(postId) {
        // Pede confirmação ao usuário antes de prosseguir
        if (!confirm("Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.")) {
            return;
        }

        try {
            // Acessa o documento do post no Firestore e o exclui
            await db.collection('posts').doc(postId).delete();

            // Exibe uma notificação de sucesso para o usuário
            showToast("Publicação excluída com sucesso.", "success");

            // Nota: O listener onSnapshot que carrega os posts cuidará
            // de remover o elemento da tela automaticamente.

        } catch (error) {
            console.error("Erro ao excluir publicação:", error);
            showCustomAlert("Ocorreu um erro ao excluir a publicação.");
        }
    }

    /**
    * Gera e copia o link de um post para a área de transferência.
    * O link sempre apontará para a home.html para uma visualização única.
    * @param {string} postId O ID do post a ser compartilhado.
    */
    async function sharePost(postId) {
        // Constrói a URL correta, garantindo que ela aponte para a home
        const homeUrl = new URL('../index.html', window.location.href).href;
        const postUrl = `${homeUrl}?post=${postId}`;

        try {
            // Usa a API de Clipboard do navegador para copiar a URL
            await navigator.clipboard.writeText(postUrl);

            // Exibe uma notificação de sucesso
            showToast("Link da publicação copiado!", "success");

        } catch (error) {
            console.error("Erro ao copiar o link:", error);

            // Se a cópia automática falhar, mostra um alerta com o link
            showCustomAlert(`Não foi possível copiar o link. Copie manualmente: ${postUrl}`);
        }
    }

    // Lembre-se de ter as funções showToast e showCustomAlert no seu salvos.js
    // para que as notificações e alertas funcionem corretamente.


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

    // Função para alternar curtida em um comentário


});