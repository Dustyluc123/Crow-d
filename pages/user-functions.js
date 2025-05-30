// Função para carregar publicações do usuário
async function loadUserPosts() {
    try {
        // Limpar container de posts
        postsContainer.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando publicações...</div>';
        
        // Remover listener anterior se existir
        if (postsListener) {
            postsListener();
        }
        
        // Criar listener para posts em tempo real
        postsListener = db.collection('posts')
            .where('authorId', '==', profileUserId)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                // Limpar container de posts
                postsContainer.innerHTML = '';
                
                // Verificar se há posts
                if (snapshot.empty) {
                    postsContainer.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Este usuário ainda não fez nenhuma publicação.</div>';
                    return;
                }
                
                // Adicionar cada post ao DOM
                snapshot.forEach(doc => {
                    const post = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    addPostToDOM(post);
                });
            }, error => {
                console.error('Erro ao carregar posts:', error);
                postsContainer.innerHTML = '<div class="error-message">Erro ao carregar publicações. Tente novamente mais tarde.</div>';
            });
    } catch (error) {
        console.error('Erro ao iniciar carregamento de posts:', error);
        postsContainer.innerHTML = '<div class="error-message">Erro ao carregar publicações. Tente novamente mais tarde.</div>';
    }
}

// Função para carregar amigos do usuário
async function loadUserFriends() {
    try {
        // Limpar grid de amigos
        friendsGrid.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Carregando amigos...</div>';
        
        // Obter amigos do usuário (pessoas que ele segue)
        const followingSnapshot = await db.collection('users').doc(profileUserId)
            .collection('following')
            .limit(12)
            .get();
        
        // Limpar grid de amigos
        friendsGrid.innerHTML = '';
        
        // Verificar se há amigos
        if (followingSnapshot.empty) {
            friendsGrid.innerHTML = '<div class="no-content"><i class="fas fa-info-circle"></i> Este usuário ainda não segue ninguém.</div>';
            return;
        }
        
        // Adicionar cada amigo ao DOM
        followingSnapshot.forEach(doc => {
            const friendData = doc.data();
            
            // Criar elemento de amigo
            const friendElement = document.createElement('div');
            friendElement.className = 'friend-item';
            
            // Criar foto do amigo
            const friendPhoto = document.createElement('img');
            friendPhoto.className = 'friend-photo';
            friendPhoto.src = friendData.photoURL || '../img/Design sem nome2.png';
            friendPhoto.alt = friendData.nickname || 'Usuário';
            
            // Criar nome do amigo
            const friendName = document.createElement('p');
            friendName.className = 'friend-name';
            friendName.textContent = friendData.nickname || 'Usuário';
            
            // Adicionar evento de clique para redirecionar ao perfil do amigo
            friendElement.addEventListener('click', function() {
                window.location.href = `user.html?uid=${doc.id}`;
            });
            
            // Adicionar elementos ao elemento de amigo
            friendElement.appendChild(friendPhoto);
            friendElement.appendChild(friendName);
            
            // Adicionar amigo ao grid
            friendsGrid.appendChild(friendElement);
        });
    } catch (error) {
        console.error('Erro ao carregar amigos:', error);
        friendsGrid.innerHTML = '<div class="error-message">Erro ao carregar amigos. Tente novamente mais tarde.</div>';
    }
}

// Função para verificar se o usuário atual segue o usuário do perfil
async function checkFollowStatus() {
    try {
        // Verificar se o usuário atual segue o usuário do perfil
        const followDoc = await db.collection('users').doc(currentUser.uid)
            .collection('following').doc(profileUserId).get();
        
        isFollowing = followDoc.exists;
        
        // Atualizar botão de seguir
        updateFollowButton();
    } catch (error) {
        console.error('Erro ao verificar status de seguir:', error);
    }
}

// Função para alternar seguir/deixar de seguir
async function toggleFollow() {
    try {
        // Desabilitar botão durante a operação
        followBtn.disabled = true;
        
        if (isFollowing) {
            // Deixar de seguir
            await db.collection('users').doc(currentUser.uid)
                .collection('following').doc(profileUserId).delete();
            
            await db.collection('users').doc(profileUserId)
                .collection('followers').doc(currentUser.uid).delete();
            
            isFollowing = false;
        } else {
            // Seguir
            await db.collection('users').doc(currentUser.uid)
                .collection('following').doc(profileUserId).set({
                    userId: profileUserId,
                    nickname: profileUser.nickname || 'Usuário',
                    photoURL: profileUser.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            await db.collection('users').doc(profileUserId)
                .collection('followers').doc(currentUser.uid).set({
                    userId: currentUser.uid,
                    nickname: currentUserProfile.nickname || 'Usuário',
                    photoURL: currentUserProfile.photoURL || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            // Criar notificação para o usuário
            try {
                await db.collection('users').doc(profileUserId)
                    .collection('notifications').add({
                        type: 'follow',
                        fromUserId: currentUser.uid,
                        fromUserName: currentUserProfile.nickname || 'Usuário',
                        fromUserPhoto: currentUserProfile.photoURL || null,
                        content: 'começou a seguir você',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
            } catch (notificationError) {
                console.error('Erro ao criar notificação:', notificationError);
                // Continuar mesmo se a notificação falhar
            }
            
            isFollowing = true;
        }
        
        // Atualizar botão de seguir
        updateFollowButton();
        
        // Reativar botão
        followBtn.disabled = false;
    } catch (error) {
        console.error('Erro ao alternar seguir:', error);
        alert('Erro ao atualizar status de seguir. Tente novamente.');
        
        // Reativar botão
        followBtn.disabled = false;
    }
}
