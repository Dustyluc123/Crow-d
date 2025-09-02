document.addEventListener('DOMContentLoaded', function () {
    const firebaseConfig = {
        apiKey: "AIzaSyAeEyxi-FUvoPtP6aui1j6Z7Wva9lWd7WM",
        authDomain: "tcclogin-7e7b8.firebaseapp.com",
        projectId: "tcclogin-7e7b8",
        appId: "1:1066633833169:web:3fcb8fccac38141b1bb3f0"
    };

    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    const auth = firebase.auth();
    const db = firebase.firestore();

    const eventDetailsContent = document.getElementById('event-details-content');
    let currentUser = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadEventDetails();
        } else {
            window.location.href = '../login/login.html';
        }
    });

    async function loadEventDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('id');

        if (!eventId) {
            eventDetailsContent.innerHTML = "<p>ID do evento não fornecido.</p>";
            return;
        }

        try {
            const docRef = db.collection('events').doc(eventId);
            const doc = await docRef.get();

            if (doc.exists) {
                const event = { id: doc.id, ...doc.data() };
                displayEventDetails(event);
            } else {
                eventDetailsContent.innerHTML = "<p>Evento não encontrado.</p>";
            }
        } catch (error) {
            console.error("Erro ao carregar detalhes do evento:", error);
            eventDetailsContent.innerHTML = "<p>Ocorreu um erro ao carregar o evento.</p>";
        }
    }
    // Em single-event.js

    function displayEventDetails(event) {
        const eventDate = event.eventDateTime.toDate();
        const formattedDate = eventDate.toLocaleDateString('pt-BR', { dateStyle: 'full' });
        const formattedTime = eventDate.toLocaleTimeString('pt-BR', { timeStyle: 'short' });

        eventDetailsContent.innerHTML = `
        <div class="event-details-container">
            <h1>${event.eventName}</h1>
            <div class="event-details" style="margin-bottom: 20px;">
                <p><i class="fas fa-calendar"></i> <strong>Data:</strong> ${formattedDate}</p>
                <p><i class="fas fa-clock"></i> <strong>Horário:</strong> ${formattedTime}</p>
                <p><i class="fas fa-map-marker-alt"></i> <strong>Local:</strong> ${event.eventLocation}</p>
                <p><i class="fas fa-users"></i> <strong>Participantes:</strong> ${event.participants ? event.participants.length : 0}</p>
            </div>
           
            <p class="event-description">${event.description.replace(/\n/g, '<br>')}</p>
            <div class="event-tags" style="margin-top: 20px;">
                ${event.tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `;
    }
});