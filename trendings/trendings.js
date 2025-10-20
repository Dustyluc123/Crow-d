// Arquivo: trendings.js

document.addEventListener('DOMContentLoaded', function() {

    // A variável 'db' é inicializada no config/global.js e está disponível globalmente.
    const db = firebase.firestore();
    const TRENDING_LIMIT = 10;
    const MAX_POSTS_TO_ANALYZE = 100; // Analisa os 100 posts mais recentes para tendências

    /**
     * Busca o conteúdo de um número limitado de posts recentes do Firestore.
     * Assumimos:
     * 1. Coleção de posts se chama 'posts'.
     * 2. O campo de texto do post é 'content'.
     * 3. Existe um campo 'timestamp' para ordenação.
     * @returns {Promise<Array<string>>} Promise que resolve para um array de strings (conteúdo dos posts).
     */
    async function fetchPostsFromFirestore() {
        const postsContent = [];
        try {
            // Consulta no Firestore: posts ordenados por timestamp (mais recentes primeiro)
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
                trendingListEl.innerHTML = `<li><i class="fas fa-exclamation-triangle"></i> Erro ao carregar posts: Verifique a conexão com o Firebase e o console.</li>`;
            }
            return [];
        }
    }

    /**
     * Processa o array de posts para extrair, somar e ordenar a frequência das hashtags.
     * @param {Array<string>} posts - Array de strings contendo o texto dos posts.
     * @returns {Array<[string, number]>} Array de pares [hashtag, contagem] ordenado.
     */
    function calculateTrendingTopics(posts) {
        const hashtagCounts = new Map();
        // Regex: Encontra '#' seguido por uma ou mais letras, números ou underscore (\w+).
        const hashtagRegex = /#(\w+)/g;

        posts.forEach(post => {
            let match;
            // Loop para encontrar TODAS as hashtags no post
            while ((match = hashtagRegex.exec(post)) !== null) {
                const hashtag = match[1].toLowerCase(); // Normaliza para minúsculas para somar corretamente
                
                // Distribui e soma a contagem da hashtag
                hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) || 0) + 1);
            }
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
        
        // 2. Processamento e cálculo das Top 10
        const topTopics = calculateTrendingTopics(posts).slice(0, TRENDING_LIMIT);

        if (!trendingListEl) return;

        // Limpa o conteúdo
        trendingListEl.innerHTML = '';

        if (topTopics.length === 0) {
            trendingListEl.innerHTML = '<li>Nenhuma hashtag encontrada nos posts recentes.</li>';
            return;
        }

        // 3. Inserção funcional no HTML
        topTopics.forEach(([hashtag, count]) => {
            const listItem = document.createElement('li');
            
            // Torna o item clicável para simular a busca
            listItem.onclick = () => {
                // Redireciona para o feed principal (index.html) com o parâmetro de busca
                window.location.href = `index.html?search=%23${hashtag}`;
            };

            listItem.innerHTML = `
                <div class="hashtag">#${hashtag}</div>
                <div class="count">${count} uso(s)</div>
            `;

            trendingListEl.appendChild(listItem);
        });
    }

    // Inicializa a exibição
    displayTrendingTopics();
});