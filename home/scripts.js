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

  // Inicializar Firebase
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

  // Variáveis globais
  let currentUser = null;
  let currentUserProfile = null;
  let postsListener = null;
  let likeInProgress = {}; // Controle de likes em andamento
  let commentLikeInProgress = {}; // Controle de likes em comentários

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
  auth.onAuthStateChanged(async function (user) {
    if (user) {
      // Usuário está logado
      currentUser = user;

      // Carregar perfil do usuário
      await loadUserProfile(user.uid);

      // Carregar posts
      loadPosts();

      // Carregar sugestões
      loadSuggestions();
    } else {
      // Usuário não está logado, redirecionar para login
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
          alert("Erro ao fazer logout. Tente novamente.");
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
  function loadPosts() {
    // Limpar container de posts
    if (postsContainer) {
      postsContainer.innerHTML =
        '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando publicações...</div>';
    }

    // Remover listener anterior se existir
    if (postsListener) {
      postsListener();
    }

    // Criar listener para posts em tempo real
    postsListener = db
      .collection("posts")
      .orderBy("timestamp", "desc")
      .limit(20)
      .onSnapshot(
        (snapshot) => {
          // Limpar container de posts
          if (postsContainer) {
            postsContainer.innerHTML = "";
          }

          // Verificar se há posts
          if (snapshot.empty) {
            if (postsContainer) {
              postsContainer.innerHTML =
                '<div class="no-posts">Nenhuma publicação encontrada. Seja o primeiro a publicar!</div>';
            }
            return;
          }

          // Adicionar cada post ao DOM
          snapshot.forEach((doc) => {
            const post = {
              id: doc.id,
              ...doc.data(),
            };

            addPostToDOM(post);
          });
        },
        (error) => {
          console.error("Erro ao carregar posts:", error);
          if (postsContainer) {
            postsContainer.innerHTML =
              '<div class="error-message">Erro ao carregar publicações. Tente novamente mais tarde.</div>';
          }
        }
      );
  }

  // Função para criar um novo post
  async function createPost(content) {
    try {
      // Verificar se o usuário está autenticado
      if (!currentUser || !currentUserProfile) {
        alert("Você precisa estar logado para publicar.");
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
      alert("Erro ao criar publicação. Tente novamente.");

      // Reativar botão de publicar
      if (postButton) {
        postButton.disabled = false;
        postButton.textContent = "Publicar";
      }
    }
  }

  // Função para adicionar um post ao DOM
  function addPostToDOM(post) {
    if (!postsContainer || !postTemplate) return;

    // Clonar template
    const postClone = document.importNode(postTemplate.content, true);
    const postElement = postClone.querySelector(".post");

    // Referências aos elementos do post
    const authorPhotoElement = postClone.querySelector(".post-author-photo");
    const authorNameElement = postClone.querySelector(".post-author-name");
    const timestampElement = postClone.querySelector(".post-timestamp");
    const contentElement = postClone.querySelector(".post-text");
    const mediaElement = postClone.querySelector(".post-media");
    const likeButton = postClone.querySelector(".like-btn");
    const likeCount = postClone.querySelector(".like-count");
    const commentButton = postClone.querySelector(".comment-btn");
    const commentCount = postClone.querySelector(".comment-count");
    const commentInput = postClone.querySelector(".comment-text");
    const sendCommentButton = postClone.querySelector(".send-comment-btn");
    const commentUserPhoto = postClone.querySelector(".comment-user-photo");
    const commentsSection = postClone.querySelector(".post-comments");
    const commentsList = postClone.querySelector(".comments-list");

    // Definir IDs
    postElement.dataset.postId = post.id;
    postElement.dataset.authorId = post.authorId;

    // Definir foto do autor
    if (post.authorPhoto) {
      authorPhotoElement.src = post.authorPhoto;
    }

    // Adicionar evento de clique para redirecionar ao perfil do autor
    authorPhotoElement.addEventListener("click", function() {
      redirectToUserProfile(post.authorId);
    });

    // Definir nome do autor
    authorNameElement.textContent = post.authorName;
    authorNameElement.addEventListener("click", function() {
      redirectToUserProfile(post.authorId);
    });

    // Definir timestamp
    if (post.timestamp) {
      const date = post.timestamp instanceof Date ? post.timestamp : post.timestamp.toDate();
      timestampElement.textContent = formatTimestamp(date);
    } else {
      timestampElement.textContent = "Agora mesmo";
    }

    // Definir conteúdo do post
    contentElement.textContent = post.content;

    // Definir mídia (se houver)
    if (post.mediaURL) {
      if (post.mediaType === "image") {
        const img = document.createElement("img");
        img.src = post.mediaURL;
        img.alt = "Imagem do post";
        img.className = "post-image";
        mediaElement.appendChild(img);
        mediaElement.style.display = "block";
      } else if (post.mediaType === "video") {
        const video = document.createElement("video");
        video.src = post.mediaURL;
        video.controls = true;
        video.className = "post-video";
        mediaElement.appendChild(video);
        mediaElement.style.display = "block";
      }
    }

    // Definir contagem de likes
    likeCount.textContent = post.likes || 0;

    // Verificar se o usuário atual já curtiu o post
    if (post.likedBy && post.likedBy.includes(currentUser.uid)) {
      likeButton.classList.add("liked");
      likeButton.querySelector("i").className = "fas fa-heart";
    }

    // Definir contagem de comentários
    commentCount.textContent = post.commentCount || 0;

    // Definir foto do usuário atual no campo de comentário
    if (currentUserProfile && currentUserProfile.photoURL) {
      commentUserPhoto.src = currentUserProfile.photoURL;
    }

    // Adicionar event listener para o botão de curtir
    likeButton.addEventListener("click", function () {
      toggleLike(post.id);
    });

    // Adicionar event listener para o botão de comentar
    commentButton.addEventListener("click", function () {
      // Alternar visibilidade da seção de comentários
      commentsSection.classList.toggle("active");

      // Se a seção de comentários estiver visível, carregar comentários
      if (commentsSection.classList.contains("active")) {
        loadComments(post.id);
        commentInput.focus();
      }
    });

    // Adicionar event listener para o campo de comentário
    commentInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        const content = commentInput.value.trim();
        if (content) {
          addComment(post.id, content);
          commentInput.value = "";
        }
      }
    });

    // Adicionar event listener para o botão de enviar comentário
    sendCommentButton.addEventListener("click", function () {
      const content = commentInput.value.trim();
      if (content) {
        addComment(post.id, content);
        commentInput.value = "";
      }
    });

    // Adicionar post ao container
    postsContainer.appendChild(postClone);
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
        alert("Você precisa estar logado para curtir.");
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

  // Função para carregar comentários de um post
  async function loadComments(postId) {
    try {
      const commentsList = document.querySelector(
        `.post[data-post-id="${postId}"] .comments-list`
      );

      if (!commentsList) return;

      // Exibir indicador de carregamento
      commentsList.innerHTML =
        '<div class="loading-comments"><i class="fas fa-spinner fa-spin"></i> Carregando comentários...</div>';

      // Buscar comentários no Firestore
      const commentsSnapshot = await db
        .collection("posts")
        .doc(postId)
        .collection("comments")
        .orderBy("timestamp", "asc")
        .get();

      // Limpar lista de comentários
      commentsList.innerHTML = "";

      // Verificar se há comentários
      if (commentsSnapshot.empty) {
        commentsList.innerHTML =
          '<div class="no-comments">Nenhum comentário ainda. Seja o primeiro a comentar!</div>';
        return;
      }

      // Adicionar cada comentário ao DOM
      commentsSnapshot.forEach((doc) => {
        const comment = {
          id: doc.id,
          ...doc.data(),
        };

        addCommentToDOM(postId, comment, commentsList);
      });
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
      const commentsList = document.querySelector(
        `.post[data-post-id="${postId}"] .comments-list`
      );
      if (commentsList) {
        commentsList.innerHTML =
          '<div class="error-message">Erro ao carregar comentários. Tente novamente mais tarde.</div>';
      }
    }
  }

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
        alert("Você precisa estar logado para comentar.");
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

      // Obter a lista de comentários para adicionar o novo comentário ao DOM
      const commentsList = document.querySelector(
        `.post[data-post-id="${postId}"] .comments-list`
      );

      // Adicionar o comentário ao DOM para exibição imediata
      const newComment = {
        id: commentRef.id,
        ...commentData,
        timestamp: new Date(), // Usar data local para exibição imediata
      };
      addCommentToDOM(postId, newComment, commentsList);

      // Fazer scroll para o novo comentário
      const commentsSection = document.querySelector(
        `.post[data-post-id="${postId}"] .post-comments`
      );
      if (commentsSection) {
        commentsSection.scrollTop = commentsSection.scrollHeight;
      }

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
      alert("Erro ao adicionar comentário. Tente novamente.");
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
        alert("Você precisa estar logado para curtir.");
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
        alert("Você não pode adicionar a si mesmo como amigo.");
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
        alert("Este usuário já é seu amigo.");
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
        alert("Você já enviou uma solicitação de amizade para este usuário.");
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
      alert("Solicitação de amizade enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar solicitação de amizade:", error);
      alert("Erro ao enviar solicitação. Tente novamente.");
    }
  }
});