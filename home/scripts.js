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
  // ... (logo após a configuração do Firebase)

  function showToast(message, type = 'info') { // type pode ser 'success', 'error', ou 'info'
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fas fa-info-circle';
    if (type === 'success') {
        iconClass = 'fas fa-check-circle';
    } else if (type === 'error') {
        iconClass = 'fas fa-exclamation-circle';
    }

    toast.innerHTML = `<i class="${iconClass}"></i><span>${message}</span>`;

    container.appendChild(toast);

    // Remove a notificação da tela após 5 segundos
    setTimeout(() => {
        toast.remove();
    }, 5000);
  }

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

  const loadingMoreIndicator = document.getElementById("loading-more-indicator"); // <--- ADICIONE ESTA LINHA
const feedView = document.getElementById("feed-view");
const singlePostView = document.getElementById("single-post-view");
const focusedPostContainer = document.getElementById("focused-post-container");
const backToFeedBtn = document.getElementById("back-to-feed-btn");
  // ...

  // Variáveis globais
  let currentUser = null;
  let currentUserProfile = null;
  let postsListener = null;
  let likeInProgress = {}; // Controle de likes em andamento
  let commentLikeInProgress = {}; // Controle de likes em comentários
  // --- VARIÁVEIS PARA O SCROLL INFINITO ---
  let lastVisiblePost = null; // Guarda o último post carregado
  let isLoadingMorePosts = false; // Impede carregamentos múltiplos ao mesmo tempo
  let noMorePosts = false; // Indica se chegamos ao fim de todos os posts
  const POSTS_PER_PAGE = 10; // Quantidade de posts para carregar por vez
  let targetPostId = null; // <-- ADICIONE ESTA LINHA
  // Em home/scripts.js

  // Função para compartilhar um post (copiar o link) - VERSÃO CORRIGIDA
  async function sharePost(postId) {
    // Pega a URL da página atual e remove quaisquer parâmetros antigos (? e #)
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
    }
  }

  // Em home/scripts.js

  // --- FUNÇÃO PARA BUSCAR, ROLAR E DESTACAR O POST DA URL ---
  async function findAndHighlightTargetPost() {
    // Se não há um post alvo, a função não faz nada
    if (!targetPostId) return;

    const postElement = document.querySelector(`.post[data-post-id="${targetPostId}"]`);

    if (postElement) {
      // --- SUCESSO: O POST FOI ENCONTRADO! ---
      // Rola a tela até o post
      postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Adiciona um destaque temporário
      postElement.style.transition = 'background-color 0.5s ease-in-out';
      postElement.style.backgroundColor = 'rgba(91, 90, 211, 0.2)'; // Roxo claro
      
      setTimeout(() => {
          postElement.style.backgroundColor = ''; // Remove o destaque
      }, 2500);

      // Limpa a URL e a variável de alvo para finalizar a operação
      history.replaceState(null, '', window.location.pathname);
      targetPostId = null;

    } else if (!noMorePosts && !isLoadingMorePosts) {
      // --- FALHA: O POST AINDA NÃO FOI ENCONTRADO ---
      // Se ainda não chegamos ao fim e não estamos carregando, carrega mais posts
      await loadMorePosts();
    }
  }

  // Função para formatar timestamp
  function formatTimestamp(date) {
    // Verificar se date é um objeto Date válido
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

  // Verificar autenticação do usuário
 // Verificar autenticação do usuário
 auth.onAuthStateChanged(async function (user) {
  if (user) {

    
    currentUser = user;
    await loadUserProfile(user.uid);

    backToFeedBtn.addEventListener('click', hideSinglePostView);    
    // Captura o ID do post da URL e armazena na variável global
    const urlParams = new URLSearchParams(window.location.search);
    const postIdFromUrl = urlParams.get('post');

    if (postIdFromUrl) {
            // SE a URL contiver um ID de post (ex: de um link compartilhado)
            // ele chama diretamente a visualização única.
            showSinglePostView(postIdFromUrl);
        } else {
            // SENÃO, ele carrega o feed principal, como fazia antes.
            loadInitialPosts();
        }

    targetPostId = urlParams.get('post');

    loadInitialPosts();
    loadSuggestions();

    window.addEventListener('scroll', handleScroll);
  } else {
    window.removeEventListener('scroll', handleScroll);
    window.location.href = "../login/login.html";
  }
});
  // Event listener para o botão de logout
  if (logoutButton) {
    logoutButton.addEventListener("click", function (e) {
      e.preventDefault();
      auth.signOut()
        .then(() => {
          window.location.href = "../login/login.html";
        })
        .catch((error) => {
          console.error("Erro ao fazer logout:", error);
          showCustomAlert("Erro ao fazer logout. Tente novamente.");
        });
    });
  }

  // Event listener para o botão de publicar
  if (postButton && postInput) {
    postButton.addEventListener("click", function () {
      const content = postInput.value.trim();
      if (content) {
        createPost(content);
        postInput.value = "";
      }
    });

    // Permitir publicar com Enter
    postInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        const content = postInput.value.trim();
        if (content) {
          createPost(content);
          postInput.value = "";
        }
      }
    });
  }

  // Função para carregar o perfil do usuário
  async function loadUserProfile(userId) {
    try {
      const doc = await db.collection("users").doc(userId).get();

      if (doc.exists) {
        currentUserProfile = doc.data();

        // Atualizar foto do usuário
        if (userPhotoElement && currentUserProfile.photoURL) {
          userPhotoElement.src = currentUserProfile.photoURL;
        }

        // Carregar hobbies do usuário
        if (userHobbiesContainer) {
          userHobbiesContainer.innerHTML = "";

          // Adicionar hobbies padrão
          if (currentUserProfile.hobbies && currentUserProfile.hobbies.length > 0) {
            currentUserProfile.hobbies.forEach((hobby) => {
              const hobbyTag = document.createElement("span");
              hobbyTag.className = "hobby-tag";
              hobbyTag.textContent = hobby;
              userHobbiesContainer.appendChild(hobbyTag);
            });
          }

          // Adicionar hobbies personalizados
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
        console.log("Perfil do usuário não encontrado.");
        window.location.href = "../profile/profile.html";
      }
    } catch (error) {
      console.error("Erro ao carregar perfil do usuário:", error);
    }
  }

  // Função para carregar posts
  // --- FUNÇÃO PARA CARREGAR OS POSTS INICIAIS ---
  // --- FUNÇÃO PARA CARREGAR OS POSTS INICIAIS (VERSÃO CORRIGIDA) ---
function loadInitialPosts() {
  if (postsContainer) {
      postsContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando publicações...</div>';
  }

  const query = db.collection("posts").orderBy("timestamp", "desc").limit(POSTS_PER_PAGE);

  // Este listener agora vai lidar tanto com a carga inicial quanto com os novos posts
  postsListener = query.onSnapshot((snapshot) => {
      const loadingIndicator = postsContainer.querySelector('.loading-posts');
      if (loadingIndicator) {
          loadingIndicator.remove(); // Remove o "Carregando..."
      }

      snapshot.docChanges().forEach((change) => {
          const postData = { id: change.doc.id, ...change.doc.data() };
          const existingPostElement = document.querySelector(`.post[data-post-id="${postData.id}"]`);

          if (change.type === "added") {
              if (existingPostElement) return; // Evita adicionar duplicatas

              const newPostElement = addPostToDOM(postData);

              // **AQUI ESTÁ A CORREÇÃO PRINCIPAL:**
              // Se o post é antigo (não é o primeiro da lista), adiciona no final.
              // Se for um post novo (inserido no topo), adiciona no topo.
              if (change.newIndex > 0) {
                  postsContainer.appendChild(newPostElement); // Posts da carga inicial vão para o final
              } else {
                  postsContainer.insertBefore(newPostElement, postsContainer.firstChild); // Posts novos vão para o topo
              }
          }
      });

      // Guarda o último post da leva inicial para a paginação
      if (!snapshot.empty) {
          lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
      } else {
          noMorePosts = true;
      }
      findAndHighlightTargetPost(); // <--- ADICIONE ESTA LINHA
  });
}

// --- FUNÇÃO PARA CARREGAR MAIS POSTS AO ROLAR A PÁGINA ---
async function loadMorePosts() {
    if (noMorePosts || isLoadingMorePosts) return;

    isLoadingMorePosts = true;
    loadingMoreIndicator.style.display = 'block';

    try {
        const query = db.collection("posts")
            .orderBy("timestamp", "desc")
            .startAfter(lastVisiblePost)
            .limit(POSTS_PER_PAGE);
        
        const snapshot = await query.get();

        if (snapshot.empty) {
            noMorePosts = true;
            return;
        }

        snapshot.forEach(doc => {
            const postData = { id: doc.id, ...doc.data() };
            const postElement = addPostToDOM(postData);
            postsContainer.appendChild(postElement); // Adiciona os posts antigos no final
        });

        lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];

       
        findAndHighlightTargetPost(); // <--- ADICIONE ESTA LINHA

    } catch (error) {
        console.error("Erro ao carregar mais posts:", error);
    } finally {
        isLoadingMorePosts = false;
        loadingMoreIndicator.style.display = 'none';
    }
}

// --- FUNÇÃO QUE DETECTA O SCROLL DO USUÁRIO ---
function handleScroll() {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    // Se o usuário rolou até 80% do final da página, carrega mais
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
        loadMorePosts();
    }
}
  // Função para criar um novo post
  async function createPost(content) {
    try {
      // Verificar se o usuário está autenticado
      if (!currentUser || !currentUserProfile) {
            showCustomAlert("Você precisa estar logado para publicar.");
        return;
      }

      // Desabilitar botão de publicar
      if (postButton) {
        postButton.disabled = true;
        postButton.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Publicando...';
      }

      // Criar objeto de post
      const postData = {
        content,
        authorId: currentUser.uid,
        authorName: currentUserProfile.nickname || "Usuário",
        authorPhoto: currentUserProfile.photoURL || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0,
        likedBy: [],
        commentCount: 0,
      };

      // Adicionar post ao Firestore
      await db.collection("posts").add(postData);

      // Reativar botão de publicar
      if (postButton) {
        postButton.disabled = false;
        postButton.textContent = "Publicar";
      }

      console.log("Post criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar post:", error);
          showCustomAlert("Erro ao criar publicação. Tente novamente.");

      // Reativar botão de publicar
      if (postButton) {
        postButton.disabled = false;
        postButton.textContent = "Publicar";
      }
    }
  }

async function showSinglePostView(postId) {
    // 1. Esconde o feed e mostra a área do post único
    feedView.style.display = 'none';
    singlePostView.style.display = 'block';
    window.scrollTo(0, 0); // Leva o usuário para o topo da página

    // 2. Atualiza a URL do navegador
    const url = new URL(window.location);
    url.searchParams.set('post', postId);
    history.pushState({}, '', url); // Ex: muda para home.html?post=ID_DO_POST

    // 3. Busca o post específico no Firestore
    focusedPostContainer.innerHTML = '<div class="loading-posts">...</div>'; // Mostra "Carregando..."
    const postRef = db.collection("posts").doc(postId);
    const doc = await postRef.get();

    if (doc.exists) {
        // 4. Se o post existe, ele o "desenha" na tela
        const postData = { id: doc.id, ...doc.data() };
        focusedPostContainer.innerHTML = '';
        
        // 5. Reutiliza a função addPostToDOM para criar o elemento
        const postElement = addPostToDOM(postData, true); // O 'true' avisa para não adicionar o evento de clique de novo
        
        // 6. Abre a seção de comentários automaticamente
        const commentsSection = postElement.querySelector('.post-comments');
        commentsSection.classList.add('active');
        loadComments(postId);

        focusedPostContainer.appendChild(postElement);
    } else {
        // Mostra uma mensagem de erro se o post não for encontrado
        focusedPostContainer.innerHTML = '<div class="error-message">...</div>';
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
}

  function addPostToDOM(post, isSingleView = false) {

    
    if (!postsContainer || !postTemplate) return;

    const postClone = document.importNode(postTemplate.content, true);
    const postElement = postClone.querySelector(".post");

    
    if (!isSingleView && !post.isRepost) {
        postElement.style.cursor = 'pointer'; // O mouse vira uma "mãozinha"
        postElement.addEventListener('click', (e) => {
            // Impede que a ação dispare ao clicar em botões, links, etc.
            if (e.target.closest('button, a, .post-actions')) {
                return;
            }
            // Chama a função para mostrar a visualização focada
            showSinglePostView(post.id);
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
    const shareButton = postClone.querySelector(".share-btn");
    const commentsSection = postClone.querySelector(".post-comments");
    const commentInput = postClone.querySelector(".comment-text");
    const sendCommentButton = postClone.querySelector(".send-comment-btn");
    const commentUserPhoto = postClone.querySelector(".comment-user-photo");

    postElement.dataset.postId = post.id;
    postElement.dataset.authorId = post.authorId;

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
    
    repostButton.addEventListener("click", () => repostPost(post.id));

    shareButton.addEventListener("click", () => sharePost(post.id)); 

    commentButton.addEventListener("click", () => {
      commentsSection.classList.toggle("active");
      if (commentsSection.classList.contains("active")) {
        loadComments(post.id);
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

    return postElement; 
  }
  // Função para redirecionar para o perfil do usuário
  function redirectToUserProfile(userId) {
    window.location.href = `../pages/user.html?uid=${userId}`;
  }

  // Função para alternar curtida em um post
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

  // Função para carregar comentários em tempo real
  function loadComments(postId) {
    const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
    const commentsList = postElement.querySelector(".comments-list");
    const commentInput = postElement.querySelector(".comment-text");
  
    if (!commentsList || !commentInput) return;
  
    // Salvar texto atual digitado
    const draftText = commentInput.value;
  
    commentsList.innerHTML = '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando comentários...</div>';
  
    return db
      .collection("posts")
      .doc(postId)
      .collection("comments")
      .orderBy("timestamp", "asc")
      .onSnapshot((snapshot) => {
        commentsList.innerHTML = "";
  
        if (snapshot.empty) {
          commentsList.innerHTML = '<div class="no-comments">Nenhum comentário ainda.</div>';
          return;
        }
  
        snapshot.forEach((doc) => {
          const comment = { id: doc.id, ...doc.data() };
          addCommentToDOM(postId, comment, commentsList);
          
        });
  
        // Restaurar o que estava digitado
        commentInput.value = draftText;
      }, (error) => {
        console.error("Erro ao escutar comentários:", error);
        commentsList.innerHTML = '<div class="error-message">Erro ao carregar comentários.</div>';
      });
  }
  
  

  // Função para adicionar um comentário ao DOM
  // Função para adicionar um comentário ao DOM
  function addCommentToDOM(postId, comment, commentsList) {
    if (!commentTemplate || !commentsList) return;

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
    commentsList.appendChild(commentClone);
  }

  // Função para adicionar um comentário a um post
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

  // Função para carregar sugestões de amizade
  async function loadSuggestions() {
    try {
      if (!suggestionsContainer) return;

      // Exibir indicador de carregamento
      suggestionsContainer.innerHTML =
        '<div class="loading-suggestions"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';

      // Obter hobbies do usuário atual
      const userHobbies = currentUserProfile.hobbies || [];

      // Buscar usuários com hobbies semelhantes
      const usersSnapshot = await db
        .collection("users")
        .where(firebase.firestore.FieldPath.documentId(), "!=", currentUser.uid)
        .limit(5)
        .get();

      // Limpar container de sugestões
      suggestionsContainer.innerHTML = "";

      // Verificar se há sugestões
      if (usersSnapshot.empty) {
        suggestionsContainer.innerHTML =
          '<div class="no-suggestions">Nenhuma sugestão encontrada.</div>';
        return;
      }

      // Filtrar usuários que já são amigos
      const friendsSnapshot = await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("friends")
        .get();

      const friendIds = friendsSnapshot.docs.map((doc) => doc.id);

      // Adicionar cada sugestão ao DOM
      let suggestionsAdded = 0;

      for (const doc of usersSnapshot.docs) {
        // Pular se já é amigo
        if (friendIds.includes(doc.id)) continue;

        const user = {
          id: doc.id,
          ...doc.data(),
        };

        // Calcular relevância com base em hobbies em comum
        const userHobbiesList = user.hobbies || [];
        const commonHobbies = userHobbiesList.filter((hobby) =>
          userHobbies.includes(hobby)
        );

        // Adicionar ao DOM
        addSuggestionToDOM(user, commonHobbies.length);
        suggestionsAdded++;

        // Limitar a 3 sugestões
        if (suggestionsAdded >= 3) break;
      }

      // Verificar se há sugestões
      if (suggestionsAdded === 0) {
        suggestionsContainer.innerHTML =
          '<div class="no-suggestions">Nenhuma sugestão encontrada.</div>';
      }
    } catch (error) {
      console.error("Erro ao carregar sugestões:", error);
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML =
          '<div class="error-message">Erro ao carregar sugestões. Tente novamente mais tarde.</div>';
      }
    }
  }
  // Função para adicionar uma sugestão ao DOM
  function addSuggestionToDOM(user, commonHobbiesCount) {
    if (!suggestionsContainer || !suggestionTemplate) return;

    // Clonar template
    const suggestionClone = document.importNode(suggestionTemplate.content, true);
    const suggestionElement = suggestionClone.querySelector(".suggestion");

    // Referências aos elementos da sugestão
    const photoElement = suggestionClone.querySelector(".suggestion-photo");
    const nameElement = suggestionClone.querySelector(".suggestion-name");
    const hobbiesElement = suggestionClone.querySelector(".suggestion-hobbies");
    const followButton = suggestionClone.querySelector(".follow-btn");

    // Definir ID
    suggestionElement.dataset.userId = user.id;

    // Definir foto do usuário
    if (user.photoURL) {
      photoElement.src = user.photoURL;
    }

    // Adicionar evento de clique para redirecionar ao perfil do usuário
    photoElement.addEventListener("click", function() {
      redirectToUserProfile(user.id);
    });

    // Definir nome do usuário
    nameElement.textContent = user.nickname || "Usuário";
    nameElement.addEventListener("click", function() {
      redirectToUserProfile(user.id);
    });

    // Definir hobbies em comum
    hobbiesElement.textContent = `${commonHobbiesCount} ${
      commonHobbiesCount === 1 ? "hobby" : "hobbies"
    } em comum`;

    // Adicionar event listener para o botão de seguir
    followButton.addEventListener("click", function () {
      sendFriendRequest(user.id, user);
      suggestionElement.remove();
    });

    // Adicionar sugestão ao container
    suggestionsContainer.appendChild(suggestionClone);
  }

  // Função para enviar uma solicitação de amizade
  async function sendFriendRequest(userId, userData) {
    try {
      // Verificar se é o próprio usuário
      if (userId === currentUser.uid) {
            showToast("Você não pode adicionar a si mesmo como amigo.");
        return;
      }

      // Verificar se já é amigo
      const friendDoc = await db
        .collection("users")
        .doc(currentUser.uid)
        .collection("friends")
        .doc(userId)
        .get();

      if (friendDoc.exists) {
            showToast("Este usuário já é seu amigo.");
        return;
      }

      // Verificar se já existe uma solicitação pendente
      const requestsSnapshot = await db
        .collection("users")
        .doc(userId)
        .collection("friendRequests")
        .where("fromUserId", "==", currentUser.uid)
        .where("status", "==", "pending")
        .get();

      if (!requestsSnapshot.empty) {
            showToast("Você já enviou uma solicitação de amizade para este usuário.");
        return;
      }

      // Criar solicitação de amizade
      await db.collection("users").doc(userId).collection("friendRequests").add({
        fromUserId: currentUser.uid,
        fromUserName: currentUserProfile.nickname || "Usuário",
        fromUserPhoto: currentUserProfile.photoURL || null,
        status: "pending",
        mutualFriends: 0, // Implementar cálculo de amigos em comum no futuro
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Criar notificação para o outro usuário
      await db.collection("users").doc(userId).collection("notifications").add({
        type: "friend_request",
        fromUserId: currentUser.uid,
        fromUserName: currentUserProfile.nickname || "Usuário",
        fromUserPhoto: currentUserProfile.photoURL || null,
        content: "enviou uma solicitação de amizade",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      // Exibir mensagem de sucesso
          showToast("Solicitação de amizade enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar solicitação de amizade:", error);
          showToast("Erro ao enviar solicitação. Tente novamente.");
    }
  }

    async function repostPost(postId) {
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

            // Evitar que alguém republique a própria republicação
            if (originalPostData.isRepost) {
                showCustomAlert("Não é possível republicar uma republicação.");
                return;
            }

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
                authorId: currentUser.uid, // O autor da republicação
                authorName: currentUserProfile.nickname || "Usuário",
                authorPhoto: currentUserProfile.photoURL || null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: 0,
                likedBy: [],
                commentCount: 0,
            };

            await db.collection("posts").add(repostData);

            // Notificar o autor original
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
            
            showToast("Publicação republicada com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao republicar:", error);
            showCustomAlert("Ocorreu um erro ao republicar. Tente novamente.");
        }
    }
});