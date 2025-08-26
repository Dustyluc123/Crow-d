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
 // --- VARIÁVEIS PARA O SCROLL INFINITO ---
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
// --- FIM DA LÓGICA DE UPLOAD DE IMAGEM PARA POSTS ---
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




// Nova função para desligar o listener do feed de forma segura
function detachPostsListener() {
   if (postsListener) {
       postsListener(); // Executa a função de 'unsubscribe' retornada pelo onSnapshot
       postsListener = null; // Limpa a variável
   }
}


 // --- FUNÇÃO PARA BUSCAR, ROLAR E DESTACAR O POST DA URL ---


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
// Em home/scripts.js


// Em scripts.js


auth.onAuthStateChanged(async function (user) {
 if (user) {
   currentUser = user;
   await loadUserProfile(user.uid);
   

   // ==========================================================
   //      INÍCIO DA LÓGICA ADICIONADA
   // ==========================================================
  
   // Encontra o botão/link de perfil no header pela sua classe
   const profileLink = document.querySelector('.main-nav a.profile-link');
   if (profileLink) {
       // Define o link para a página do usuário logado (user.html) com o UID correto
       profileLink.href = `pages/user.html?uid=${user.uid}`;
   }


   // ==========================================================
   //      FIM DA LÓGICA ADICIONADA
   // ==========================================================


   const urlParams = new URLSearchParams(window.location.search);
   const postIdFromUrl = urlParams.get('post');


   if (postIdFromUrl) {
       showSinglePostView(postIdFromUrl);
   } else {
       loadInitialPosts();
   }


   loadSuggestions();
   loadUpcomingEvents();
   checkUpcomingEventNotifications();
   window.addEventListener('scroll', handleScroll);


 } else {
   window.removeEventListener('scroll', handleScroll);
   window.location.href = "login/login.html";
 }
});
 // Event listener para o botão de logout
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


 // Event listener para o botão de publicar
// Em scripts.js, substitua este event listener

// Event listener para o botão de publicar
if (postButton && postInput) {
  postButton.addEventListener("click", function () {
    const content = postInput.value.trim();
    // ✨ CORREÇÃO APLICADA AQUI ✨
    // Agora a função createPost é chamada mesmo se o texto estiver vazio,
    // pois a própria função irá verificar se há uma imagem.
    createPost(content);
  });

  // Permitir publicar com Enter
  postInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      const content = postInput.value.trim();
      // ✨ CORREÇÃO APLICADA AQUI TAMBÉM ✨
      createPost(content);
    }
  });
}


 // Função para carregar o perfil do usuário
 // Em scripts.js


// SUBSTITUA SUA FUNÇÃO ANTIGA POR ESTA
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
     // O perfil não foi encontrado, mas agora não fazemos mais o redirecionamento.
     // Apenas avisamos no console.
     console.warn(`Aviso: Perfil para o usuário ${userId} não foi encontrado no Firestore.`);
   }
 } catch (error) {
   console.error("Erro ao carregar perfil do usuário:", error);
 }
}

// Em scripts.js

// --- FUNÇÃO PARA CARREGAR OS POSTS INICIAIS (VERSÃO CORRIGIDA) ---
// EM home/scripts.js

function loadInitialPosts() {
  if (postsContainer) {
      postsContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando publicações...</div>';
  }

  const query = db.collection("posts").orderBy("timestamp", "desc").limit(POSTS_PER_PAGE);

  postsListener = query.onSnapshot(async (snapshot) => {
      // Pega a lista de amigos do usuário atual UMA VEZ para otimizar
      const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
      const friendIds = new Set(friendsSnapshot.docs.map(doc => doc.id));

      const loadingIndicator = postsContainer.querySelector('.loading-posts');
      if (loadingIndicator) {
          loadingIndicator.remove();
      }

      // Processa as alterações
      for (const change of snapshot.docChanges()) {
          const postData = { id: change.doc.id, ...change.doc.data() };
          const postElement = document.querySelector(`.post[data-post-id="${postData.id}"]`);

          if (change.type === "added") {
              if (postElement) continue;

              // --- LÓGICA DE FILTRO DE PRIVACIDADE ---
              const authorDoc = await db.collection('users').doc(postData.authorId).get();
              if (authorDoc.exists) {
                  const authorData = authorDoc.data();
                  const authorSettings = authorData.settings || { profilePublic: true };

                  // Mostra o post se:
                  // 1. O perfil do autor é público
                  // 2. O post é do próprio usuário logado
                  // 3. O autor do post está na lista de amigos do usuário logado
                  if (authorSettings.profilePublic || postData.authorId === currentUser.uid || friendIds.has(postData.authorId)) {
                      const newPostElement = addPostToDOM(postData);
                      if (change.newIndex > 0 && postsContainer.children.length > 0) {
                          postsContainer.appendChild(newPostElement);
                      } else {
                          postsContainer.insertBefore(newPostElement, postsContainer.firstChild);
                      }
                  }
              }
              // --- FIM DA LÓGICA DE FILTRO ---
          }

          if (change.type === "removed") {
              if (postElement) {
                  postElement.remove();
              }
          }
      }

      if (!snapshot.empty) {
          lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
      } else {
          noMorePosts = true;
      }

  }, (error) => {
      console.error("Erro ao carregar posts:", error);
      if (postsContainer) {
          postsContainer.innerHTML = '<div class="error-message">Erro ao carregar publicações.</div>';
      }
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
// Em scripts.js, adicione estas duas novas funções

/**
/**
 * Exclui uma publicação do Firestore.
 * @param {string} postId O ID da publicação a ser excluída.
 */
async function deletePost(postId) {
    const confirmed = await showConfirmationModal(
        "Excluir Publicação", 
        "Tem a certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.",
        "Sim, Excluir",
        "Cancelar"
    );

    if (confirmed) {
        try {
            await db.collection('posts').doc(postId).delete();
            showToast("Publicação excluída com sucesso.", "success");
            // O onSnapshot do feed cuidará de remover o post da tela.
        } catch (error) {
            console.error("Erro ao excluir publicação:", error);
            showCustomAlert("Ocorreu um erro ao excluir a publicação.");
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

async function createPost(content) {
  try {
    if (!currentUser || !currentUserProfile) {
          showCustomAlert("Você precisa estar logado para publicar.");
      return;
    }

    // ✨ CORREÇÃO APLICADA AQUI ✨
    // Agora, a publicação é impedida apenas se AMBOS, texto e imagem, estiverem vazios.
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
      imageUrl: postImageBase64
    };

    await db.collection("posts").add(postData);

    postInput.value = "";
    clearPostImage();

    if (postButton) {
      postButton.disabled = false;
      postButton.textContent = "Publicar";
    }
  } catch (error) {
    console.error("Erro ao criar post:", error);
        showCustomAlert("Erro ao criar publicação. Tente novamente.");
    if (postButton) {
      postButton.disabled = false;
      postButton.textContent = "Publicar";
    }
  }
}

// Garanta que o listener do botão de voltar seja adicionado aqui.
backToFeedBtn.addEventListener('click', hideSinglePostView);


// Em home/scripts.js


async function showSinglePostView(postId) {
   detachPostsListener();
   feedView.style.display = 'none';
   singlePostView.style.display = 'block';
   window.scrollTo(0, 0);


   // 2. Atualiza a URL do navegador
   const url = new URL(window.location);
   url.searchParams.set('post', postId);
   history.pushState({}, '', url);


   // 3. Mostra o indicador de carregamento
   focusedPostContainer.innerHTML = '<div class="loading-posts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
  
   // 4. Busca o post específico no Firestore
   const postRef = db.collection("posts").doc(postId);
   const doc = await postRef.get();


   if (doc.exists) {
       // 5. Se o post existe, limpa o "carregando" e desenha o post na tela
       const postData = { id: doc.id, ...doc.data() };
       focusedPostContainer.innerHTML = '';
      
       // 6. Reutiliza a função addPostToDOM para criar o elemento HTML
       const postElement = addPostToDOM(postData, true); // O 'true' avisa para não adicionar o evento de clique de novo


    // 7. Encontra a seção de comentários dentro do post que acabamos de criar
       const commentsSection = postElement.querySelector('.post-comments');
       if (commentsSection) {
           // Adiciona a classe 'active' para torná-la visível
           commentsSection.classList.add('active');
          
           // Encontra a <div> específica da lista de comentários
           const commentsList = commentsSection.querySelector('.comments-list');
           if (commentsList) {
               // Chama a função com os dois argumentos necessários
               loadComments(postId, commentsList);
           }
       }
    
       // 8. Adiciona o post (já com a área de comentários ativa) à página
       focusedPostContainer.appendChild(postElement);


   } else {
       // Se o post não for encontrado
       focusedPostContainer.innerHTML = '<div class="error-message">Esta publicação não foi encontrada ou foi removida.</div>';
   }
}
// Função que fica "escutando" por notificações não lidas em tempo real

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


// Em scripts.js, substitua sua função por esta versão completa

// Em scripts.js, substitua sua função por esta versão completa

function addPostToDOM(post, isSingleView = false) {
    if (!postsContainer || !postTemplate) return;

    const postClone = document.importNode(postTemplate.content, true);
    const postElement = postClone.querySelector(".post");

    // Lógica de clique para abrir a visualização de post único
    if (!isSingleView && !post.isRepost) {
        postElement.style.cursor = 'pointer';
        postElement.addEventListener('click', (e) => {
            if (e.target.closest('button, a, .post-actions, .post-comments, .post-image')) {
                return;
            }
            showSinglePostView(post.id);
        });
    }

    // Seleciona os botões de ação ANTES da lógica de repost
    const likeButton = postClone.querySelector(".like-btn");
    const commentButton = postClone.querySelector(".comment-btn");
    const repostButton = postClone.querySelector(".repost-btn");
    const saveButton = postClone.querySelector(".save-btn");
    const shareButton = postClone.querySelector(".share-btn");

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
            window.location.href = `index?post=${post.originalPostId}`;
        });
        postElement.insertBefore(originalPostContainer, postElement.querySelector('.post-actions'));

        // ✨ NOVA LÓGICA PARA O BOTÃO DE REPOST EM ITENS REPUBLICADOS ✨
        // Esconde os botões de interação, mas mantém o de republicar e compartilhar
        likeButton.style.display = 'none';
        commentButton.style.display = 'none';
        saveButton.style.display = 'none';

        repostButton.classList.add('reposted');
        repostButton.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
        // Adiciona o listener para DESFAZER a republicação, usando o ID do post original
        repostButton.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleRepost(post.originalPostId); 
        });

        // Modifica os dados do post para mostrar o conteúdo e a imagem original
        post.content = post.originalPost.content;
        post.imageUrl = post.originalPost.imageUrl;
        post.authorName = post.originalPost.authorName;
        post.authorPhoto = post.originalPost.authorPhoto;
        post.timestamp = post.originalPost.timestamp;
        post.authorId = post.originalPost.authorId;

    } else {
        // Lógica para posts originais
        if (post.repostedBy && post.repostedBy.includes(currentUser.uid)) {
            repostButton.classList.add("reposted");
            repostButton.innerHTML = `<i class="fas fa-retweet"></i> Republicado`;
        }
        repostButton.addEventListener("click", (e) => toggleRepost(post.id, e.currentTarget));
    }

    // Referências aos elementos do DOM dentro do post
    const authorPhotoElement = postClone.querySelector(".post-author-photo");
    const authorNameElement = postClone.querySelector(".post-author-name");
    const timestampElement = postClone.querySelector(".post-timestamp");
    const contentElement = postClone.querySelector(".post-text");
    const likeCount = postClone.querySelector(".like-count");
    const commentCount = postClone.querySelector(".comment-count");
    const commentsSection = postClone.querySelector(".post-comments");
    const commentInput = postClone.querySelector(".comment-text");
    const sendCommentButton = postClone.querySelector(".send-comment-btn");
    const commentUserPhoto = postClone.querySelector(".comment-user-photo");
    const postMediaContainer = postClone.querySelector(".post-media");
    const postImageElement = postClone.querySelector(".post-image");
    const deletePostBtn = postClone.querySelector('.post-delete-btn');

    // Preenche os dados do post
    postElement.dataset.postId = post.id;
    postElement.dataset.authorId = post.authorId;
    postElement.dataset.originalPostId = post.originalPostId;

    if (post.savedBy && post.savedBy.includes(currentUser.uid)) {
        saveButton.classList.add("saved");
        saveButton.innerHTML = `<i class="fas fa-bookmark"></i> Salvo`;
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

    if (post.imageUrl) {
        postImageElement.src = post.imageUrl;
        postMediaContainer.style.display = 'block';
    } else {
        postMediaContainer.style.display = 'none';
    }

    // Mostra o botão de excluir apenas para o autor do post (não em republicações)
    if (!post.isRepost && post.authorId === currentUser.uid) {
        deletePostBtn.style.display = 'block';
        deletePostBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePost(post.id);
        });
    }

    // Adiciona os event listeners para os botões e interações
    likeButton.addEventListener("click", () => toggleLike(post.id));
    saveButton.addEventListener("click", (e) => toggleSavePost(post.id, e.currentTarget));
    shareButton.addEventListener("click", () => sharePost(post.id));

    commentButton.addEventListener("click", () => {
        commentsSection.classList.toggle("active");
        if (commentsSection.classList.contains("active")) {
            const commentsList = commentsSection.querySelector('.comments-list');
            if (commentsList) {
                if (activeCommentListeners[post.id]) {
                    activeCommentListeners[post.id]();
                }
                activeCommentListeners[post.id] = loadComments(post.id, commentsList);
            }
            commentInput.focus();
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
   window.location.href = `pages/user.html?uid=${userId}`;
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
 // Em scripts.js


// ALTERAÇÃO 1: A função agora recebe o elemento da lista de comentários diretamente
// Em home/scripts.js


// SUBSTITUA SUA FUNÇÃO ANTIGA POR ESTA VERSÃO CORRIGIDA
function loadComments(postId, commentsListElement) {
 if (!commentsListElement) {
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
   .orderBy("timestamp", "desc") 
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
   });
}

// Em scripts.js, substitua sua função por esta versão completa

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

    // ✨ NOVO: Mostra o botão de excluir apenas para o autor do comentário
    if (comment.authorId === currentUser.uid) {
        deleteCommentBtn.style.display = 'block';
        deleteCommentBtn.addEventListener('click', () => {
            deleteComment(postId, comment.id);
        });
    }

    // Adiciona o comentário no topo da lista
    commentsList.insertBefore(commentClone, commentsList.firstChild);
} 


// Em scripts.js
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

    // Incrementar contagem de comentários no post (no banco de dados)
    await db
      .collection("posts")
      .doc(postId)
      .update({
        commentCount: firebase.firestore.FieldValue.increment(1),
      });
    
    // ✨ CORREÇÃO APLICADA AQUI ✨
    // Atualiza a contagem de comentários na tela imediatamente.
    const commentCountElement = document.querySelector(`.post[data-post-id="${postId}"] .comment-count`);
    if (commentCountElement) {
        const currentCount = parseInt(commentCountElement.textContent) || 0;
        commentCountElement.textContent = currentCount + 1;
    }
    // Fim da correção

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

async function loadSuggestions() {
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando sugestões...</div>';

    try {
        // 1. Obter todos os IDs que devem ser excluídos das sugestões
        const exclusionIds = new Set();
        exclusionIds.add(currentUser.uid); // Excluir a si mesmo

        // 2. Obter amigos atuais e adicioná-los à lista de exclusão
        const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
        friendsSnapshot.forEach(doc => exclusionIds.add(doc.id));

        // 3. Obter pedidos de amizade ENVIADOS pelo usuário e adicionar à exclusão
        const sentRequestsSnapshot = await db.collection('friendRequests').where('from', '==', currentUser.uid).get();
        sentRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().to));

        // 4. Obter pedidos de amizade RECEBIDOS pelo usuário e adicionar à exclusão
        const receivedRequestsSnapshot = await db.collection('friendRequests').where('to', '==', currentUser.uid).get();
        receivedRequestsSnapshot.forEach(doc => exclusionIds.add(doc.data().from));

        // 5. Buscar todos os usuários (aqui limitamos para performance, pode ajustar)
        const allUsersSnapshot = await db.collection('users').limit(20).get();

        suggestionsContainer.innerHTML = '';
        let suggestionsAdded = 0;

        allUsersSnapshot.forEach(doc => {
            // Se o ID do usuário NÃO ESTIVER na lista de exclusão, mostra como sugestão
            if (!exclusionIds.has(doc.id)) {
                const user = { id: doc.id, ...doc.data() };
                addSuggestionToDOM(user, 0); // Contagem de hobbies em comum simplificada por agora
                suggestionsAdded++;
            }
        });

        if (suggestionsAdded === 0) {
            suggestionsContainer.innerHTML = '<p class="no-suggestions">Nenhuma nova sugestão encontrada.</p>';
        }

    } catch (error) {
        console.error('Erro ao carregar sugestões:', error);
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '<div class="error-message">Erro ao carregar sugestões.</div>';
        }
    }
}
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
async function toggleRepost(postId, buttonElement) {
   try {
       // 1. VERIFICAÇÕES INICIAIS
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
           // O listener do feed (onSnapshot) já deve remover o post automaticamente.
           // Esta linha é um fallback caso o listener falhe ou para feedback imediato.
           const repostElementToRemove = document.querySelector(
               `.post[data-original-post-id="${postId}"][data-author-id="${currentUser.uid}"]`
           );
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
                   // ✨ CORREÇÃO APLICADA AQUI ✨
                   imageUrl: originalPostData.imageUrl || null, // Garante que a imagem seja incluída
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
   }
}
/**
* Carrega os 3 eventos mais próximos e exibe-os na página principal.
*/
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
/**
* Verifica os eventos em que o utilizador está inscrito e cria uma notificação
* se o evento estiver a menos de 24 horas de distância e se ainda não foi notificado.
*/
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
});

