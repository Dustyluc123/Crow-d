// Sistema de postagens e comentários para o Crow-d
document.addEventListener('DOMContentLoaded', function() {
    // Referências aos elementos do DOM
    const postInput = document.querySelector('.post-input input');
    const postButton = document.querySelector('.post-btn');
    const postsContainer = document.querySelector('.posts');
    
    // Carregar posts do localStorage
    loadPosts();
    //teste testado
    
    // Event listener para o botão de publicar
    postButton.addEventListener('click', function() {
        createPost();
    });
    
    // Event listener para o input de postagem (Enter)
    postInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            createPost();
        }
    });
    
    // Event delegation para ações nos posts (curtir, comentar, etc.)
    postsContainer.addEventListener('click', function(e) {
        // Verificar se é um botão de comentar
        if (e.target.classList.contains('post-action') && e.target.innerHTML.includes('Comentar') || 
            e.target.parentElement.classList.contains('post-action') && e.target.parentElement.innerHTML.includes('Comentar')) {
            
            const postElement = e.target.closest('.post');
            const postId = postElement.dataset.postId;
            
            // Verificar se já existe um input de comentário
            const existingCommentInput = postElement.querySelector('.comment-input');
            
            if (existingCommentInput) {
                // Se já existe, apenas focar nele
                existingCommentInput.querySelector('input').focus();
            } else {
                // Se não existe, criar o input de comentário
                const commentInputHTML = `
                    <div class="comment-input">
                        <img src="../img/Design sem nome2.png" alt="Foto de perfil" class="profile-pic small">
                        <input type="text" placeholder="Escreva um comentário...">
                        <button>Enviar</button>
                    </div>
                `;
                
                // Adicionar o input após os comentários existentes ou criar a seção de comentários
                let commentsSection = postElement.querySelector('.post-comments');
                
                if (!commentsSection) {
                    commentsSection = document.createElement('div');
                    commentsSection.className = 'post-comments';
                    postElement.appendChild(commentsSection);
                }
                
                commentsSection.insertAdjacentHTML('beforeend', commentInputHTML);
                
                // Focar no input
                const newCommentInput = commentsSection.querySelector('.comment-input input');
                newCommentInput.focus();
                
                // Adicionar event listener para o botão de enviar comentário
                const commentButton = commentsSection.querySelector('.comment-input button');
                commentButton.addEventListener('click', function() {
                    addComment(postId, newCommentInput.value);
                });
                
                // Adicionar event listener para o input de comentário (Enter)
                newCommentInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        addComment(postId, newCommentInput.value);
                    }
                });
            }
        }
        
        // Verificar se é um botão de curtir
        if (e.target.classList.contains('post-action') && e.target.innerHTML.includes('Curtir') || 
            e.target.parentElement.classList.contains('post-action') && e.target.parentElement.innerHTML.includes('Curtir')) {
            
            const postElement = e.target.closest('.post');
            const postId = postElement.dataset.postId;
            const likeButton = postElement.querySelector('.post-action:first-child');
            
            // Alternar estado de curtida
            toggleLike(postId, likeButton);
        }
    });
    
    // Função para criar um novo post
    function createPost() {
        const content = postInput.value.trim();
        
        if (content) {
            // Criar objeto de post
            const post = {
                id: Date.now().toString(), // ID único baseado no timestamp
                author: 'Ana Silva', // Nome do usuário atual (simulado)
                authorPic: '../img/Design sem nome2.png', // Foto do usuário atual (simulada)
                content: content,
                timestamp: new Date().toISOString(),
                likes: 0,
                liked: false,
                comments: []
            };
            
            // Adicionar post ao localStorage
            const posts = getPosts();
            posts.unshift(post); // Adicionar no início do array
            localStorage.setItem('posts', JSON.stringify(posts));
            
            // Adicionar post ao DOM
            addPostToDOM(post);
            
            // Limpar input
            postInput.value = '';
        }
    }
    
    // Função para adicionar um comentário a um post
    function addComment(postId, content) {
        if (!content.trim()) return;
        
        // Criar objeto de comentário
        const comment = {
            id: Date.now().toString(),
            author: 'Ana Silva', // Nome do usuário atual (simulado)
            authorPic: '../img/Design sem nome2.png', // Foto do usuário atual (simulada)
            content: content.trim(),
            timestamp: new Date().toISOString()
        };
        
        // Adicionar comentário ao post no localStorage
        const posts = getPosts();
        const postIndex = posts.findIndex(p => p.id === postId);
        
        if (postIndex !== -1) {
            posts[postIndex].comments.push(comment);
            localStorage.setItem('posts', JSON.stringify(posts));
            
            // Adicionar comentário ao DOM
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            const commentsSection = postElement.querySelector('.post-comments');
            
            // Remover o input de comentário
            const commentInput = commentsSection.querySelector('.comment-input');
            if (commentInput) {
                commentInput.remove();
            }
            
            // Adicionar o novo comentário
            const commentHTML = createCommentHTML(comment);
            commentsSection.insertAdjacentHTML('beforeend', commentHTML);
        }
    }
    
    // Função para alternar o estado de curtida de um post
    function toggleLike(postId, likeButton) {
        const posts = getPosts();
        const postIndex = posts.findIndex(p => p.id === postId);
        
        if (postIndex !== -1) {
            const post = posts[postIndex];
            post.liked = !post.liked;
            post.likes = post.liked ? post.likes + 1 : post.likes - 1;
            
            localStorage.setItem('posts', JSON.stringify(posts));
            
            // Atualizar visual do botão
            if (post.liked) {
                likeButton.classList.add('liked');
                likeButton.style.color = '#5b5ad3';
            } else {
                likeButton.classList.remove('liked');
                likeButton.style.color = '';
            }
            
            // Atualizar contador de curtidas, se existir
            const likeCount = likeButton.querySelector('.like-count');
            if (likeCount) {
                likeCount.textContent = post.likes > 0 ? post.likes : '';
            } else if (post.likes > 0) {
                // Criar contador se não existir e houver curtidas
                const countSpan = document.createElement('span');
                countSpan.className = 'like-count';
                countSpan.textContent = post.likes;
                likeButton.appendChild(countSpan);
            }
        }
    }
    
    // Função para carregar posts do localStorage
    function loadPosts() {
        const posts = getPosts();
        
        // Limpar container de posts (remover posts estáticos)
        postsContainer.innerHTML = '';
        
        // Adicionar posts ao DOM
        posts.forEach(post => {
            addPostToDOM(post);
        });
    }
    
    // Função para adicionar um post ao DOM
    function addPostToDOM(post) {
        // Formatar data relativa
        const relativeTime = getRelativeTime(new Date(post.timestamp));
        
        // Criar HTML para o post
        let postHTML = `
            <div class="post" data-post-id="${post.id}">
                <div class="post-header">
                    <img src="${post.authorPic}" alt="Foto de perfil" class="profile-pic">
                    <div class="post-info">
                        <h4>${post.author}</h4>
                        <span class="post-time">${relativeTime} • <i class="fas fa-globe"></i></span>
                    </div>
                </div>
                <div class="post-content">
                    <p>${formatPostContent(post.content)}</p>
                </div>
                <div class="post-actions">
                    <button class="post-action ${post.liked ? 'liked' : ''}" ${post.liked ? 'style="color: #5b5ad3;"' : ''}>
                        <i class="fas fa-thumbs-up"></i> Curtir
                        ${post.likes > 0 ? `<span class="like-count">${post.likes}</span>` : ''}
                    </button>
                    <button class="post-action"><i class="fas fa-comment"></i> Comentar</button>
                    <button class="post-action"><i class="fas fa-share"></i> Compartilhar</button>
                </div>
        `;
        
        // Adicionar seção de comentários se houver comentários
        if (post.comments && post.comments.length > 0) {
            postHTML += '<div class="post-comments">';
            
            // Adicionar cada comentário
            post.comments.forEach(comment => {
                postHTML += createCommentHTML(comment);
            });
            
            postHTML += '</div>';
        }
        
        // Fechar a div do post
        postHTML += '</div>';
        
        // Adicionar ao container de posts (no início)
        postsContainer.insertAdjacentHTML('afterbegin', postHTML);
    }
    
    // Função para criar HTML de um comentário
    function createCommentHTML(comment) {
        return `
            <div class="comment" data-comment-id="${comment.id}">
                <img src="${comment.authorPic}" alt="Foto de perfil" class="profile-pic small">
                <div class="comment-content">
                    <h5>${comment.author}</h5>
                    <p>${comment.content}</p>
                </div>
            </div>
        `;
    }
    
    // Função para formatar o conteúdo do post (detectar links, hashtags, etc.)
    function formatPostContent(content) {
        // Substituir URLs por links clicáveis
        content = content.replace(
            /(https?:\/\/[^\s]+)/g, 
            '<a href="$1" target="_blank">$1</a>'
        );
        
        // Substituir hashtags por links
        content = content.replace(
            /#(\w+)/g, 
            '<a href="#" class="hashtag">#$1</a>'
        );
        
        // Substituir quebras de linha por <br>
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }
    
    // Função para obter posts do localStorage
    function getPosts() {
        const postsJSON = localStorage.getItem('posts');
        return postsJSON ? JSON.parse(postsJSON) : [];
    }
    
    // Função para formatar tempo relativo
    function getRelativeTime(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return 'Agora mesmo';
        }
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `Há ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `Há ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
        }
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 30) {
            return `Há ${diffInDays} ${diffInDays === 1 ? 'dia' : 'dias'}`;
        }
        
        const diffInMonths = Math.floor(diffInDays / 30);
        if (diffInMonths < 12) {
            return `Há ${diffInMonths} ${diffInMonths === 1 ? 'mês' : 'meses'}`;
        }
        
        const diffInYears = Math.floor(diffInMonths / 12);
        return `Há ${diffInYears} ${diffInYears === 1 ? 'ano' : 'anos'}`;
    }
    
    // Inicializar com alguns posts de exemplo se não houver posts
    function initializeExamplePosts() {
        const posts = getPosts();
        
        if (posts.length === 0) {
            // Criar alguns posts de exemplo
            const examplePosts = [
                {
                    id: '1',
                    author: 'Ana Silva',
                    authorPic: '../img/Design sem nome2.png',
                    content: 'Pessoal, alguém quer formar um grupo de estudos para o vestibular? Estou pensando em nos reunirmos na biblioteca depois das aulas!',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
                    likes: 5,
                    liked: false,
                    comments: [
                        {
                            id: '101',
                            author: 'Carlos Mendes',
                            authorPic: '../img/Design sem nome2.png',
                            content: 'Eu topo! Preciso muito estudar matemática.',
                            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hora atrás
                        }
                    ]
                },
                {
                    id: '2',
                    author: 'Pedro Almeida',
                    authorPic: '../img/Design sem nome2.png',
                    content: 'Galera, vamos ter treino de basquete hoje depois da aula! Quem quiser participar é só aparecer na quadra às 15h.',
                    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 horas atrás
                    likes: 8,
                    liked: false,
                    comments: []
                }
            ];
            
            localStorage.setItem('posts', JSON.stringify(examplePosts));
            return examplePosts;
        }
        
        return posts;
    }
    
    // Inicializar posts de exemplo
    initializeExamplePosts();
});
