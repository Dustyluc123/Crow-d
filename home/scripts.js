function redirectToUserProfile(userId) {
    window.location.href = `pages/user.html?uid=${userId}`;
}

// Sistema de postagens e comentários para o Crow-d com Firebase
document.addEventListener("DOMContentLoaded", function () {
    // Configuração do Firebase
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
    const storage = firebase.storage();

    // Referências aos elementos do DOM
    const postInput = document.getElementById("post-content");
    const postButton = document.getElementById("publish-btn");
    const postsContainer = document.getElementById("posts-container");
    const userPhotoElement = document.getElementById("current-user-photo");
    const userHobbiesContainer = document.getElementById("user-hobbies");
    const suggestionsContainer = document.getElementById("suggestions-container");
    const logoutButton = document.getElementById("logout-btn");
    const postTemplate = document.getElementById("post-template");
    const commentTemplate = document.getElementById("comment-template");
    const suggestionTemplate = document.getElementById("suggestion-template");
    const loadingMoreIndicator = document.getElementById("loading-more-indicator");
    const feedView = document.getElementById("feed-view");
    const singlePostView = document.getElementById("single-post-view");
    const focusedPostContainer = document.getElementById("focused-post-container");
    const backToFeedBtn = document.getElementById("back-to-feed-btn");
    const addHobbyBtn = document.getElementById("add-hobby-btn");
    const hobbyModal = document.getElementById("hobby-modal");
    const closeHobbyModalBtn = document.getElementById("close-hobby-modal");
    const confirmHobbiesBtn = document.getElementById("confirm-hobbies-btn");
    const hobbyListContainer = document.getElementById("hobby-list-container");
    const selectedHobbiesContainer = document.getElementById("selected-hobbies-container");
    const replyTargetByPost = new Map();

    let selectedHobbiesForPost = [];

    const hobbiesList = {
        "🎨 Artes": ["Desenho", "Pintura", "Fotografia", "Dança", "Escultura", "Arte Digital", "Teatro", "Caligrafia", "Cerâmica"],
        "🎵 Música": ["Ouvir música", "Tocar instrumento", "Cantar", "Shows", "Produção Musical", "Compor", "DJing", "Colecionar Discos"],
        "💻 Tecnologia": ["Programação", "Jogos", "Robótica", "Design", "Edição de Vídeo", "Streaming", "Montagem de PC", "Cibersegurança"],
        "📚 Cultura Pop": ["Filmes", "Séries", "Animes", "Livros", "Quadrinhos/Mangás", "Ficção Científica", "Fantasia", "Poesia"],
        "🌍 Estilo de Vida & Outros": ["Culinária", "Viagens", "Idiomas", "Voluntariado", "Jardinagem", "Acampar", "Astronomia", "Animais de Estimação"]
    };

    function renderHobbyList() {
        hobbyListContainer.innerHTML = '';
        if (document.getElementById('hobby-search-input')) {
            document.getElementById('hobby-search-input').value = '';
        }
        const checkHobbyLimit = () => {
            const allCheckboxes = hobbyListContainer.querySelectorAll('input[type="checkbox"]');
            const checkedCount = hobbyListContainer.querySelectorAll('input[type="checkbox"]:checked').length;
            if (checkedCount >= 3) {
                allCheckboxes.forEach(cb => {
                    if (!cb.checked) {
                        cb.disabled = true;
                        cb.parentElement.classList.add('disabled');
                    }
                });
            } else {
                allCheckboxes.forEach(cb => {
                    cb.disabled = false;
                    cb.parentElement.classList.remove('disabled');
                });
            }
        };
        for (const category in hobbiesList) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'hobby-category';
            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = category;
            categoryDiv.appendChild(categoryTitle);
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'hobby-options';
            hobbiesList[category].forEach(hobby => {
                const label = document.createElement('label');
                label.className = 'hobby-label';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = hobby;
                const span = document.createElement('span');
                span.textContent = hobby;
                if (selectedHobbiesForPost.includes(hobby)) {
                    checkbox.checked = true;
                    label.classList.add('selected');
                }
                checkbox.addEventListener('change', () => {
                    label.classList.toggle('selected', checkbox.checked);
                    checkHobbyLimit();
                });
                label.appendChild(checkbox);
                label.appendChild(span);
                optionsDiv.appendChild(label);
            });
            categoryDiv.appendChild(optionsDiv);
            hobbyListContainer.appendChild(categoryDiv);
        }
        checkHobbyLimit();
        if (typeof filterHobbies === 'function') {
            filterHobbies();
        }
    }

    function updateSelectedHobbiesUI() {
        selectedHobbiesContainer.innerHTML = '';
        selectedHobbiesForPost.forEach(hobby => {
            const tag = document.createElement('span');
            tag.className = 'selected-hobby-tag';
            tag.textContent = hobby;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-hobby-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                selectedHobbiesForPost = selectedHobbiesForPost.filter(h => h !== hobby);
                updateSelectedHobbiesUI();
            };
            tag.appendChild(removeBtn);
            selectedHobbiesContainer.appendChild(tag);
        });
    }

    if (addHobbyBtn) {
        addHobbyBtn.addEventListener('click', () => {
            renderHobbyList();
            hobbyModal.style.display = 'block';
        });
    }
    if (closeHobbyModalBtn) {
        closeHobbyModalBtn.addEventListener('click', () => {
            hobbyModal.style.display = 'none';
        });
    }
    if (confirmHobbiesBtn) {
        confirmHobbiesBtn.addEventListener('click', () => {
            selectedHobbiesForPost = [];
            const checkboxes = hobbyListContainer.querySelectorAll('input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                selectedHobbiesForPost.push(cb.value);
            });
            updateSelectedHobbiesUI();
            hobbyModal.style.display = 'none';
        });
    }

    function toast(m, t = "info") { try { window.createToast?.(m, t) } catch (_) { } }

    let currentUser = null;
    let currentUserProfile = null;
    let postsListener = null;
    let likeInProgress = {};
    let commentLikeInProgress = {};
    let displayedReposts = new Set();
    let lastVisiblePost = null;
    let isLoadingMorePosts = false;
    let noMorePosts = false;
    const POSTS_PER_PAGE = 10;
    let activeCommentListeners = {};
    let activeFeedType = 'main';
    let newPostsListener = null;

    let isFirstNewPostsSnapshot = true;

    let cropperInstance = null;
    let postImageBase64 = null;

    const imageEditorModal = document.getElementById('image-editor-modal');
    const imageToCrop = document.getElementById('image-to-crop');
    const cropImageBtn = document.getElementById('crop-image-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const closeEditorModalBtn = document.getElementById('close-editor-modal');
    const imagePreviewContainer = document.getElementById('post-image-preview-container');
    const imagePreview = document.getElementById('post-image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const newPostsIndicator = document.getElementById("new-posts-indicator");
    const reloadFeedBtn = document.getElementById("reload-feed-btn");
    const postImageInput = document.getElementById('post-image-input');
    const postImagePreviewContainer = document.getElementById('post-image-preview-container');
    const postImagePreview = document.getElementById('post-image-preview');
    const removePostImageBtn = document.getElementById('remove-post-image-btn');
    const feedTabButtons = document.querySelectorAll('.feed-tab-btn');

    feedTabButtons.forEach(button => {
        button.addEventListener('click', function () {
            feedTabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            activeFeedType = this.dataset.feedType;
            loadInitialPosts();
        });
    });

    function openImageEditor(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            imageToCrop.src = event.target.result;
            imageEditorModal.style.display = 'block';
            if (cropperInstance) {
                cropperInstance.destroy();
            }
            cropperInstance = new Cropper(imageToCrop, {
                aspectRatio: 1 / 1,
                viewMode: 1,
                background: false,
            });
        };
        reader.readAsDataURL(file);
    }

    function closeImageEditor() {
        imageEditorModal.style.display = 'none';
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
        postImageInput.value = '';
    }

    if (postImageInput) {
        postImageInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                openImageEditor(files[0]);
            }
        });
    }

    if (cropImageBtn) {
        cropImageBtn.addEventListener('click', () => {
            if (cropperInstance) {
                const canvas = cropperInstance.getCroppedCanvas({
                    width: 800,
                    height: 800,
                });
                postImageBase64 = canvas.toDataURL('image/jpeg', 1.0);
                postImagePreview.src = postImageBase64;
                postImagePreviewContainer.style.display = 'block';
                closeImageEditor();
            }
        });
    }
    if (reloadFeedBtn) {
        reloadFeedBtn.addEventListener('click', () => {
            if (newPostsIndicator) {
                newPostsIndicator.style.display = 'none';
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            loadInitialPosts();
        });
    }

    if (closeEditorModalBtn) closeEditorModalBtn.addEventListener('click', closeImageEditor);
    if (cancelCropBtn) cancelCropBtn.addEventListener('click', closeImageEditor);
    if (removePostImageBtn) removePostImageBtn.addEventListener('click', clearPostImage);

    if (postImageInput) {
        postImageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    postImageBase64 = e.target.result;
                    imagePreview.src = postImageBase64;
                    imagePreviewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function clearPostImage() {
        postImageBase64 = null;
        if (postImageInput) {
            postImageInput.value = '';
        }
        if (imagePreviewContainer) {
            imagePreviewContainer.style.display = 'none';
        }
        if (imagePreview) {
            imagePreview.src = '#';
        }
        selectedHobbiesForPost = [];
        updateSelectedHobbiesUI();
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', clearPostImage);
    }
    async function sharePost(postId) {
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const postUrl = `${cleanUrl}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(postUrl);
            showToast("Link da publicação copiado!", "success");
        } catch (error) {
            console.error("Erro ao copiar o link:", error);
            showCustomAlert(`Não foi possível copiar o link. Copie manualmente: ${postUrl}`);
        }
    }
    function detachPostsListener() {
        if (postsListener) {
            postsListener();
            postsListener = null;
        }
    }
    async function createFriendRequest(toUid) {
        const me = auth.currentUser;
        if (!me) { toast("Entre para seguir.", "error"); return false; }
        if (!toUid || toUid === me.uid) { toast("Usuário inválido.", "error"); return false; }

        const from = me.uid, to = toUid;
        const reqId = [from, to].sort().join("_");
        const reqRef = db.collection("friendRequests").doc(reqId);

        try {
            await reqRef.set({
                from, to, status: "pending",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            }, { merge: false });
        } catch (err) {
            if (err?.code === "permission-denied") {
                try {
                    const snap = await reqRef.get();
                    if (snap.exists) {
                        const r = snap.data() || {};
                        if (r.status === "pending") {
                            if (r.from === from) throw new Error("Solicitação já enviada.");
                            if (r.to === from) throw new Error("Essa pessoa já te enviou — aceite nas notificações.");
                        }
                        if (r.status === "accepted") throw new Error("Vocês já são amigos.");
                        if (r.status === "declined") throw new Error("Pedido foi recusado. Cancele antes de reenviar.");
                    }
                } catch (_) { }
            }
            throw err;
        }

        try {
            await db.collection("users").doc(to).collection("notifications").add({
                type: "friend_request",
                requestId: reqId,
                fromUserId: from,
                content: "enviou uma solicitação de amizade",
                status: "pending",
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (_) { }

        toast("Solicitação enviada!", "success");
        return true;
    }
    function wireSuggestionActionsIndex() {
        document.addEventListener("click", async (e) => {
            const btn = e.target.closest(".follow-btn, .friend-btn, .send-request-btn");
            if (!btn) return;

            const host = btn.closest("[data-user-id]");
            const toUid = btn.getAttribute("data-user-id") || host?.getAttribute("data-user-id");
            if (!toUid) return;

            const initial = btn.textContent;
            btn.disabled = true; btn.textContent = "Enviando…";

            try {
                const ok = await createFriendRequest(toUid);
                if (ok) {
                    btn.textContent = "Pendente";
                    btn.classList.add("is-pending");
                } else {
                    btn.textContent = initial; btn.disabled = false;
                }
            } catch (err) {
                toast(err?.message || "Não foi possível enviar.", "error");
                btn.textContent = initial; btn.disabled = false;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", wireSuggestionActionsIndex);
    function getUserPagePath() {
        return 'pages/user.html';
    }

    function wireSuggestionNavigationIndex() {
        const box = document.getElementById('suggestions-container');
        if (!box) return;

        box.addEventListener('click', (e) => {
            if (e.target.closest('.follow-btn, .friend-btn, .send-request-btn')) return;
            const hit = e.target.closest('.suggestion-photo, .suggestion-name');
            if (!hit) return;
            const card = hit.closest('.suggestion[data-user-id]');
            const uid = card?.dataset.userId;
            if (!uid) return;
            const userPage = getUserPagePath();
            window.location.href = `${userPage}?uid=${encodeURIComponent(uid)}`;
        });
    }

    document.addEventListener('DOMContentLoaded', wireSuggestionNavigationIndex);

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

    async function prependPostById(docId) {
        const db = firebase.firestore();
        const c = getPostsContainer();
        if (!c) return;
        try {
            const doc = await db.collection('posts').doc(docId).get();
            if (!doc.exists) return;
            let post = hydratePostDoc(doc);
            post = await fetchOriginalIfNeeded(db, post);
            const node = addPostToDOM(post, false);
            if (!(node instanceof Node)) return;
            c.insertBefore(node, c.firstChild);
        } catch (e) {
            console.error('Falha ao inserir novo post no topo:', e);
        }
    }
    auth.onAuthStateChanged(async function (user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);

            const profileLinks = document.querySelectorAll('.profile-link');
            if (profileLinks.length > 0) {
                profileLinks.forEach(link => {
                    link.href = `pages/user.html?uid=${user.uid}`;
                });
            }

            const urlParams = new URLSearchParams(window.location.search);
            const postIdFromUrl = urlParams.get('post');

            if (postIdFromUrl) {
                showSinglePostView(postIdFromUrl);
            } else {
                loadInitialPosts();
            }

            loadSuggestions();
            loadHobbiesPreview();
            loadUpcomingEvents();
            checkUpcomingEventNotifications();
            window.addEventListener('scroll', handleScroll);

        } else {
            window.removeEventListener('scroll', handleScroll);
            window.location.href = "login/login.html";
        }
    });
    if (logoutButton) {
        logoutButton.addEventListener("click", function (e) {
            e.preventDefault();
            auth.signOut()
                .then(() => {
                    window.location.href = "login/login.html";
                })
                .catch((error) => {
                    console.error("Erro ao fazer logout:", error);
                    showCustomAlert("Erro ao fazer logout. Tente novamente.");
                });
        });
    }

    if (postButton && postInput) {
        postButton.addEventListener("click", function () {
            const content = postInput.value.trim();
            createPost(content);
        });

        postInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                const content = postInput.value.trim();
                createPost(content);
            }
        });
    }

    async function loadUserProfile(userId) {
        try {
            const doc = await db.collection("users").doc(userId).get();
            if (doc.exists) {
                currentUserProfile = doc.data();
                if (userPhotoElement && currentUserProfile.photoURL) {
                    userPhotoElement.src = currentUserProfile.photoURL;
                }
                if (userHobbiesContainer) {
                    userHobbiesContainer.innerHTML = "";
                    if (currentUserProfile.hobbies && currentUserProfile.hobbies.length > 0) {
                        currentUserProfile.hobbies.forEach((hobby) => {
                            const hobbyTag = document.createElement("span");
                            hobbyTag.className = "hobby-tag";
                            hobbyTag.textContent = hobby;
                            userHobbiesContainer.appendChild(hobbyTag);
                        });
                    }
                    if (
                        currentUserProfile.customHobbies &&
                        currentUserProfile.customHobbies.length > 0
                    ) {
                        currentUserProfile.customHobbies.forEach((hobby) => {
                            const hobbyTag = document.createElement("span");
                            hobbyTag.className = "hobby-tag custom";
                            hobbyTag.textContent = hobby;
                            userHobbiesContainer.appendChild(hobbyTag);
                        });
                    }
                }
            } else {
                console.warn(`Aviso: Perfil para o usuário ${userId} não foi encontrado no Firestore.`);
            }
        } catch (error) {
            console.error("Erro ao carregar perfil do usuário:", error);
        }
    }

    let _lastVisible = null;
    let _isLoading = false;
    let _cursor = null;
    let _hasMore = true;
    let _io = null;
    let _sentinel = null;

    function getPostsContainer() {
        return window.postsContainer
            || document.getElementById('posts-container')
            || document.querySelector('.posts-container')
            || document.querySelector('#posts');
    }

    function safeInsertBefore(container, node, ref) {
        if (!(node instanceof Node)) return;
        if (ref && ref.parentNode === container) {
            container.insertBefore(node, ref);
        } else {
            container.appendChild(node);
        }
    }

    function ensureSentinel(container) {
        if (!container) return null;
        if (_sentinel && _sentinel.parentNode !== container) {
            try { _sentinel.remove(); } catch { }
            _sentinel = null;
        }
        if (!_sentinel) {
            _sentinel = document.createElement('div');
            _sentinel.id = 'feed-sentinel';
            _sentinel.style.height = '1px';
            _sentinel.style.marginTop = '1px';
            container.appendChild(_sentinel);
        }
        return _sentinel;
    }

    function setupInfiniteScroll() {
        if (_io) _io.disconnect();
        const container = getPostsContainer();
        _sentinel = ensureSentinel(container);
        if (!_sentinel) return;

        _io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) loadMorePosts();
        }, { root: null, rootMargin: '1000px', threshold: 0 });
        _io.observe(_sentinel);
    } function hydratePostDoc(doc) {
        const d = doc.data() || {};
        const isRepost = d.type === 'repost' || !!d.repostOfId || !!d.originalPostId;
        return {
            id: doc.id,
            authorId: d.authorId,
            authorName: d.authorName,
            authorPhoto: d.authorPhoto,
            content: d.content || '',
            imageUrl: d.imageUrl || d.imageURL || '',
            timestamp: d.createdAt || d.timestamp || null,
            likes: d.likes || 0,
            commentCount: d.commentCount || 0,
            likedBy: d.likedBy || [],
            savedBy: d.savedBy || [],
            repostedBy: d.repostedBy || [],
            isRepost,
            originalPostId: d.repostOfId || d.originalPostId || null,
            originalPost: d.originalPost || null,
            type: d.type || (isRepost ? 'repost' : 'post')
        };
    }

    async function fetchOriginalIfNeeded(db, post) {
        if (!post.isRepost) return post;
        if (post.originalPost || !post.originalPostId) return post;

        try {
            const snap = await db.collection('posts').doc(post.originalPostId).get();
            if (snap.exists) {
                const od = snap.data() || {};
                post.originalPost = {
                    id: snap.id,
                    authorId: od.authorId,
                    authorName: od.authorName,
                    authorPhoto: od.authorPhoto,
                    content: od.content || '',
                    imageUrl: od.imageUrl || od.imageURL || '',
                    timestamp: od.createdAt || od.timestamp || null
                };
            }
        } catch (e) {
            console.warn('Não foi possível ler o post original:', post.originalPostId, e);
        }
        return post;
    }
    async function loadInitialPosts() {
        if (!postsContainer || !currentUser) return;
        postsContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        isLoadingMorePosts = true;
        noMorePosts = false;
        lastVisiblePost = null;
        if (newPostsIndicator) {
            newPostsIndicator.style.display = 'none';
        }
        
        // <<< MUDANÇA 1: Redefine a flag antes de carregar e configurar o listener
        isFirstNewPostsSnapshot = true;
        
        try {
            let query = db.collection("posts");
            if (activeFeedType === 'friends') {
                const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
                const friendIds = friendsSnapshot.docs.map(doc => doc.id);
                if (friendIds.length === 0) {
                    postsContainer.innerHTML = '<div class="info-message">Você ainda não tem amigos para ver as publicações deles aqui.</div>';
                    isLoadingMorePosts = false;
                    return;
                }
                query = query.where('authorId', 'in', friendIds);
            }
            else if (activeFeedType === 'hobbies') {
                const userHobbies = currentUserProfile.hobbies || [];
                if (userHobbies.length === 0) {
                    postsContainer.innerHTML = '<div class="info-message">Adicione hobbies ao seu perfil para ver publicações relacionadas.</div>';
                    isLoadingMorePosts = false;
                    return;
                }
                query = query.where('hobbies', 'array-contains-any', userHobbies);
            }
            const finalQuery = query.orderBy("timestamp", "desc").limit(POSTS_PER_PAGE);
            const snapshot = await finalQuery.get();
            postsContainer.innerHTML = '';
            if (snapshot.empty) {
                noMorePosts = true;
                let message = 'Nenhum post encontrado.';
                if (activeFeedType === 'friends') {
                    message = 'Nenhum dos seus amigos publicou ainda.';
                } else if (activeFeedType === 'hobbies') {
                    message = 'Nenhum post encontrado com os seus hobbies.';
                }
                postsContainer.innerHTML = `<div class="info-message">${message}</div>`;
                return;
            }
            for (const doc of snapshot.docs) {
                const postData = { id: doc.id, ...doc.data() };
                const postElement = addPostToDOM(postData);
                if (postElement) {
                    postsContainer.appendChild(postElement);
                }
            }
            if (snapshot.docs.length > 0) {
                lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
                setupNewPostsListener();
            }
        } catch (error) {
            console.error("Erro ao carregar posts:", error);
            postsContainer.innerHTML = '<div class="error-message">Erro ao carregar publicações.</div>';
        } finally {
            isLoadingMorePosts = false;
        }
    }
    async function loadMorePosts() {
        if (noMorePosts || isLoadingMorePosts || !lastVisiblePost) return;
        isLoadingMorePosts = true;
        loadingMoreIndicator.style.display = 'block';
        try {
            let query = db.collection("posts");
            if (activeFeedType === 'friends') {
                const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
                const friendIds = friendsSnapshot.docs.map(doc => doc.id);
                if (friendIds.length > 0) {
                    query = query.where('authorId', 'in', friendIds);
                } else {
                    noMorePosts = true;
                    return;
                }
            } else if (activeFeedType === 'hobbies') {
                const userHobbies = currentUserProfile.hobbies || [];
                if (userHobbies.length > 0) {
                    query = query.where('hobbies', 'array-contains-any', userHobbies);
                } else {
                    noMorePosts = true;
                    return;
                }
            }
            const finalQuery = query.orderBy("timestamp", "desc").startAfter(lastVisiblePost).limit(POSTS_PER_PAGE);
            const snapshot = await finalQuery.get();
            if (snapshot.empty) {
                noMorePosts = true;
                return;
            }
            for (const doc of snapshot.docs) {
                const postElement = addPostToDOM({ id: doc.id, ...doc.data() });
                if (postElement) {
                    postsContainer.appendChild(postElement);
                }
            }
            lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
        } catch (error) {
            console.error("Erro ao carregar mais posts:", error);
        } finally {
            isLoadingMorePosts = false;
            loadingMoreIndicator.style.display = 'none';
        }
    }
    function createInfo(text) {
        const div = document.createElement('div');
        div.className = 'info-message';
        div.textContent = text;
        return div;
    }
   async function setupNewPostsListener() {
        if (postsListener) {
            postsListener();
        }
        
        const firstPostTimestamp = lastVisiblePost ? lastVisiblePost.data().timestamp : new Date();
        let query = db.collection("posts");

        // Replicar a lógica de filtragem da loadInitialPosts para o listener (o que é necessário)
        if (activeFeedType === 'friends') {
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            if (friendIds.length === 0) {
                return;
            }
            query = query.where('authorId', 'in', friendIds);
        } else if (activeFeedType === 'hobbies') {
            const userHobbies = currentUserProfile.hobbies || [];
            if (userHobbies.length === 0) {
                return;
            }
            query = query.where('hobbies', 'array-contains-any', userHobbies);
        }

        postsListener = query.where("timestamp", ">", firstPostTimestamp)
            .onSnapshot(snapshot => {
                // <<< MUDANÇA 2: Ignora o primeiro snapshot (os posts que já existiam antes de o listener iniciar)
                if (isFirstNewPostsSnapshot) {
                    isFirstNewPostsSnapshot = false;
                    // Garante que o indicador está oculto, pois o estado inicial é "sem novos posts"
                    if (newPostsIndicator) {
                        newPostsIndicator.style.display = 'none'; 
                    }
                    return; 
                }

                const newPosts = snapshot.docChanges().filter(change => change.type === 'added');
                
                // Exibe o botão apenas se novos posts reais (adicionados após o primeiro snapshot) forem detectados
                if (newPosts.length > 0) {
                    if (newPostsIndicator) {
                        newPostsIndicator.style.display = 'flex';
                    }
                }
            });
    }

    async function deletePost(postId) {
        const confirmed = await showConfirmationModal(
            "Excluir Publicação",
            "Tem certeza que deseja excluir? Comentários e republicações ligados a ela também serão removidos.",
            "Sim, excluir tudo",
            "Cancelar"
        );
        if (!confirmed) return;
        try {
            const postRef = db.collection('posts').doc(postId);
            const postSnap = await postRef.get();
            if (!postSnap.exists) return;
            const data = postSnap.data();
            if (data.type === "comment" && data.parentPostId && data.commentId) {
                const parentRef = db.collection('posts').doc(data.parentPostId);
                const commentRef = parentRef.collection('comments').doc(data.commentId);
                const batch1 = db.batch();
                batch1.delete(postRef);
                batch1.delete(commentRef);
                batch1.update(parentRef, {
                    commentCount: firebase.firestore.FieldValue.increment(-1),
                });
                await batch1.commit();
                document.querySelectorAll(`.post[data-post-id="${postId}"]`).forEach(el => el.remove());
                showToast("Comentário removido do feed e do post.", "info");
                return;
            }
            const batch = db.batch();
            batch.delete(postRef);
            const repostsSnapshot = await db.collection('posts')
                .where('originalPostId', '==', postId)
                .get();
            repostsSnapshot.forEach(doc => batch.delete(doc.ref));
            const commentsSnap = await db.collection('posts').doc(postId).collection('comments').get();
            commentsSnap.forEach(doc => batch.delete(doc.ref));
            const commentPostsSnap = await db.collection('posts')
                .where('type', '==', 'comment')
                .where('parentPostId', '==', postId)
                .get();
            commentPostsSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            showToast("Publicação, comentários, republicações e entradas no feed excluídos.", "success");
            document.querySelectorAll(
                `.post[data-post-id="${postId}"], .post[data-base-post-id="${postId}"]`
            ).forEach(el => el.remove());
        } catch (error) {
            console.error("Erro ao excluir publicação e dependências:", error);
            showCustomAlert("Ocorreu um erro ao tentar excluir a publicação.");
        }
    }

    async function deleteComment(postId, commentId) {
        const confirmed = await showConfirmationModal("Excluir Comentário", "Tem certeza que deseja excluir este comentário?");
        if (!confirmed) return;
        try {
            const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
            await commentRef.delete();
            const postRef = db.collection('posts').doc(postId);
            await postRef.update({
                commentCount: firebase.firestore.FieldValue.increment(-1)
            });
            const mirrorSnap = await db.collection('posts')
                .where('type', '==', 'comment')
                .where('parentPostId', '==', postId)
                .where('commentId', '==', commentId)
                .get();
            const batch = db.batch();
            mirrorSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            showToast("Comentário excluído no post e no feed.", "info");
        } catch (error) {
            console.error("Erro ao excluir comentário:", error);
            showCustomAlert("Ocorreu um erro ao excluir o comentário.");
        }
    }

    function handleScroll() {
        if (noMorePosts || isLoadingMorePosts) {
            return;
        }
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 500) {
            loadMorePosts();
        }
    }
   // Em home/scripts.js, substitua a função createPost por esta:
async function createPost(content) {
    // --- INÍCIO DA MODIFICAÇÃO PARA O EASTER EGG ---
    const secretPhrase = "Eu te amo Manu.C";
    if (content.trim() === secretPhrase) {
        // Se o texto for a frase secreta, redireciona para a página de homenagem
        window.location.href = 'homenagem/homenagem.html';
        return; // Impede que o resto da função (de criar o post) seja executado
    }
    // --- FIM DA MODIFICAÇÃO ---

    try {
        if (!currentUser || !currentUserProfile) {
            showCustomAlert("Você precisa estar logado para publicar.");
            return;
        }

        // Validação que inclui texto, imagem ou hobbies
        if (!content && !postImageBase64 && selectedHobbiesForPost.length === 0) {
            showCustomAlert("Escreva algo, adicione uma imagem ou selecione um hobby para publicar.");
            return;
        }

        if (postButton) {
            postButton.disabled = true;
            postButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
        }

        const postData = {
            content,
            authorId: currentUser.uid,
            authorName: currentUserProfile.nickname || "Usuário",
            authorPhoto: currentUserProfile.photoURL || null,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            likedBy: [],
            commentCount: 0,
            imageURL: postImageBase64,
            hobbies: selectedHobbiesForPost // Inclui os hobbies no post
        };

        const docRef = await db.collection("posts").add(postData);
        const newPostDoc = await docRef.get();
        const newPostData = { id: newPostDoc.id, ...newPostDoc.data() };

        // 1. Chama a função addPostToDOM, que retorna um elemento HTML
        const postElement = addPostToDOM(newPostData);

        // 2. Verifica se o elemento foi criado e o adiciona no início do feed
        if (postElement) {
            postsContainer.prepend(postElement);
        }

        // 3. Limpa os campos do formulário
        postInput.value = "";
        clearPostImage(); // Esta função já limpa a imagem e os hobbies

    } catch (error) {
        console.error("Erro ao criar post:", error);
        showCustomAlert("Erro ao criar publicação. Tente novamente.");
    } finally {
        if (postButton) {
            postButton.disabled = false;
            postButton.textContent = "Publicar";
        }
    }
}
    backToFeedBtn.addEventListener('click', hideSinglePostView);


    // =======================================================================================
    // FUNÇÃO addPostToDOM - ÚNICA SEÇÃO MODIFICADA
    // =======================================================================================
    function addPostToDOM(post, isSingleView = false) {
        if (!postTemplate) {
            console.error("Template de post não encontrado.");
            return null;
        }
        if (post.isRepost && (!post.originalPost || Object.keys(post.originalPost).length === 0)) {
            console.warn(`Republicação órfã (ID: ${post.id}) não será exibida pois o post original (ID: ${post.originalPostId}) foi apagado.`);
            return null;
        }
    
        const postClone = document.importNode(postTemplate.content, true);
        const postElement = postClone.querySelector(".post");
        if (!postElement) return null;
    
        const basePost = post.isRepost ? post.originalPost : post;
        const baseId = post.originalPostId || post.id;
    
        postElement.dataset.postId = post.id;
        postElement.dataset.basePostId = baseId;
    
        const actionsContainer = postElement.querySelector('.post-actions');
    
        if (post.isRepost) {
            postElement.classList.add('repost-card');
            const repostHeader = document.createElement('div');
            repostHeader.className = 'repost-header';
            repostHeader.innerHTML = `
                <i class="fas fa-retweet"></i>
                <img src="${post.authorPhoto || 'img/Design sem nome2.png'}" alt="Foto de ${post.authorName}" class="repost-author-photo">
                <a href="pages/user.html?uid=${post.authorId}" class="repost-author-link">${post.authorName}</a> republicou
            `;
            postElement.prepend(repostHeader);
            if (actionsContainer) {
                actionsContainer.remove();
            }
            // ▼▼▼ LINHA ADICIONADA PARA CORRIGIR O ERRO ▼▼▼
            postElement.querySelector('.options-btn').style.display = 'none';
        }
    
        postElement.querySelector(".post-author-photo").src = basePost.authorPhoto || 'img/Design sem nome2.png';
        postElement.querySelector(".post-author-name").textContent = basePost.authorName || 'Usuário';
        postElement.querySelector(".post-text").textContent = basePost.content || '';
        if (basePost.timestamp?.toDate) {
            postElement.querySelector(".post-timestamp").textContent = formatTimestamp(basePost.timestamp.toDate());
        }
    
        const authorPhotoEl = postElement.querySelector(".post-author-photo");
        const authorNameEl = postElement.querySelector(".post-author-name");
    
        const authorClickHandler = (e) => {
            e.stopPropagation();
            redirectToUserProfile(basePost.authorId);
        };
    
        authorPhotoEl.addEventListener('click', authorClickHandler);
        authorNameEl.addEventListener('click', authorClickHandler);
    
        const isReply = post.type === "comment";
        if (isReply) {
            const info = postElement.querySelector(".post-info");
            const replyCtx = document.createElement("div");
            replyCtx.className = "reply-context";
            replyCtx.innerHTML = `<span class="reply-actor">${post.authorName}</span> respondeu a <span class="reply-target">${post.parentAuthorName || "usuário"}</span>`;
            info.appendChild(replyCtx);
            const contentBox = postElement.querySelector(".post-content");
            const quoted = document.createElement("div");
            quoted.className = "quoted-parent";
            quoted.innerHTML = `
            <div class="quoted-bar"></div>
            <div class="quoted-body">
              <div class="quoted-author">${post.parentAuthorName || "Usuário"}</div>
              <div class="quoted-text">${(post.parentSnippet || "").replace(/\n/g, "<br>")}</div>
            </div>
          `;
            quoted.style.cursor = "pointer";
            quoted.addEventListener("click", (e) => {
                e.stopPropagation();
                if (post.parentPostId) {
                    showSinglePostView(post.parentPostId);
                }
            });
            contentBox.prepend(quoted);
        }
    
        const mediaContainer = postElement.querySelector(".post-media");
        if (basePost.imageURL) {
            postElement.querySelector(".post-image").src = basePost.imageURL;
            mediaContainer.style.display = 'block';
        } else {
            mediaContainer.style.display = 'none';
        }
    
        const hobbiesContainer = postElement.querySelector(".post-hobbies-container");
        if (basePost.hobbies && basePost.hobbies.length > 0) {
            hobbiesContainer.innerHTML = '';
            hobbiesContainer.style.display = 'flex';
            basePost.hobbies.forEach(hobby => {
                const hobbyTag = document.createElement('span');
                hobbyTag.className = 'post-hobby-tag';
                hobbyTag.textContent = hobby;
                hobbiesContainer.appendChild(hobbyTag);
            });
        } else {
            hobbiesContainer.style.display = 'none';
        }
    
        if (!post.isRepost && actionsContainer) {
            const likeBtn = postElement.querySelector(".like-btn");
            const repostBtn = postElement.querySelector(".repost-btn");
            const saveBtn = postElement.querySelector(".save-btn");
            const shareBtn = postElement.querySelector(".share-btn");
            const deleteBtn = postElement.querySelector('.post-delete-btn');
    
            // ### INÍCIO DA MODIFICAÇÃO PARA O NOVO SISTEMA DE DENÚNCIA ###
            const optionsBtn = postElement.querySelector(".options-btn");
            const dropdown = postElement.querySelector(".options-dropdown");
            const reportBtn = postElement.querySelector(".report-btn");
    
            if (optionsBtn && dropdown) {
                optionsBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    document.querySelectorAll('.options-dropdown.active').forEach(otherDropdown => {
                        if (otherDropdown !== dropdown) {
                            otherDropdown.classList.remove('active');
                        }
                    });
                    dropdown.classList.toggle('active');
                });
            }
    
            // Substituímos o listener antigo (que criava um report direto)
            // por este novo listener que redireciona para a página 'denuncia.html'
            if (reportBtn) {
                reportBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropdown.classList.remove('active'); 

                    // 'baseId' foi definido no início desta função (linha 923)
                    // Ele é o ID do post original (ou o próprio ID se não for repost)
                    const postIdToReport = baseId; 
                    
                    // Redireciona para a página de denúncia com os parâmetros corretos
                    // Assumindo que 'denuncia/denuncia.html' está na raiz do projeto.
                    window.location.href = `denuncia/denuncia.html?type=post&id=${postIdToReport}`;
                });
            }
            // ### FIM DA MODIFICAÇÃO ###
    
    
            const isLiked = !!(currentUser && basePost.likedBy?.includes(currentUser.uid));
            likeBtn.querySelector('span').textContent = basePost.likes || 0;
            likeBtn.classList.toggle('liked', isLiked);
            likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(baseId, e.currentTarget); });
    
            const isSaved = !!(currentUser && basePost.savedBy?.includes(currentUser.uid));
            saveBtn.classList.toggle('saved', isSaved);
            saveBtn.innerHTML = isSaved ? `<i class="fas fa-bookmark"></i> Salvo` : `<i class="far fa-bookmark"></i> Salvar`;
            saveBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSavePost(baseId, e.currentTarget); });
    
            shareBtn.addEventListener('click', (e) => { e.stopPropagation(); sharePost(baseId); });
    
            const hasReposted = !!(currentUser && basePost.repostedBy?.includes(currentUser.uid));
            repostBtn.classList.toggle('reposted', hasReposted);
            repostBtn.innerHTML = hasReposted ? `<i class="fas fa-retweet"></i> Republicado` : `<i class="fas fa-retweet"></i> Republicar`;
            repostBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRepost(baseId, e.currentTarget); });
    
            if (post.authorId === currentUser?.uid) {
                deleteBtn.style.display = 'block';
                deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deletePost(post.id); });
            }
        }
    
        const commentsSection = postElement.querySelector('.post-comments');
        const commentBtn = postElement.querySelector(".comment-btn");
    
        if (commentBtn) {
            commentBtn.querySelector('span').textContent = basePost.commentCount || 0;
            commentBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = commentsSection.classList.toggle('active');
                const postId = postElement.dataset.basePostId;
                if (isActive) {
                    if (activeCommentListeners[postId]) {
                        activeCommentListeners[postId]();
                    }
                    const commentsList = commentsSection.querySelector('.comments-list');
                    activeCommentListeners[postId] = loadComments(postId, commentsList);
                } else {
                    if (activeCommentListeners[postId]) {
                        activeCommentListeners[postId]();
                        delete activeCommentListeners[postId];
                    }
                }
            });
        }
    
        const commentInput = postElement.querySelector(".comment-text");
        const sendCommentBtn = postElement.querySelector(".send-comment-btn");
    
        sendCommentBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const content = commentInput.value.trim();
            if (content) {
                addComment(baseId, content);
                commentInput.value = "";
            }
        });
    
        commentInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCommentBtn.click();
            }
        });
    
        if (!isSingleView) {
            postElement.addEventListener('click', (e) => {
                if (e.target.closest('a, button, input, .post-actions, .comment-input, .post-author-photo, .post-author-name')) {
                    return;
                }
                showSinglePostView(baseId);
            });
        }
        return postElement;
    }
    // =======================================================================================
    // FIM DA FUNÇÃO MODIFICADA
    // =======================================================================================


    async function showSinglePostView(postId) {
        detachPostsListener();
        feedView.style.display = 'none';
        singlePostView.style.display = 'block';
        window.scrollTo(0, 0);

        const url = new URL(window.location);
        url.searchParams.set('post', postId);
        history.pushState({}, '', url);

        focusedPostContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        const postRef = db.collection("posts").doc(postId);
        const doc = await postRef.get();

        if (doc.exists) {
            const postData = { id: doc.id, ...doc.data() };
            focusedPostContainer.innerHTML = '';
            const postElement = addPostToDOM(postData, true);
            if (postElement) {
                const commentsSection = postElement.querySelector('.post-comments');
                const commentsList = postElement.querySelector('.comments-list');
                commentsSection.classList.add('active');
                loadComments(postId, commentsList);
                focusedPostContainer.appendChild(postElement);
            }
        } else {
            focusedPostContainer.innerHTML = '<div class="error-message">Esta publicação não foi encontrada ou foi removida.</div>';
        }
    }
    function hideSinglePostView() {
        singlePostView.style.display = 'none';
        feedView.style.display = 'block';
        focusedPostContainer.innerHTML = '';
        const url = new URL(window.location);
        url.searchParams.delete('post');
        history.pushState({}, '', url);
        loadInitialPosts();
    }

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
                const repostQuery = db.collection("posts")
                    .where("originalPostId", "==", basePostId)
                    .where("authorId", "==", currentUser.uid);
                const repostSnapshot = await repostQuery.get();
                const batch = db.batch();
                repostSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                batch.update(postRef, {
                    repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                    repostCount: firebase.firestore.FieldValue.increment(-repostSnapshot.size || -1)
                });
                await batch.commit();
                showToast("Republicação removida.", "info");
                loadInitialPosts();

            } else {
                if (originalPostData.authorId === currentUser.uid) {
                    showCustomAlert("Você não pode republicar as suas próprias publicações.");
                    return;
                }
                const repostData = {
                    isRepost: true,
                    originalPostId: basePostId,
                    originalPost: originalPostData,
                    authorId: currentUser.uid,
                    authorName: currentUserProfile.nickname || "Usuário",
                    authorPhoto: currentUserProfile.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                };
                await db.collection("posts").add(repostData);
                await postRef.update({
                    repostedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                    repostCount: firebase.firestore.FieldValue.increment(1)
                });
                loadInitialPosts();
                showToast("Publicação republicada!", "success");
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
            const isSaved = (doc.data().savedBy || []).includes(currentUser.uid);
            if (isSaved) {
                await postRef.update({
                    savedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
                buttonElement.classList.remove('saved');
                buttonElement.innerHTML = `<i class="far fa-bookmark"></i> Salvar`;
            } else {
                await postRef.update({
                    savedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                buttonElement.classList.add('saved');
                buttonElement.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
            }
        } catch (error) {
            console.error("Erro ao salvar/remover post:", error);
            showCustomAlert("Ocorreu um erro ao tentar salvar a publicação.");
        }
    }
    async function toggleLike(postId, buttonElement) {
        try {
            if (likeInProgress[postId]) return;
            likeInProgress[postId] = true;

            if (!currentUser) {
                showCustomAlert("Você precisa estar logado para curtir.");
                return;
            }

            const postRef = db.collection("posts").doc(postId);
            const postDoc = await postRef.get();
            if (!postDoc.exists) return;

            const postData = postDoc.data();
            const isLiked = (postData.likedBy || []).includes(currentUser.uid);

            const likeCountElement = buttonElement.querySelector(".like-count");
            let currentLikes = parseInt(likeCountElement.textContent);

            if (isLiked) {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                });
                buttonElement.classList.remove("liked");
                likeCountElement.textContent = Math.max(0, currentLikes - 1);
            } else {
                await postRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                });
                buttonElement.classList.add("liked");
                likeCountElement.textContent = currentLikes + 1;
            }
        } catch (error) {
            console.error("Erro ao curtir post:", error);
        } finally {
            likeInProgress[postId] = false;
        }
    }
    function wireReplyButtonForComment(postEl, postId, commentEl, commentData) {
        const replyBtn = commentEl.querySelector('.comment-reply-btn');
        if (!replyBtn) return;
        replyBtn.addEventListener('click', () => {
            replyTargetByPost.set(postId, {
                commentId: commentData.id,
                authorId: commentData.authorId || null,
                authorName: commentData.authorName || "Usuário",
                snippet: (commentData.content || "").slice(0, 160)
            });
            setReplyTargetUI(postEl, replyTargetByPost.get(postId));
            const input = postEl.querySelector('.comment-text');
            if (input) input.focus();
        });
    }

    function setReplyTargetUI(postEl, target) {
        const box = postEl.querySelector('.post-comments');
        if (!box) return;
        let hint = box.querySelector('.replying-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'replying-hint';
            box.insertBefore(hint, box.querySelector('.comment-input'));
        }
        hint.innerHTML = `Respondendo a <strong>${target.authorName || "usuário"}</strong>
       <span class="cancel-reply">cancelar</span>`;
        const input = box.querySelector('.comment-text');
        if (input) input.placeholder = `Resposta para ${target.authorName || "usuário"}…`;
        hint.querySelector('.cancel-reply').onclick = () => clearReplyTargetUI(postEl);
    }

    function clearReplyTargetUI(postEl) {
        const box = postEl.querySelector('.post-comments');
        if (!box) return;
        const hint = box.querySelector('.replying-hint');
        if (hint) hint.remove();
        const input = box.querySelector('.comment-text');
        if (input) input.placeholder = "O que você está pensando?";
    }

    function loadComments(postId, commentsListElement) {
        if (!commentsListElement) {
            console.error("Elemento da lista de comentários não fornecido.");
            return () => { };
        }
        commentsListElement.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        const query = db.collection("posts").doc(postId).collection("comments").orderBy("timestamp", "asc");
        return query.onSnapshot(snapshot => {
            commentsListElement.innerHTML = '';
            if (snapshot.empty) {
                commentsListElement.innerHTML = '<div class="no-comments">Nenhum comentário ainda. Seja o primeiro!</div>';
                return;
            }
            snapshot.forEach(doc => {
                const commentData = { id: doc.id, ...doc.data() };
                addCommentToDOM(postId, commentData, commentsListElement);
            });
        }, error => {
            console.error("Erro ao carregar comentários:", error);
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
        const deleteCommentBtn = commentClone.querySelector('.comment-delete-btn');

        likeButton.addEventListener("click", function () {
            toggleCommentLike(postId, comment.id);
        });

        commentElement.dataset.commentId = comment.id;
        commentElement.dataset.authorId = comment.authorId;

        if (comment.authorPhoto) {
            authorPhotoElement.src = comment.authorPhoto;
        }
        authorPhotoElement.addEventListener("click", function () {
            redirectToUserProfile(comment.authorId);
        });
        authorNameElement.textContent = comment.authorName;
        authorNameElement.addEventListener("click", function () {
            redirectToUserProfile(comment.authorId);
        });

        if (comment.timestamp) {
            const date = comment.timestamp instanceof Date ? comment.timestamp : comment.timestamp.toDate();
            timestampElement.textContent = formatTimestamp(date);
        } else {
            timestampElement.textContent = "Agora mesmo";
        }

        
        likeCount.textContent = comment.likes || 0;

        if (comment.likedBy && comment.likedBy.includes(currentUser.uid)) {
            likeButton.classList.add("liked");
        }
        if (comment.authorId === currentUser.uid) {
            deleteCommentBtn.style.display = 'block';
            deleteCommentBtn.addEventListener('click', () => {
                deleteComment(postId, comment.id);
            });
        }
        commentsList.insertBefore(commentClone, commentsList.firstChild);
    }
    async function addComment(postId, content) {
        try {
            if (!currentUser || !currentUserProfile) {
                showCustomAlert("Você precisa estar logado para comentar.");
                return;
            }
            const replyTarget = replyTargetByPost.get(postId) || null;
            const replyingToComment = !!(replyTarget && replyTarget.commentId);
            const commentData = {
                content,
                authorId: currentUser.uid,
                authorName: currentUserProfile.nickname || "Usuário",
                authorPhoto: currentUserProfile.photoURL || null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [],
                parentCommentId: replyingToComment ? replyTarget.commentId : null,
                parentCommentAuthorId: replyingToComment ? (replyTarget.commentAuthorId || null) : null,
                parentCommentAuthorName: replyingToComment ? (replyTarget.commentAuthorName || null) : null
            };
            const commentRef = await db.collection("posts").doc(postId).collection("comments").add(commentData);
            await db.collection("posts").doc(postId).update({
                commentCount: firebase.firestore.FieldValue.increment(1)
            });
            const postDoc = await db.collection("posts").doc(postId).get();
            const postData = postDoc.data() || {};
            let parentAuthorId = postData.authorId || null;
            let parentAuthorName = postData.authorName || "Usuário";
            let parentSnippet = (postData.content || "").slice(0, 160);
            if (replyingToComment) {
                parentAuthorId = replyTarget.commentAuthorId || parentAuthorId;
                parentAuthorName = replyTarget.commentAuthorName || parentAuthorName;
                parentSnippet = (replyTarget.commentContent || "").slice(0, 160);
            }
            await db.collection("posts").add({
                type: "comment",
                content,
                authorId: currentUser.uid,
                authorName: currentUserProfile.nickname || "Usuário",
                authorPhoto: currentUserProfile.photoURL || null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [],
                commentCount: 0,
                parentPostId: postId,
                parentAuthorId,
                parentAuthorName,
                parentSnippet,
                commentId: commentRef.id,
                parentCommentId: replyingToComment ? replyTarget.commentId : null
            });
            const notifyUserId = replyingToComment
                ? (replyTarget.commentAuthorId || postData.authorId)
                : postData.authorId;
            if (notifyUserId && notifyUserId !== currentUser.uid) {
                await db.collection("users").doc(notifyUserId).collection("notifications").add({
                    type: replyingToComment ? "comment_reply" : "comment",
                    postId,
                    commentId: commentRef.id,
                    fromUserId: currentUser.uid,
                    fromUserName: currentUserProfile.nickname || "Usuário",
                    fromUserPhoto: currentUserProfile.photoURL || null,
                    content: replyingToComment ? "respondeu seu comentário" : "comentou em sua publicação",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }
            const countEl = document.querySelector(`.post[data-post-id="${postId}"] .comment-count`);
            if (countEl) countEl.textContent = (parseInt(countEl.textContent) || 0) + 1;
            replyTargetByPost.delete(postId);
            const postEl = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postEl) clearReplyTargetUI(postEl);
        } catch (error) {
            console.error("Erro ao adicionar comentário:", error);
            showCustomAlert("Erro ao adicionar comentário. Tente novamente.");
        }
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

            const commentRef = db.collection("posts").doc(postId).collection("comments").doc(commentId);
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
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                });
            } else {
                await commentRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                });
                if (commentData.authorId !== currentUser.uid) {
                    await db.collection("users").doc(commentData.authorId).collection("notifications").add({
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
            commentLikeInProgress[commentKey] = false;
        } catch (error) {
            console.error("Erro ao curtir comentário:", error);
            commentLikeInProgress[`${postId}_${commentId}`] = false;
        }
    }

    const leftSidebarToggle = document.getElementById('left-sidebar-toggle');
    const rightSidebarToggle = document.getElementById('right-sidebar-toggle');
    const leftSidebar = document.querySelector('.left-sidebar');
    const rightSidebar = document.querySelector('.right-sidebar');

    if (leftSidebarToggle && leftSidebar) {
        leftSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            leftSidebar.classList.toggle('open');
        });
    }

    if (rightSidebarToggle && rightSidebar) {
        rightSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            rightSidebar.classList.toggle('open');
        });
    }

    document.addEventListener('click', (e) => {
        if (leftSidebar && leftSidebar.classList.contains('open') && !leftSidebar.contains(e.target) && !leftSidebarToggle.contains(e.target)) {
            leftSidebar.classList.remove('open');
        }
        if (rightSidebar && rightSidebar.classList.contains('open') && !rightSidebar.contains(e.target) && !rightSidebarToggle.contains(e.target)) {
            rightSidebar.classList.remove('open');
        }
        // Listener global para fechar o menu de denúncia se clicar fora
        const activeDropdown = document.querySelector('.options-dropdown.active');
        if (activeDropdown && !activeDropdown.parentElement.contains(e.target)) {
            activeDropdown.classList.remove('active');
        }
    });

    function addSuggestionToDOM(user) {
        if (!suggestionTemplate) {
            console.error("Template de sugestão não encontrado.");
            return;
        }
        const suggestionClone = document.importNode(suggestionTemplate.content, true);
        const suggestionElement = suggestionClone.querySelector(".suggestion");
        const followButton = suggestionClone.querySelector(".follow-btn");
        const hobbiesElement = suggestionClone.querySelector(".suggestion-hobbies");

        suggestionElement.dataset.userId = user.id;
        suggestionClone.querySelector(".suggestion-photo").src = user.photoURL || 'img/Design sem nome2.png';
        suggestionClone.querySelector(".suggestion-name").textContent = user.nickname || 'Usuário';

        const currentUserHobbies = currentUserProfile?.hobbies || [];
        const suggestedUserHobbies = user.hobbies || [];
        const commonHobbies = currentUserHobbies.filter(hobby => suggestedUserHobbies.includes(hobby));

        if (commonHobbies.length > 0) {
            hobbiesElement.textContent = `${commonHobbies.length} hobby(s) em comum`;
        } else {
            hobbiesElement.textContent = 'Nenhum hobby em comum';
        }

        const profileLink = `pages/user.html?uid=${encodeURIComponent(user.id)}`;
        const nameEl = suggestionClone.querySelector('.suggestion-name');
        const imgEl = suggestionClone.querySelector('.suggestion-photo');

        if (nameEl) {
            const aName = document.createElement('a');
            aName.href = profileLink;
            aName.className = 'suggestion-name-link';
            nameEl.replaceWith(aName);
            aName.appendChild(nameEl);
        }

        if (imgEl) {
            const aImg = document.createElement('a');
            aImg.href = profileLink;
            aImg.className = 'suggestion-photo-link';
            imgEl.replaceWith(aImg);
            aImg.appendChild(imgEl);
        }

        followButton.addEventListener("click", async function () {
            await sendFriendRequest(user.id);
        });

        suggestionsContainer.appendChild(suggestionClone);
    }

    async function sendFriendRequest(userId) {
        if (!currentUserProfile || !currentUserProfile.nickname) {
            showToast("O seu perfil ainda não foi carregado, tente novamente.", "error");
            return false;
        }
        const followButton = document.querySelector(`.suggestion[data-user-id="${userId}"] .follow-btn`);
        if (followButton) {
            followButton.disabled = true;
            followButton.textContent = 'Aguarde...';
        }
        try {
            if (userId === currentUser.uid) throw new Error('Você não pode se adicionar.');
            const friendDoc = await db.collection("users").doc(currentUser.uid).collection("friends").doc(userId).get();
            if (friendDoc.exists) throw new Error('Este utilizador já é seu amigo.');
            const requestId = [currentUser.uid, userId].sort().join('_');
            const requestRef = db.collection('friendRequests').doc(requestId);
            await requestRef.set({
                from: currentUser.uid,
                to: userId,
                fromUserName: currentUserProfile.nickname,
                fromUserPhoto: currentUserProfile.photoURL || null,
                status: "pending",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            });
            showToast("Solicitação enviada!", "success");
            if (followButton) {
                followButton.textContent = 'Pendente';
                followButton.disabled = true;
            }
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            if (followButton) {
                followButton.disabled = false;
                followButton.textContent = 'Seguir';
            }
            return false;
        }
    }

    async function loadUpcomingEvents() {
        const upcomingEventsContainer = document.getElementById('upcoming-events-container');
        if (!upcomingEventsContainer) return;
        upcomingEventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i></div>';
        try {
            const now = new Date();
            const snapshot = await db.collection('events')
                .where('eventDateTime', '>=', now)
                .orderBy('eventDateTime', 'desc')
                .limit(3)
                .get();
            upcomingEventsContainer.innerHTML = '';
            if (snapshot.empty) {
                upcomingEventsContainer.innerHTML = '<p>Nenhum evento próximo.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const event = { id: doc.id, ...doc.data() };
                const eventDate = event.eventDateTime.toDate();
                const day = eventDate.getDate();
                const month = eventDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
                const eventElement = document.createElement('div');
                eventElement.className = 'event';
                eventElement.innerHTML = `
              <div class="event-date">
                  <span class="day">${day}</span>
                  <span class="month">${month}</span>
              </div>
              <div class="event-info">
                  <h4>${event.eventName}</h4>
                  <p><i class="fas fa-map-marker-alt"></i> ${event.eventLocation}</p>
              </div>
            `;
                upcomingEventsContainer.appendChild(eventElement);
            });
        } catch (error) {
            console.error("Erro ao carregar eventos próximos:", error);
            upcomingEventsContainer.innerHTML = '<p>Erro ao carregar eventos.</p>';
        }
    }

    async function checkUpcomingEventNotifications() {
        if (!currentUser || !currentUser.uid) return;
        try {
            const now = new Date();
            const upcomingLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const eventsSnapshot = await db.collection('events')
                .where('participants', 'array-contains', currentUser.uid)
                .where('eventDateTime', '>=', now)
                .where('eventDateTime', '<=', upcomingLimit)
                .get();
            if (eventsSnapshot.empty) {
                return;
            }
            eventsSnapshot.forEach(async (doc) => {
                const event = { id: doc.id, ...doc.data() };
                const eventId = event.id;
                const notificationQuery = await db.collection('users').doc(currentUser.uid).collection('notifications')
                    .where('type', '==', 'event_reminder')
                    .where('eventId', '==', eventId)
                    .limit(1)
                    .get();
                if (notificationQuery.empty) {
                    const eventDate = event.eventDateTime.toDate();
                    const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    await db.collection('users').doc(currentUser.uid).collection('notifications').add({
                        type: 'event_reminder',
                        eventId: eventId,
                        fromUserName: 'Sistema de Eventos',
                        content: `Lembrete: O evento "${event.eventName}" começa hoje às ${formattedTime}!`,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
                    console.log(`Notificação criada para o evento: ${event.eventName}`);
                }
            });
        } catch (error) {
            console.error("Erro ao verificar notificações de eventos:", error);
        }
    }

    async function repostPost(postId) {
        if (!currentUser) {
            showCustomAlert("Você precisa estar logado para republicar.");
            return;
        }
        const postToRepostRef = db.collection("posts").doc(postId);
        try {
            const postDoc = await postToRepostRef.get();
            if (!postDoc.exists) {
                showCustomAlert("Este post não existe mais.");
                return;
            }
            const postData = postDoc.data();
            if (postData.isRepost) {
                showCustomAlert("Não é possível republicar um post já republicado.");
                return;
            }
            const newPost = {
                authorId: currentUser.uid,
                authorName: currentUser.displayName,
                authorPhoto: currentUser.photoURL,
                content: postData.content,
                imageURL: postData.imageURL || null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [],
                commentCount: 0,
                isRepost: true,
                originalPostId: postId,
                originalAuthorId: postData.authorId,
                originalAuthorName: postData.authorName,
            };
            await db.collection("posts").add(newPost);
            await postToRepostRef.update({
                repostCount: firebase.firestore.FieldValue.increment(1)
            });
            showCustomAlert("Post republicado com sucesso!", "success");
        } catch (error) {
            console.error("Erro ao republicar o post:", error);
            showCustomAlert("Ocorreu um erro ao republicar.");
        }
    }

    function loadHobbiesPreview() {
        const hobbiesContainer = document.getElementById('hobbies-preview-container');
        if (!hobbiesContainer) return;
        hobbiesContainer.innerHTML = '';
        const hobbies = currentUserProfile.hobbies || [];
        if (hobbies.length > 0) {
            const hobbiesToShow = hobbies.slice(0, 4);
            hobbiesToShow.forEach(hobby => {
                const hobbyElement = document.createElement('span');
                hobbyElement.className = 'hobby-tag';
                hobbyElement.textContent = hobby;
                hobbiesContainer.appendChild(hobbyElement);
            });
            if (hobbies.length > 4) {
                const addHobbyLink = document.createElement('a');
                addHobbyLink.href = `pages/user.html?uid=${currentUser.uid}`;
                addHobbyLink.className = 'hobby-add-btn';
                addHobbyLink.innerHTML = '<i class="fas fa-plus"></i>';
                addHobbyLink.title = "Ver todos os hobbies";
                hobbiesContainer.appendChild(addHobbyLink);
            }
        } else {
            hobbiesContainer.innerHTML = '<p class="no-hobbies">Adicione seus hobbies no perfil!</p>';
        }
    }
    async function loadSuggestions() {
        if (!suggestionsContainer) return;
        suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';
        try {
            const currentUserHobbies = new Set(currentUserProfile.hobbies || []);
            if (currentUserHobbies.size === 0) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Adicione hobbies ao seu perfil para ver sugestões.</p>';
                return;
            }
            const exclusionIds = new Set();
            exclusionIds.add(currentUser.uid);
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
            friendsSnapshot.forEach(doc => exclusionIds.add(doc.id));
            const sentRequestsSnapshot = await db.collection('friendRequests').where('from', '==', currentUser.uid).get();
            sentRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().to));
            const receivedRequestsSnapshot = await db.collection('friendRequests').where('to', '==', currentUser.uid).get();
            receivedRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().from));
            const allUsersSnapshot = await db.collection('users').get();
            const suggestions = [];
            allUsersSnapshot.forEach(doc => {
                if (!exclusionIds.has(doc.id)) {
                    const user = { id: doc.id, ...doc.data() };
                    const userHobbies = new Set(user.hobbies || []);
                    const commonHobbies = [...currentUserHobbies].filter(hobby => userHobbies.has(hobby));
                    if (commonHobbies.length > 0) {
                        suggestions.push({
                            ...user,
                            commonHobbiesCount: commonHobbies.length
                        });
                    }
                }
            });
            suggestions.sort((a, b) => b.commonHobbiesCount - a.commonHobbiesCount);
            suggestionsContainer.innerHTML = '';
            const top5Suggestions = suggestions.slice(0, 5);
            if (top5Suggestions.length === 0) {
                suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma nova sugestão encontrada.</p>';
            } else {
                top5Suggestions.forEach(user => {
                    addSuggestionToDOM(user, user.commonHobbiesCount);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar sugestões:', error);
            if (suggestionsContainer) {
                suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
            }
        }
    }
    function isRepostItem(post) {
        return post?.type === 'repost' || !!post?.repostOfId || !!post?.originalPostId;
    }
    function basePostId(post) {
        return post?.repostOfId || post?.originalPostId || post?.id;
    }
    const hobbySearchInput = document.getElementById("hobby-search-input");

    function filterHobbies() {
        const searchTerm = hobbySearchInput.value.toLowerCase().trim();
        const allCategories = hobbyListContainer.querySelectorAll('.hobby-category');
        allCategories.forEach(category => {
            const labels = category.querySelectorAll('.hobby-label');
            let visibleHobbiesInCategory = 0;
            labels.forEach(label => {
                const hobbyText = label.textContent.toLowerCase();
                if (hobbyText.includes(searchTerm)) {
                    label.style.display = 'flex';
                    visibleHobbiesInCategory++;
                } else {
                    label.style.display = 'none';
                }
            });
            if (visibleHobbiesInCategory > 0) {
                category.style.display = 'block';
            } else {
                category.style.display = 'none';
            }
        });
    }

    if (hobbySearchInput) {
        hobbySearchInput.addEventListener('input', filterHobbies);
    }
    function renderRepostControls(post, currentUid) {
        const baseId = basePostId(post);
        if (isRepostItem(post)) {
            if (post?.authorId === currentUid) {
                return `<button class="undo-repost-btn" data-post-id="${baseId}" title="Desfazer sua republicação">
                            <i class="fas fa-retweet"></i> Desfazer
                        </button>`;
            }
            return '';
        }
        const hasReposted = Array.isArray(post?.repostedBy) && post.repostedBy.includes(currentUid);
        if (hasReposted) {
            return `<button class="undo-repost-btn" data-post-id="${baseId}" title="Desfazer sua republicação">
                            <i class="fas fa-retweet"></i> Desfazer
                        </button>`;
        }
        return `<button class="repost-btn" data-post-id="${baseId}" title="Republicar">
                            <i class="fas fa-retweet"></i> Republicar
                        </button>`;
    }
});

document.addEventListener('click', async (e) => {
    const rep = e.target.closest('.repost-btn, .undo-repost-btn');
    if (!rep) return;
    e.preventDefault();
    const baseId = rep.getAttribute('data-post-id');
    const auth = firebase.auth();
    const db = firebase.firestore();
    if (!auth.currentUser) return;
    try {
        await toggleRepost(baseId, auth.currentUser.uid, db);
    } catch (err) {
        console.error(err);
    }
});