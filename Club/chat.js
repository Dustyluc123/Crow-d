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

    const groupNameTitle = document.getElementById('group-name-title');
    const messagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    auth.onAuthStateChanged(async function(user) {
        if (user) {
            currentUser = user;
            await loadUserProfile(user.uid);
            
            const urlParams = new URLSearchParams(window.location.search);
            groupId = urlParams.get('groupId');
            
            if (groupId) {
                verifyGroupMembership();
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
            if (groupData.members.includes(currentUser.uid)) {
                groupNameTitle.textContent = groupData.name;
                await fetchMembersProfiles(groupData.members);
                loadMessages();
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
                    addMessageToDOM(doc.data());
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
    }

    function addMessageToDOM(message) {
        const senderProfile = membersProfiles[message.senderId] || { nickname: 'Usuário', photoURL: '../img/Design sem nome2.png' };
        const isSentByMe = message.senderId === currentUser.uid;

        const messageWrapper = document.createElement('div');
        messageWrapper.className = `message ${isSentByMe ? 'sent' : 'received'}`;
        
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

        messageWrapper.appendChild(messageContent);
        messagesContainer.appendChild(messageWrapper);
    }
    
    async function sendMessage() {
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
            messageInput.value = text; // Devolve o texto se falhar
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
});