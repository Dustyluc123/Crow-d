// Ficheiro: Crow-d/config/global.js

document.addEventListener('DOMContentLoaded', function() {
    // A configuração do Firebase precisa estar aqui para ser acessível globalmente
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

    // Função que fica "escutando" por notificações não lidas em tempo real
    function setupNotificationListener(userId) {
        const notificationsRef = db.collection('users').doc(userId).collection('notifications');
        
        notificationsRef.where('read', '==', false).onSnapshot(snapshot => {
            const unreadCount = snapshot.size;
            // Seleciona a bolinha no HEADER principal
            const badge = document.getElementById('header-notification-badge');

            if (badge) {
                // Se houver notificações não lidas, mostra a bolinha. Senão, esconde.
                badge.style.display = unreadCount > 0 ? 'block' : 'none';
            }
        });
    }

    // Verifica o estado do login e inicia o listener de notificações
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // Inicia o listener assim que o usuário for confirmado
            setupNotificationListener(user.uid);
        }
    });
});