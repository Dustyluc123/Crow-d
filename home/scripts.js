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
  // Variáveis globais
 let currentUser = null;
 let currentUserProfile = null;
 let postsListener = null;
 let likeInProgress = {}; // Controle de likes em andamento
 let commentLikeInProgress = {}; // Controle de likes em comentários
let displayedReposts = new Set();
 let lastVisiblePost = null; // Guarda o último post carregado
 let isLoadingMorePosts = false; // Impede carregamentos múltiplos ao mesmo tempo
 let noMorePosts = false; // Indica se chegamos ao fim de todos os posts
 const POSTS_PER_PAGE = 10; // Quantidade de posts para carregar por vez
 let activeCommentListeners = {}; // Armazena os listeners de comentários ativos

 // Em scripts.js, adicione este bloco no topo

// --- INÍCIO DA LÓGICA DE UPLOAD DE IMAGEM PARA POSTS ---
const postImageInput = document.getElementById('post-image-input');
const imagePreviewContainer = document.getElementById('post-image-preview-container');
const imagePreview = document.getElementById('post-image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

let postImageBase64 = null; // Variável para guardar a imagem do post

if (postImageInput) {
    postImageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
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
    postImageInput.value = ''; // Limpa o input de arquivo
    imagePreviewContainer.style.display = 'none';
    imagePreview.src = '#';
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
       postsListener(); // Executa a função de 'unsubscribe' retornada pelo onSnapshot
       postsListener = null; // Limpa a variável
   }
}

 function formatTimestamp(date) {
   // Verificar se date é um objeto Date válido
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
  const c  = getPostsContainer();
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
           // Define o link para a página do usuário logado com o UID correto
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
      // ✨ CORREÇÃO APLICADA AQUI TAMBÉM ✨
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
let _isLoading   = false;
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

// insere com segurança (se ref não for filho, faz append)
function safeInsertBefore(container, node, ref) {
  if (!(node instanceof Node)) return;
  if (ref && ref.parentNode === container) {
    container.insertBefore(node, ref);
  } else {
    container.appendChild(node);
  }
}

// garante que _sentinel exista e seja filho do container
function ensureSentinel(container) {
  if (!container) return null;

  // se temos um sentinel antigo preso em outro container, remova-o
  if (_sentinel && _sentinel.parentNode !== container) {
    try { _sentinel.remove(); } catch {}
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
}function hydratePostDoc(doc) {
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
// home/scripts.js

async function loadInitialPosts() {
    if (!postsContainer) return;
    
    // Limpa o registo de duplicados sempre que o feed é recarregado do zero
    displayedReposts.clear(); 
    
    postsContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    isLoadingMorePosts = true;
    noMorePosts = false;
    lastVisiblePost = null;

    try {
        const query = db.collection("posts").orderBy("timestamp", "desc").limit(POSTS_PER_PAGE);
        const snapshot = await query.get();

        postsContainer.innerHTML = '';

        if (snapshot.empty) {
            noMorePosts = true;
            postsContainer.innerHTML = '<div class="info-message">Nenhum post encontrado.</div>';
            return;
        }

        for (const doc of snapshot.docs) {
            let postData = { id: doc.id, ...doc.data() };

            if (postData.isRepost && postData.originalPostId) {
                const repostKey = `${postData.authorId}_${postData.originalPostId}`;
                if (displayedReposts.has(repostKey)) {
                    continue;
                }
                displayedReposts.add(repostKey);

                const originalPostRef = db.collection('posts').doc(postData.originalPostId);
                const originalPostDoc = await originalPostRef.get();
                
                if (originalPostDoc.exists) {
                    postData.originalPost = { id: originalPostDoc.id, ...originalPostDoc.data() };
                } else {
                    postData.originalPost = {}; 
                }
            }

            const postElement = addPostToDOM(postData);
            if (postElement) {
                postsContainer.appendChild(postElement);
            }
        }
        
        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
    } catch (error) {
        console.error("Erro ao carregar posts iniciais:", error);
        postsContainer.innerHTML = '<div class="error-message">Erro ao carregar posts.</div>';
    } finally {
        isLoadingMorePosts = false;
    }
}
// home/scripts.js

async function loadMorePosts() {
    if (noMorePosts || isLoadingMorePosts || !lastVisiblePost) return;

    isLoadingMorePosts = true;
    loadingMoreIndicator.style.display = 'block';

    try {
        const query = db.collection("posts").orderBy("timestamp", "desc").startAfter(lastVisiblePost).limit(POSTS_PER_PAGE);
        const snapshot = await query.get();

        if (snapshot.empty) {
            noMorePosts = true;
            return;
        }

        for (const doc of snapshot.docs) {
            let postData = { id: doc.id, ...doc.data() };

            if (postData.isRepost && postData.originalPostId) {
                const repostKey = `${postData.authorId}_${postData.originalPostId}`;
                if (displayedReposts.has(repostKey)) {
                    continue; 
                }
                displayedReposts.add(repostKey);

                const originalPostRef = db.collection('posts').doc(postData.originalPostId);
                const originalPostDoc = await originalPostRef.get();
                
                if (originalPostDoc.exists) {
                    postData.originalPost = { id: originalPostDoc.id, ...originalPostDoc.data() };
                } else {
                    postData.originalPost = {};
                }
            }

            const postElement = addPostToDOM(postData);
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

function initFeed() {
  const container = getPostsContainer();
  if (!container) return;

  // reseta observador e sentinela
  if (_io) { _io.disconnect(); _io = null; }
  _sentinel = null;

  loadInitialPosts();
}

// Inicie o feed só quando logado:
firebase.auth().onAuthStateChanged((user) => {
  if (user) initFeed();
});
// home/scripts.js

async function deletePost(postId) {
    const confirmed = await showConfirmationModal(
        "Excluir Publicação",
        "Tem a certeza que deseja excluir esta publicação? Todas as suas republicações também serão removidas permanentemente.",
        "Sim, Excluir Tudo",
        "Cancelar"
    );

    if (confirmed) {
        try {
            const batch = db.batch();

            // 1. Adiciona a publicação original ao lote de exclusão
            const postRef = db.collection('posts').doc(postId);
            batch.delete(postRef);

            // 2. Encontra todas as republicações que apontam para o post original
            const repostsQuery = db.collection('posts').where('originalPostId', '==', postId);
            const repostsSnapshot = await repostsQuery.get();

            // 3. Adiciona cada republicação encontrada ao mesmo lote de exclusão
            repostsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 4. Executa todas as exclusões de uma só vez
            await batch.commit();

            showToast("Publicação e todas as suas republicações foram excluídas.", "success");
            
            // 5. Remove todos os elementos relacionados da tela imediatamente
            const postElements = document.querySelectorAll(
                `.post[data-post-id="${postId}"], .post[data-base-post-id="${postId}"]`
            );
            postElements.forEach(el => el.remove());

        } catch (error) {
            console.error("Erro ao excluir publicação e republicações:", error);
            showCustomAlert("Ocorreu um erro ao tentar excluir a publicação.");
        }
    }
}
/**
 * Exclui um comentário de uma publicação.
 * @param {string} postId O ID da publicação pai.
 * @param {string} commentId O ID do comentário a ser excluído.
 */
async function deleteComment(postId, commentId) {
    const confirmed = await showConfirmationModal("Excluir Comentário", "Tem a certeza que deseja excluir este comentário?");
    
    if (confirmed) {
        try {
            const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);
            await commentRef.delete();

            // Decrementa a contagem de comentários no post
            const postRef = db.collection('posts').doc(postId);
            await postRef.update({
                commentCount: firebase.firestore.FieldValue.increment(-1)
            });

            showToast("Comentário excluído.", "info");
            // O onSnapshot dos comentários cuidará de remover da tela.
        } catch (error) {
            console.error("Erro ao excluir comentário:", error);
            showCustomAlert("Ocorreu um erro ao excluir o comentário.");
        }
    }
}
// Em scripts.js, substitua a função createPost

// Em home/scripts.js, substitua a função createPost inteira

async function createPost(content) {
    try {
        if (!currentUser || !currentUserProfile) {
            showCustomAlert("Você precisa estar logado para publicar.");
            return;
        }

        if (!content && !postImageBase64) {
            showCustomAlert("Escreva algo ou adicione uma imagem para publicar.");
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
            imageURL: postImageBase64
        };

        const docRef = await db.collection("posts").add(postData);

        // Após criar, busca o post completo para adicionar no DOM
        const newPostDoc = await docRef.get();
        const newPostData = { id: newPostDoc.id, ...newPostDoc.data() };
        
        // ▼▼▼ AQUI ESTÁ A CORREÇÃO ▼▼▼
        // Adiciona o novo post no topo do feed, passando 'true' para o parâmetro 'prepend'
        addPostToDOM(newPostData, false, true); 

        // Limpa os campos de input
        postInput.value = "";
        clearPostImage();

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
// Adicione esta função ao seu scripts.js

/**
 * Controla o evento de rolagem da página para carregar mais posts.
 */
function handleScroll() {
    // Se não há mais posts para carregar ou se já estamos carregando, não faz nada.
    if (noMorePosts || isLoadingMorePosts) {
        return;
    }

    // Calcula a posição da rolagem
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

    // Se o usuário rolou até 500 pixels do final da página, carrega mais posts.
    if (scrollTop + clientHeight >= scrollHeight - 500) {
        loadMorePosts();
    }
}

// Garanta que o listener do botão de voltar seja adicionado aqui.
backToFeedBtn.addEventListener('click', hideSinglePostView);
// home/scripts.js

function addPostToDOM(post, isSingleView = false) {
    if (!postTemplate) {
        console.error("Template de post não encontrado.");
        return null;
    }

    // VERIFICAÇÃO DE REPUBLICACÃO ÓRFÃ
    if (post.isRepost && (!post.originalPost || Object.keys(post.originalPost).length === 0)) {
        console.warn(`Republicação órfã (ID: ${post.id}) não será exibida pois o post original (ID: ${post.originalPostId}) foi apagado.`);
        // Opcional: para limpar o seu banco de dados, descomente a linha abaixo
        // db.collection('posts').doc(post.id).delete();
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
        repostHeader.innerHTML = `<i class="fas fa-retweet"></i> <a href="pages/user.html?uid=${post.authorId}" class="repost-author-link">${post.authorName}</a> republicou`;
        postElement.prepend(repostHeader);
        
        // Remove completamente os botões de ação para republicações
        if (actionsContainer) {
            actionsContainer.remove();
        }
    }

    // Preenche as informações do post (usando o post original se for um repost)
    postElement.querySelector(".post-author-photo").src = basePost.authorPhoto || 'img/Design sem nome2.png';
    postElement.querySelector(".post-author-name").textContent = basePost.authorName || 'Usuário';
    postElement.querySelector(".post-text").textContent = basePost.content || '';
    if (basePost.timestamp?.toDate) {
        postElement.querySelector(".post-timestamp").textContent = formatTimestamp(basePost.timestamp.toDate());
    }

    const mediaContainer = postElement.querySelector(".post-media");
    if (basePost.imageURL) {
        postElement.querySelector(".post-image").src = basePost.imageURL;
        mediaContainer.style.display = 'block';
    } else {
        mediaContainer.style.display = 'none';
    }
    
    // Configura os botões APENAS se não for uma republicação
    if (!post.isRepost && actionsContainer) {
        const likeBtn = postElement.querySelector(".like-btn");
        const repostBtn = postElement.querySelector(".repost-btn");
        const saveBtn = postElement.querySelector(".save-btn");
        const shareBtn = postElement.querySelector(".share-btn");
        const deleteBtn = postElement.querySelector('.post-delete-btn');

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

    // Configuração dos Comentários (funciona para posts originais e republicações)
    const commentsSection = postElement.querySelector('.post-comments');
    const commentBtn = postElement.querySelector(".comment-btn");
    
    if (commentBtn) { // Verifica se o botão de comentário existe
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
            if (e.target.closest('a, button, input, .post-actions, .comment-input, .comment-text')) {
                return;
            }
            showSinglePostView(baseId);
        });
    }
    
    return postElement;
}
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
        
        // CORREÇÃO: Pega o elemento retornado pela função
        const postElement = addPostToDOM(postData, true);

        if (postElement) {
            // Abre a seção de comentários por padrão
            const commentsSection = postElement.querySelector('.post-comments');
            const commentsList = postElement.querySelector('.comments-list');
            commentsSection.classList.add('active');
            loadComments(postId, commentsList);

            // Adiciona o elemento ao container do post focado
            focusedPostContainer.appendChild(postElement);
        }
    } else {
        focusedPostContainer.innerHTML = '<div class="error-message">Esta publicação não foi encontrada ou foi removida.</div>';
    }
}
function hideSinglePostView() {
   // 1. Faz o processo inverso: esconde a área do post e mostra o feed
  
   singlePostView.style.display = 'none';
   feedView.style.display = 'block';
   focusedPostContainer.innerHTML = ''; // Limpa o contêiner para a próxima vez


   // 2. Limpa a URL, removendo o parâmetro '?post=...'
   const url = new URL(window.location);
   url.searchParams.delete('post');
   history.pushState({}, '', url);
   loadInitialPosts();
}
async function createPost(content) {
    try {
        if (!currentUser || !currentUserProfile) {
            showCustomAlert("Você precisa estar logado para publicar.");
            return;
        }

        if (!content && !postImageBase64) {
            showCustomAlert("Escreva algo ou adicione uma imagem para publicar.");
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
            imageURL: postImageBase64
        };

        const docRef = await db.collection("posts").add(postData);
        const newPostDoc = await docRef.get();
        const newPostData = { id: newPostDoc.id, ...newPostDoc.data() };
        
        // Cria o elemento do post com a função já corrigida
        const postElement = addPostToDOM(newPostData);

        if (postElement) {
            // Usa prepend para adicionar no topo do container de posts
            postsContainer.prepend(postElement);
        }

        postInput.value = "";
        clearPostImage();

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
 function redirectToUserProfile(userId) {
   window.location.href = `pages/user.html?uid=${userId}`;
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
        
        // Atualização da UI imediata
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
            // Lógica de notificação (opcional)
        }
    } catch (error) {
        console.error("Erro ao curtir post:", error);
    } finally {
        likeInProgress[postId] = false;
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
        
        // Atualização da UI imediata
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
            // Lógica de notificação (opcional)
        }
    } catch (error) {
        console.error("Erro ao curtir post:", error);
    } finally {
        likeInProgress[postId] = false;
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
// home/scripts.js

function loadComments(postId, commentsListElement) {
    if (!commentsListElement) {
        console.error("Elemento da lista de comentários não fornecido.");
        return () => {}; // Retorna uma função vazia para não quebrar o código
    }

    // Limpa a lista antes de carregar e mostra o indicador de carregamento
    commentsListElement.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

    const query = db.collection("posts").doc(postId).collection("comments").orderBy("timestamp", "asc");

    // Retorna a função de unsubscribe para ser chamada mais tarde
    return query.onSnapshot(snapshot => {
        commentsListElement.innerHTML = ''; // Limpa novamente para garantir

        if (snapshot.empty) {
            commentsListElement.innerHTML = '<div class="no-comments">Nenhum comentário ainda. Seja o primeiro!</div>';
            return;
        }

        snapshot.forEach(doc => {
            const commentData = { id: doc.id, ...doc.data() };
            // A função que desenha o comentário individual (sem alterações necessárias)
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

    // Referências aos elementos do comentário
    const authorPhotoElement = commentClone.querySelector(".comment-author-photo");
    const authorNameElement = commentClone.querySelector(".comment-author-name");
    const timestampElement = commentClone.querySelector(".comment-timestamp");
    const contentElement = commentClone.querySelector(".comment-text");
    const likeButton = commentClone.querySelector(".comment-like-btn");
    const likeCount = commentClone.querySelector(".comment-like-count");
    // ✨ NOVO: Referência ao botão de excluir comentário
    const deleteCommentBtn = commentClone.querySelector('.comment-delete-btn');

    // Adiciona a ação de clique ao botão de curtir
    likeButton.addEventListener("click", function () {
        toggleCommentLike(postId, comment.id);
    });

    // Definir IDs
    commentElement.dataset.commentId = comment.id;
    commentElement.dataset.authorId = comment.authorId;

    // Preenche os dados do comentário
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

        const commentCountElement = document.querySelector(`.post[data-post-id="${postId}"] .comment-count`);
        if (commentCountElement) {
            const currentCount = parseInt(commentCountElement.textContent) || 0;
            commentCountElement.textContent = currentCount + 1;
        }

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

// Em scripts.js, substitua a sua função loadSuggestions por esta versão:



// Adicione este script para controlar os menus laterais no celular
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


 // Fecha os menus se clicar fora deles
 document.addEventListener('click', (e) => {
       if (leftSidebar && leftSidebar.classList.contains('open') && !leftSidebar.contains(e.target) && !leftSidebarToggle.contains(e.target)) {
            leftSidebar.classList.remove('open');
       }
       if (rightSidebar && rightSidebar.classList.contains('open') && !rightSidebar.contains(e.target) && !rightSidebarToggle.contains(e.target)) {
            rightSidebar.classList.remove('open');
       }
 });
function addSuggestionToDOM(user, commonHobbiesCount) {
    if (!suggestionsContainer || !suggestionTemplate) return;

    const suggestionClone = document.importNode(suggestionTemplate.content, true);
    const suggestionElement = suggestionClone.querySelector(".suggestion");
    const photoElement = suggestionClone.querySelector(".suggestion-photo");
    const nameElement = suggestionClone.querySelector(".suggestion-name");
    const hobbiesElement = suggestionClone.querySelector(".suggestion-hobbies");
    const followButton = suggestionClone.querySelector(".follow-btn");

    suggestionElement.dataset.userId = user.id;

    if (user.photoURL) {
        photoElement.src = user.photoURL;
    }
    photoElement.addEventListener("click", () => redirectToUserProfile(user.id));

    nameElement.textContent = user.nickname || "Usuário";
    nameElement.addEventListener("click", () => redirectToUserProfile(user.id));

    hobbiesElement.textContent = `${commonHobbiesCount} ${commonHobbiesCount === 1 ? "hobby" : "hobbies"} em comum`;

    // Ação de clique corrigida
    followButton.addEventListener("click", async function() {
        // Desativa o botão para evitar cliques múltiplos
        this.disabled = true;
        this.textContent = 'Aguarde...';

        const success = await sendFriendRequest(user.id, user);
        
        if (success) {
            // Remove o card da tela apenas se o pedido for enviado com sucesso
            suggestionElement.remove();
        } else {
            // Reativa o botão se o envio falhar
            this.disabled = false;
            this.textContent = 'Seguir';
        }
    });

    suggestionsContainer.appendChild(suggestionClone);
}

async function sendFriendRequest(userId, userData) {
    if (!currentUserProfile || !currentUserProfile.nickname) {
        showToast("Seu perfil ainda não foi carregado, tente novamente.", "error");
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
        if (friendDoc.exists) throw new Error('Este usuário já é seu amigo.');

        const requestId = [currentUser.uid, userId].sort().join('_');
        const requestRef = db.collection('friendRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        if (requestDoc.exists) throw new Error('Já existe um pedido pendente.');

        const batch = db.batch();
        
        // --- INÍCIO DA MUDANÇA ---
        // 1. Cria a referência da notificação PRIMEIRO para obter seu ID único
        const notificationRef = db.collection("users").doc(userId).collection("notifications").doc();

        // 2. Prepara os dados do pedido de amizade, INCLUINDO o ID da notificação
        batch.set(requestRef, {
            from: currentUser.uid,
            to: userId,
            fromUserName: currentUserProfile.nickname,
            fromUserPhoto: currentUserProfile.photoURL || null,
            notificationId: notificationRef.id, // <-- CAMPO ADICIONADO
            status: "pending",
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Prepara os dados da notificação (como antes)
        batch.set(notificationRef, {
            type: "friend_request",
            fromUserId: currentUser.uid,
            fromUserName: currentUserProfile.nickname,
            fromUserPhoto: currentUserProfile.photoURL || null,
            content: "enviou uma solicitação de amizade",
            requestId: requestRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        // --- FIM DA MUDANÇA ---
        
        await batch.commit();
        
        showToast("Solicitação enviada!", "success");
        if (followButton) {
            followButton.textContent = 'Pendente';
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
// home/scripts.js

async function toggleRepost(basePostId, buttonElement) {
    // Desativa o botão imediatamente para evitar cliques duplos
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
        const repostedBy = originalPostData.repostedBy || [];
        const hasReposted = repostedBy.includes(currentUser.uid);

        if (hasReposted) {
            // --- AÇÃO PARA "JUNTAR" E LIMPAR OS DUPLICADOS ---
            // Esta parte procura e apaga TODAS as republicações que você fez deste post.
            const repostQuery = db.collection("posts")
                .where("originalPostId", "==", basePostId)
                .where("authorId", "==", currentUser.uid);
            
            const repostSnapshot = await repostQuery.get();
            
            if (repostSnapshot.empty) {
                // Se não encontrar republicações mas o post original ainda diz que sim, corrige o post original.
                await postRef.update({
                    repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
                console.warn("Corrigido estado de republicação inconsistente.");
                showToast("Estado de republicação corrigido.", "info");
                return;
            }

            // Inicia uma operação em lote para apagar todos os duplicados de uma vez
            const batch = db.batch();
            repostSnapshot.forEach(doc => {
                batch.delete(doc.ref); // Adiciona cada duplicado ao lote de exclusão
            });
            
            // Atualiza o post original para remover a sua marcação de republicação
            // e subtrai o número exato de republicações apagadas.
            batch.update(postRef, {
                repostedBy: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
                repostCount: firebase.firestore.FieldValue.increment(-repostSnapshot.size)
            });

            await batch.commit();

            if (buttonElement) {
                buttonElement.classList.remove('reposted');
                buttonElement.innerHTML = `<i class="fas fa-retweet"></i> Republicar`;
            }
            showToast("Republicações duplicadas removidas.", "info");

        } else {
            // --- AÇÃO PARA CRIAR UMA NOVA E ÚNICA REPUBLICAÇÃO ---
            // (Esta parte do código já está correta e previne novos duplicados)
            if (originalPostData.isRepost) {
                showCustomAlert("Não é possível republicar uma republicação.");
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
                likes: 0,
                likedBy: [],
                commentCount: 0,
            };

            await db.collection("posts").add(repostData);
            await postRef.update({
                repostedBy: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
                repostCount: firebase.firestore.FieldValue.increment(1)
            });
            
            if (buttonElement) {
                buttonElement.classList.add('reposted');
                buttonElement.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
            }
            showToast("Publicação republicada!", "success");
        }
    } catch (error) {
        console.error("Erro ao republicar:", error);
        showCustomAlert("Ocorreu um erro ao republicar. Tente novamente.");
    } finally {
        if (buttonElement) buttonElement.disabled = false; // Reativa o botão no final
        // Recarrega o feed para mostrar as mudanças
        if (typeof loadInitialPosts === 'function') {
            loadInitialPosts();
        }
    }
}
async function loadUpcomingEvents() {
   const upcomingEventsContainer = document.getElementById('upcoming-events-container');
   if (!upcomingEventsContainer) return;


   upcomingEventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i></div>';


   try {
       const now = new Date();
       const snapshot = await db.collection('events')
           .where('eventDateTime', '>=', now) // Apenas eventos que ainda não aconteceram
           .orderBy('eventDateTime', 'desc')   // Ordena pelos mais próximos
           .limit(3)                          // Pega apenas os 3 primeiros
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
       // Define o limite de tempo para "próximo": 24 horas a partir de agora
       const upcomingLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);


       // 1. Encontra todos os eventos futuros em que o utilizador participa
       const eventsSnapshot = await db.collection('events')
           .where('participants', 'array-contains', currentUser.uid)
           .where('eventDateTime', '>=', now) // Apenas eventos que ainda não aconteceram
           .where('eventDateTime', '<=', upcomingLimit) // Apenas eventos nas próximas 24h
           .get();


       if (eventsSnapshot.empty) {
           // Nenhum evento próximo para notificar
           return;
       }


       // 2. Para cada evento próximo, verifica se já existe uma notificação
       eventsSnapshot.forEach(async (doc) => {
           const event = { id: doc.id, ...doc.data() };
           const eventId = event.id;


           // Procura por uma notificação de lembrete já existente para este evento
           const notificationQuery = await db.collection('users').doc(currentUser.uid).collection('notifications')
               .where('type', '==', 'event_reminder')
               .where('eventId', '==', eventId)
               .limit(1)
               .get();
          
           // 3. Se não existir notificação, cria uma nova
           if (notificationQuery.empty) {
               const eventDate = event.eventDateTime.toDate();
               const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });


               await db.collection('users').doc(currentUser.uid).collection('notifications').add({
                   type: 'event_reminder',
                   eventId: eventId,
                   fromUserName: 'Sistema de Eventos', // Notificação do sistema
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
// Em home/scripts.js, substitua a função inteira

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

        // ▼▼▼ ADICIONE ESTA VERIFICAÇÃO DE SEGURANÇA ▼▼▼
        // Impede a republicação de um post que já é uma republicação.
        if (postData.isRepost) {
            showCustomAlert("Não é possível republicar um post já republicado.");
            return; 
        }
        // ▲▲▲ FIM DA VERIFICAÇÃO ▲▲▲

        // Cria o novo post como uma republicação
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
            isRepost: true, // Marca como uma republicação
            originalPostId: postId, // Link para o post original
            originalAuthorId: postData.authorId,
            originalAuthorName: postData.authorName,
        };

        await db.collection("posts").add(newPost);

        // Atualiza a contagem de republicações no post original
        await postToRepostRef.update({
            repostCount: firebase.firestore.FieldValue.increment(1)
        });

        showCustomAlert("Post republicado com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao republicar o post:", error);
        showCustomAlert("Ocorreu um erro ao republicar.");
    }
}
// Em home/scripts.js, substitua a função loadSuggestions por esta:
// Adicione esta nova função ao ficheiro: home/scripts.js

function loadHobbiesPreview() {
    const hobbiesContainer = document.getElementById('hobbies-preview-container');
    if (!hobbiesContainer) return;

    hobbiesContainer.innerHTML = ''; // Limpa o conteúdo anterior

    const hobbies = currentUserProfile.hobbies || [];

    if (hobbies.length > 0) {
        // Pega apenas os primeiros 4 hobbies para a pré-visualização
        const hobbiesToShow = hobbies.slice(0, 4);

        hobbiesToShow.forEach(hobby => {
            const hobbyElement = document.createElement('span');
            hobbyElement.className = 'hobby-tag';
            hobbyElement.textContent = hobby;
            hobbiesContainer.appendChild(hobbyElement);
        });

        // Adiciona o botão "+" que leva ao perfil para ver/editar todos os hobbies
        if (hobbies.length > 4) {
             const addHobbyLink = document.createElement('a');
// Esta é a correção: Aponta para a sua página de perfil com o caminho correto
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
        // 1. Obter os hobbies do utilizador atual
        const currentUserHobbies = new Set(currentUserProfile.hobbies || []);
        if (currentUserHobbies.size === 0) {
            suggestionsContainer.innerHTML = '<p class="no-suggestions">Adicione hobbies ao seu perfil para ver sugestões.</p>';
            return;
        }

        // 2. Obter a lista de IDs a excluir (o próprio utilizador, amigos, pedidos pendentes)
        const exclusionIds = new Set();
        exclusionIds.add(currentUser.uid);

        const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
        friendsSnapshot.forEach(doc => exclusionIds.add(doc.id));

        const sentRequestsSnapshot = await db.collection('friendRequests').where('from', '==', currentUser.uid).get();
        sentRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().to));

        const receivedRequestsSnapshot = await db.collection('friendRequests').where('to', '==', currentUser.uid).get();
        receivedRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().from));

        // 3. Obter todos os outros utilizadores
        const allUsersSnapshot = await db.collection('users').get();

        const suggestions = [];

        allUsersSnapshot.forEach(doc => {
            // Se o ID do utilizador NÃO ESTIVER na lista de exclusão, processa-o
            if (!exclusionIds.has(doc.id)) {
                const user = { id: doc.id, ...doc.data() };
                const userHobbies = new Set(user.hobbies || []);
                
                // 4. Calcular hobbies em comum
                const commonHobbies = [...currentUserHobbies].filter(hobby => userHobbies.has(hobby));
                
                if (commonHobbies.length > 0) {
                    suggestions.push({
                        ...user,
                        commonHobbiesCount: commonHobbies.length
                    });
                }
            }
        });

        // 5. Ordenar as sugestões por quem tem mais hobbies em comum
        suggestions.sort((a, b) => b.commonHobbiesCount - a.commonHobbiesCount);

        // 6. Mostrar apenas as 5 melhores sugestões na página inicial
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
// ====== helpers para repost ======
function isRepostItem(post) {
  return post?.type === 'repost' || !!post?.repostOfId || !!post?.originalPostId;
}
function basePostId(post) {
  return post?.repostOfId || post?.originalPostId || post?.id;
}

/**
 * Renderiza os botões de Republicar/Desfazer corretamente.
 * - Em REPUBLICAÇÕES: NUNCA mostra "Republicar". Só mostra "Desfazer" se a republicação for SUA.
 * - Em POSTS ORIGINAIS: mostra "Desfazer" se você já republicou; senão, "Republicar".
 */
function renderRepostControls(post, currentUid) {
  const baseId = basePostId(post);

  // Card é uma republicação
  if (isRepostItem(post)) {
    // Só o dono da republicação vê "Desfazer"
    if (post?.authorId === currentUid) {
      return `<button class="undo-repost-btn" data-post-id="${baseId}" title="Desfazer sua republicação">
                <i class="fas fa-retweet"></i> Desfazer
              </button>`;
    }
    return ''; // mais ninguém vê botão em republicações
  }

  // Card é post original
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

 // === Listener global dos botões de (des)republicação — cole no FINAL do JS do FEED ===
document.addEventListener('click', async (e) => {
  const rep = e.target.closest('.repost-btn, .undo-repost-btn');
  if (!rep) return;

  e.preventDefault();

  const baseId = rep.getAttribute('data-post-id');
  const auth = firebase.auth();
  const db   = firebase.firestore();

  if (!auth.currentUser) return;

  try {
    await toggleRepost(baseId, auth.currentUser.uid, db);
    // se você tem uma função que re-renderiza o card/linha, chame aqui:
    // ex.: refreshPostCard(baseId) OU recarregue o bloco do feed
  } catch (err) {
    console.error(err);
    // opcional: toast('Falha ao (des)republicar', 'error');
  }
  
});
