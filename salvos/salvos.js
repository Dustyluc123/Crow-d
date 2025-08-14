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

    const savedPostsContainer = document.getElementById("saved-posts-container");
    const postTemplate = document.getElementById("post-template");
    const commentTemplate = document.getElementById("comment-template");
    const logoutButton = document.getElementById("logout-btn");

    // ==========================================================
    // LÓGICA PRINCIPAL DA PÁGINA
    // ==========================================================

    auth.onAuthStateChanged(async function (user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            loadSavedPosts();
        } else {
            window.location.href = "../login/login.html";
        }
    });
    
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
    
    function showCustomAlert(message) {
        alert(message); // Usando alert padrão como fallback
    }

    function addPostToDOM(post) {
        // FIX 1: A verificação agora usa 'savedPostsContainer' e 'postTemplate'
        if (!savedPostsContainer || !postTemplate) return null;

        const postClone = document.importNode(postTemplate.content, true);
        const postElement = postClone.querySelector(".post");
        
        // FIX 2: Clicar em um post aqui redireciona para a home para visualização única
        postElement.addEventListener('click', (e) => {
            if (e.target.closest('button, a, .post-actions, .post-comments, .original-post-container')) {
                return;
            }
            window.location.href = `../home/home.html?post=${post.id}`;
        });

        // O resto da sua função addPostToDOM...
        postElement.dataset.postId = post.id;
        postElement.dataset.authorId = post.authorId;
        
        if(post.isRepost) {
            postElement.dataset.originalPostId = post.originalPostId;
            // Lógica de exibição de repost...
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

        if (post.authorPhoto) authorPhotoElement.src = post.authorPhoto;
        authorNameElement.textContent = post.authorName;
        if (post.timestamp) {
            const date = post.timestamp.toDate();
            timestampElement.textContent = formatTimestamp(date);
        }
        contentElement.textContent = post.content;
        likeCount.textContent = post.likes || 0;
        commentCount.textContent = post.commentCount || 0;

        if (post.likedBy && post.likedBy.includes(currentUser.uid)) likeButton.classList.add("liked");
        if (post.repostedBy && post.repostedBy.includes(currentUser.uid)) {
            repostButton.classList.add("reposted");
            repostButton.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
        }
        if (post.savedBy && post.savedBy.includes(currentUser.uid)) {
            saveButton.classList.add("saved");
            saveButton.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
        }
        if(currentUserProfile && currentUserProfile.photoURL) commentUserPhoto.src = currentUserProfile.photoURL;

        authorPhotoElement.addEventListener("click", () => redirectToUserProfile(post.authorId));
        authorNameElement.addEventListener("click", () => redirectToUserProfile(post.authorId));
        likeButton.addEventListener("click", () => toggleLike(post.id));
        repostButton.addEventListener("click", (e) => toggleRepost(post.id, e.currentTarget));
        saveButton.addEventListener("click", (e) => toggleSavePost(post.id, e.currentTarget));
        shareButton.addEventListener("click", () => sharePost(post.id));

        commentButton.addEventListener("click", () => {
            commentsSection.classList.toggle("active");
            if (commentsSection.classList.contains("active")) {
                const commentsList = commentsSection.querySelector('.comments-list');
                loadComments(post.id, commentsList);
            }
        });
        sendCommentButton.addEventListener("click", () => {
            const content = commentInput.value.trim();
            if(content) addComment(post.id, content);
            commentInput.value = '';
        });

        return postElement;
    }

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
            if(postElement) postElement.remove();
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

    // --- FUNÇÕES ADICIONADAS QUE ESTAVAM FALTANDO ---

    function formatTimestamp(date) {
        if (!(date instanceof Date) || isNaN(date)) return "Agora mesmo";
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return "Agora mesmo";
        if (diff < 3600000) return `${Math.floor(diff/60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
        return date.toLocaleDateString('pt-BR');
    }

    async function toggleLike(postId) { /* ... Cole sua função toggleLike aqui ... */ }
    async function toggleRepost(postId, buttonElement) { /* ... Cole sua função toggleRepost aqui ... */ }
    function loadComments(postId, commentsListElement) { /* ... Cole sua função loadComments aqui ... */ }
    
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

    async function addComment(postId, content) { /* ... Cole sua função addComment aqui ... */ }
    async function toggleCommentLike(postId, commentId) { /* ... Cole sua função toggleCommentLike aqui ... */ }
    function redirectToUserProfile(userId) { window.location.href = `../pages/user.html?uid=${userId}`; }
    async function sharePost(postId) { /* ... Cole sua função sharePost aqui ... */ }
});