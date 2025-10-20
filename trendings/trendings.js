// Arquivo: trendings/trendings.js

document.addEventListener('DOMContentLoaded', function() {

    const db = firebase.firestore();
    const TRENDING_LIMIT = 10;
    const MAX_POSTS_TO_ANALYZE = 100; // Analisa os 100 posts mais recentes

    /**
     * Busca o conteúdo de um número limitado de posts recentes do Firestore.
     * (O conteúdo desta função permanece o mesmo da correção anterior, buscando dados reais)
     */
    async function fetchPostsFromFirestore() {
        const postsContent = [];
        try {
            const snapshot = await db.collection('posts')
                                     .orderBy('timestamp', 'desc') 
                                     .limit(MAX_POSTS_TO_ANALYZE) 
                                     .get();

            snapshot.forEach(doc => {
                const postData = doc.data();
                if (postData.content && typeof postData.content === 'string') {
                    postsContent.push(postData.content);
                }
            });

            return postsContent;

        } catch (error) {
            console.error("Erro ao buscar posts do Firestore:", error);
            const trendingListEl = document.getElementById('trending-list');
            if (trendingListEl) {
                trendingListEl.innerHTML = `<li><i class="fas fa-exclamation-triangle"></i> Erro ao carregar posts.</li>`;
            }
            return [];
        }
    }

    /**
     * Lógica Corrigida: Extrai hashtags ÚNICAS de cada post, somando apenas +1 por postagem.
     * @param {Array<string>} posts - Array de strings contendo o texto dos posts.
     * @returns {Array<[string, number]>} Array de pares [hashtag, contagem] ordenado.
     */
    function calculateTrendingTopics(posts) {
        const hashtagCounts = new Map();
        const hashtagRegex = /#(\w+)/g;

        posts.forEach(post => {
            // 1. Encontra TODAS as hashtags e armazena em um Set (garantindo unicidade)
            const matches = post.match(hashtagRegex) || [];
            const uniqueHashtagsInPost = new Set();

            matches.forEach(match => {
                // Remove o '#' e normaliza para minúsculas
                const hashtag = match.substring(1).toLowerCase();
                uniqueHashtagsInPost.add(hashtag);
            });

            // 2. Itera sobre o Set e adiciona +1 na contagem GLOBAL para cada hashtag ÚNICA.
            uniqueHashtagsInPost.forEach(hashtag => {
                // A contagem é feita aqui, garantindo que o post só vote uma vez por hashtag
                hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) || 0) + 1);
            });
        });

        // Converte o Map para Array e ordena por contagem (do maior para o menor)
        const sortedTopics = Array.from(hashtagCounts.entries())
            .sort(([, countA], [, countB]) => countB - countA);

        return sortedTopics;
    }

    /**
     * Busca os dados reais, calcula as Top 10 e insere no DOM.
     */
    async function displayTrendingTopics() {
        const trendingListEl = document.getElementById('trending-list');
        
        // 1. Busca dos dados reais (assíncrono)
        const posts = await fetchPostsFromFirestore();
        
        // 2. Processamento e cálculo das Top 10 (LÓGICA CORRIGIDA AQUI)
        const topTopics = calculateTrendingTopics(posts).slice(0, TRENDING_LIMIT);

        if (!trendingListEl) return;

        trendingListEl.innerHTML = '';

        if (topTopics.length === 0) {
            trendingListEl.innerHTML = '<li>Nenhuma hashtag encontrada nos posts recentes.</li>';
            return;
        }

        // 3. Inserção no HTML
        topTopics.forEach(([hashtag, count]) => {
            const listItem = document.createElement('li');
            
            // Simula a ação de clicar na hashtag
            listItem.onclick = () => {
                window.location.href = `index.html?search=%23${hashtag}`;
            };

            listItem.innerHTML = `
                <div class="hashtag">#${hashtag}</div>
                <div class="count">${count} post(s)</div> `;

            trendingListEl.appendChild(listItem);
        });
    }

    // Inicializa a exibição
    displayTrendingTopics();
});