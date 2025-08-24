document.addEventListener('DOMContentLoaded', function() {
    const firebaseConfig = {
        apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
        authDomain: "tcclogin-7e7b8.firebaseapp.com",
        projectId: "tcclogin-7e7b8",
        storageBucket: "tcclogin-7e7b8.appspot.com",
        messagingSenderId: "1066633833169",
        appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;
    let currentUserProfile = {};
    let groupId = null;
    let membersProfiles = {};
    let groupCreatorId = null;

    const groupNameTitle = document.getElementById('group-name-title');
    const messagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const membersList = document.getElementById('members-list');
    
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.querySelector('emoji-picker');

    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            
            const urlParams = new URLSearchParams(window.location.search);
            groupId = urlParams.get('groupId');
            
            if (groupId) {
                await verifyGroupMembership();
            } else {
                window.location.href = 'grupos.html';
            }
        } else {
            window.location.href = '../login/login.html';
        }
    });
    
    async function loadUserProfile(uid) {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            currentUserProfile = userDoc.data();
        }
    }
    
    async function verifyGroupMembership() {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (groupDoc.exists) {
            const groupData = groupDoc.data();
            groupCreatorId = groupData.createdBy;
            if (groupData.members.includes(currentUser.uid)) {
                groupNameTitle.textContent = groupData.name;
                await fetchMembersProfiles(groupData.members);
                loadMessages();
                loadMembers();
            } else {
                alert("Você não é membro deste grupo.");
                window.location.href = 'grupos.html';
            }
        } else {
            alert("Grupo não encontrado.");
            window.location.href = 'grupos.html';
        }
    }
    
    async function fetchMembersProfiles(memberIds) {
        for (const id of memberIds) {
            if (!membersProfiles[id]) {
                const userDoc = await db.collection('users').doc(id).get();
                if (userDoc.exists) {
                    membersProfiles[id] = userDoc.data();
                }
            }
        }
    }

    function loadMessages() {
        db.collection('groups').doc(groupId).collection('messages').orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                messagesContainer.innerHTML = '';
                snapshot.forEach(doc => {
                    // Passa o ID da mensagem para a função que a cria na tela
                    addMessageToDOM(doc.id, doc.data());
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
    }

    function loadMembers() {
        // ... (nenhuma alteração nesta função)
        db.collection('groups').doc(groupId).onSnapshot(async (doc) => {
            const groupData = doc.data();
            const members = groupData.members;
            await fetchMembersProfiles(members);
            membersList.innerHTML = '';
            for (const memberId of members) {
                const memberProfile = membersProfiles[memberId];
                if (!memberProfile) continue;
                const memberElement = document.createElement('div');
                memberElement.className = 'member-item';
                memberElement.innerHTML = `<img src="${memberProfile.photoURL || '../img/Design sem nome2.png'}" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;"> <p>${memberProfile.nickname}</p>`;
                if (currentUser.uid === groupCreatorId && memberId !== currentUser.uid) {
                    const kickBtn = document.createElement('button');
                    kickBtn.innerHTML = '<i class="fas fa-times"></i>';
                    kickBtn.className = 'kick-btn';
                    kickBtn.onclick = () => kickMember(memberId);
                    memberElement.appendChild(kickBtn);
                }
                membersList.appendChild(memberElement);
            }
        });
    }

    async function kickMember(memberId) {
        // ... (nenhuma alteração nesta função)
        if (!confirm("Tem certeza que deseja remover este membro?")) return;
        try {
            await db.collection('groups').doc(groupId).update({
                members: firebase.firestore.FieldValue.arrayRemove(memberId)
            });
        } catch (error) {
            console.error("Erro ao remover membro:", error);
        }
    }

    // EM CHAT.JS

function addMessageToDOM(messageId, message) {
    const senderProfile = membersProfiles[message.senderId] || { nickname: 'Usuário', photoURL: '../img/Design sem nome2.png' };
    const isSentByMe = message.senderId === currentUser.uid;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message ${isSentByMe ? 'sent' : 'received'}`;
    
    const avatar = document.createElement('img');
    avatar.src = senderProfile.photoURL || '../img/Design sem nome2.png';
    avatar.className = 'message-avatar';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (!isSentByMe) {
        const senderName = document.createElement('div');
        senderName.className = 'message-header';
        senderName.textContent = senderProfile.nickname;
        messageContent.appendChild(senderName);
    }

    const messageText = document.createElement('p');
    messageText.className = 'message-text';
    messageText.textContent = message.text;
    messageContent.appendChild(messageText);
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = message.timestamp ? message.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    messageContent.appendChild(messageTime);
    
    messageWrapper.appendChild(avatar);
    messageWrapper.appendChild(messageContent);
    
    // --- Lógica para o botão de excluir (CORRIGIDA) ---
    if (isSentByMe) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Excluir mensagem';
        deleteBtn.addEventListener('click', () => {
            deleteMessage(messageId);
        });
        // AQUI ESTÁ A MUDANÇA: Adicionamos o botão dentro do balão da mensagem
        messageContent.appendChild(deleteBtn); 
    }
    // --- FIM DA CORREÇÃO ---

    messagesContainer.appendChild(messageWrapper);
}
    
    async function deleteMessage(messageId) {
        const confirmed = await showConfirmationModal("Excluir Mensagem", "Tem a certeza que deseja excluir esta mensagem?");
        if (!confirmed) return;

        try {
            await db.collection('groups').doc(groupId).collection('messages').doc(messageId).delete();
        } catch (error) {
            console.error("Erro ao excluir mensagem:", error);
            showCustomAlert("Não foi possível excluir a mensagem.");
        }
    }
    // --- FIM DA NOVA FUNÇÃO ---
    
    async function sendMessage() {
        // ... (nenhuma alteração nesta função)
        const text = messageInput.value.trim();
        if (text === '') return;

        try {
            messageInput.value = '';
            await db.collection('groups').doc(groupId).collection('messages').add({
                text: text,
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            messageInput.value = text;
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    emojiBtn.addEventListener('click', (event) => {
        // ... (nenhuma alteração nesta função)
        event.stopPropagation();
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });

    emojiPicker.addEventListener('emoji-click', event => {
        // ... (nenhuma alteração nesta função)
        messageInput.value += event.detail.emoji.unicode;
        emojiPicker.style.display = 'none';
    });

    document.addEventListener('click', (event) => {
        // ... (nenhuma alteração nesta função)
        if (!emojiPicker.contains(event.target) && event.target !== emojiBtn) {
            emojiPicker.style.display = 'none';
        }
    });
});