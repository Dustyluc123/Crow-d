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

    function formatTimestamp(date) {
        if (!(date instanceof Date) || isNaN(date)) return "Agora mesmo";
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return "Agora mesmo";
        if (diff < 3600000) return `${Math.floor(diff/60000)}m atrás`;
        if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
        return date.toLocaleDateString('pt-BR');
    }

    function addPostToDOM(post) {
      if (!savedPostsContainer || !postTemplate) return null;
  
      const postClone = document.importNode(postTemplate.content, true);
      const postElement = postClone.querySelector(".post");
      
      postElement.addEventListener('click', (e) => {
          if (e.target.closest('button, a, .post-actions, .post-comments, .original-post-container, .post-image')) {
              return;
          }
          window.location.href = `../home/home.html?post=${post.id}`;
      });
  
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
      
      if (post.imageUrl) {
          postImageElement.src = post.imageUrl;
          postMediaContainer.style.display = 'block';
      } else {
          postMediaContainer.style.display = 'none';
      }
  
      if (post.authorId === currentUser.uid) {
          deletePostBtn.style.display = 'block';
          deletePostBtn.addEventListener('click', (e) => {
              e.stopPropagation(); 
              deletePost(post.id);
          });
      }
  
      if (post.authorPhoto) authorPhotoElement.src = post.authorPhoto;
      authorNameElement.textContent = post.authorName;
      if (post.timestamp) {
          timestampElement.textContent = formatTimestamp(post.timestamp.toDate());
      }
      contentElement.textContent = post.content;
      likeCount.textContent = post.likes || 0;
      commentCount.textContent = post.commentCount || 0;
  
      if (post.likedBy && post.likedBy.includes(currentUser.uid)) likeButton.classList.add("liked");
      if (post.repostedBy && post.repostedBy.includes(currentUser.uid)) {
          repostButton.classList.add("reposted");
      }
      if (post.savedBy && post.savedBy.includes(currentUser.uid)) {
          saveButton.classList.add("saved");
      }
      if(currentUserProfile && currentUserProfile.photoURL) commentUserPhoto.src = currentUserProfile.photoURL;
  
      // --- Adiciona os Event Listeners ---
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
          if(content) {
              addComment(post.id, content);
              commentInput.value = '';
          }
      });
  
      // **CORREÇÃO ADICIONADA AQUI**
      commentInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
              e.preventDefault(); // Impede a quebra de linha no input
              const content = commentInput.value.trim();
              if(content) {
                  addComment(post.id, content);
                  commentInput.value = '';
              }
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
    // Em salvos/salvos.js

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
            // Lógica para DESFAZER a republicação
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

            if (repostButtonUI) {
                repostButtonUI.classList.remove('reposted');
                repostButtonUI.innerHTML = `<i class="fas fa-retweet"></i> Republicar`;
            }
            showToast("Republicação removida.", "info");

        } else {
            // Lógica para CRIAR a republicação
            const repostData = {
                isRepost: true,
                originalPostId: postId,
                originalPost: {
                    content: originalPostData.content,
                    // --- INÍCIO DA CORREÇÃO ---
                    imageUrl: originalPostData.imageUrl || null, // <-- ESTA LINHA FOI ADICIONADA
                    // --- FIM DA CORREÇÃO ---
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
        console.error("Erro ao republicar:", error);
        showCustomAlert("Ocorreu um erro ao republicar. Tente novamente.");
    }
}
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
  const homeUrl = new URL('../home/home.html', window.location.href).href;
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