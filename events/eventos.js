document.addEventListener('DOMContentLoaded', function() {
    // ==========================================================
    // CONFIGURAÇÃO DO FIREBASE
    // ==========================================================
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

    // ==========================================================
    // VARIÁVEIS E REFERÊNCIAS DO DOM
    // ==========================================================
    let currentUser = null;
    const eventsContainer = document.querySelector('.events-container');
    const popularEventsContainer = document.getElementById('popular-events-container'); // Nova referência
    const createEventModal = document.getElementById('createEventModal');
    const createEventForm = document.querySelector('#createEventModal .modal-form');
    const createEventBtn = document.getElementById('createEventBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    

    // ==========================================================
    // LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO
    // ==========================================================
    auth.onAuthStateChanged(function(user) {
        if (user) {
            currentUser = user;
            const profileLink = document.querySelector('.main-nav a.profile-link');
            if (profileLink) {
                profileLink.href = `../pages/user.html?uid=${user.uid}`;
            }
            loadEvents();
        } else {
            window.location.href = '../login/login.html';
        }
    });

    // ==========================================================
    // FUNÇÕES DO SISTEMA DE EVENTOS
    // ==========================================================

    /**
     * Carrega todos os eventos, exibe-os na lista principal e
     * os mais populares na barra lateral.
     */
    async function loadEvents() {
        eventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando eventos...</div>';
        popularEventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        
        try {
            const snapshot = await db.collection('events')
                .orderBy('eventDateTime', 'asc')
                .get();

            if (snapshot.empty) {
                eventsContainer.innerHTML = '<p>Nenhum evento futuro encontrado.</p>';
                popularEventsContainer.innerHTML = '<p>Nenhum evento popular.</p>';
                return;
            }

            eventsContainer.innerHTML = '';
            
            const allEvents = [];
            snapshot.forEach(doc => {
                const eventData = { id: doc.id, ...doc.data() };
                allEvents.push(eventData);
                // Adiciona cada evento à lista principal
                addEventToDOM(eventData);
            });

            // --- LÓGICA DOS EVENTOS POPULARES ---
            // 1. Faz uma cópia da lista de eventos
            const sortedByPopularity = [...allEvents];
            
            // 2. Ordena a cópia pelo número de participantes (do maior para o menor)
            sortedByPopularity.sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));

            // 3. Pega os 3 eventos mais populares e exibe-os na barra lateral
            displayPopularEvents(sortedByPopularity.slice(0, 3));

        } catch (error) {
            console.error("Erro ao carregar eventos:", error);
            eventsContainer.innerHTML = '<p>Ocorreu um erro ao carregar os eventos.</p>';
        }
    }
    
    /**
     * NOVA FUNÇÃO: Cria o HTML para a lista de eventos populares.
     * @param {Array} popularEvents - Uma lista com os eventos mais populares.
     */
    function displayPopularEvents(popularEvents) {
        popularEventsContainer.innerHTML = ''; // Limpa o contentor

        if (popularEvents.length === 0) {
            popularEventsContainer.innerHTML = '<p>Nenhum evento popular.</p>';
            return;
        }

        popularEvents.forEach(event => {
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
            popularEventsContainer.appendChild(eventElement);
        });

        const seeMoreLink = document.createElement('a');
        seeMoreLink.href = "#";
        seeMoreLink.className = "see-more";
        seeMoreLink.textContent = "Ver mais";
        popularEventsContainer.appendChild(seeMoreLink);
    }

    /**
     * Cria o HTML de um cartão de evento e adiciona-o à página.
     * @param {object} event - O objeto do evento com os seus dados.
     */
    function addEventToDOM(event) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';

        const eventDate = event.eventDateTime.toDate();
        const formattedDate = eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const isParticipating = event.participants && event.participants.includes(currentUser.uid);

        eventCard.innerHTML = `
            <div class="event-header">
                <h3>${event.eventName}</h3>
                <div class="event-date-display">
                    <i class="fas fa-calendar"></i> ${formattedDate}
                </div>
            </div>
            <div class="event-content">
                <div class="event-details">
                    <p><i class="fas fa-clock"></i> ${formattedTime}</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${event.eventLocation}</p>
                    <p><i class="fas fa-users"></i> ${event.participants ? event.participants.length : 0} participantes</p>
                </div>
                <p class="event-description">${event.description}</p>
                <div class="event-tags">
                    ${event.tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
                </div>
                <div class="event-actions">
                    <button class="event-btn participate-btn ${isParticipating ? 'secondary' : ''}">
                        ${isParticipating ? 'Participando' : 'Participar'}
                    </button>
                </div>
            </div>
        `;
        
        const participateBtn = eventCard.querySelector('.participate-btn');
        participateBtn.addEventListener('click', () => toggleParticipation(event.id, participateBtn));

        eventsContainer.appendChild(eventCard);
    }

    // (O resto do seu ficheiro eventos.js continua aqui: toggleParticipation, createEvent, e os listeners do modal)
    // ...
    // ... (COLE O RESTO DO SEU FICHEIRO JS A PARTIR DAQUI) ...
    // ...

    async function toggleParticipation(eventId, button) {
        const eventRef = db.collection('events').doc(eventId);
        
        try {
            const doc = await eventRef.get();
            if (!doc.exists) return;

            const eventData = doc.data();
            const participants = eventData.participants || [];
            const isParticipating = participants.includes(currentUser.uid);

            if (isParticipating) {
                await eventRef.update({
                    participants: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                });
            } else {
                await eventRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }
            loadEvents(); 
        } catch (error) {
            console.error("Erro ao atualizar participação:", error);
            alert("Ocorreu um erro ao tentar participar do evento.");
        }
    }

    async function createEvent(e) {
        e.preventDefault();
        const eventName = document.getElementById('eventName').value;
        const eventLocation = document.getElementById('eventLocation').value;
        const eventDate = document.getElementById('eventDate').value;
        const eventTime = document.getElementById('eventTime').value;
        const description = document.getElementById('eventDescription').value;
        const tags = document.getElementById('eventTags').value.split(',').map(tag => tag.trim());

        if (!eventName || !eventLocation || !eventDate || !eventTime || !description) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const eventDateTime = new Date(`${eventDate}T${eventTime}`);

        try {
            await db.collection('events').add({
                eventName,
                eventLocation,
                eventDateTime,
                description,
                tags,
                creatorId: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                participants: []
            });

            createEventModal.style.display = 'none';
            createEventForm.reset();
            loadEvents();
        } catch (error) {
            console.error("Erro ao criar evento: ", error);
            alert("Ocorreu um erro ao criar o evento.");
        }
    }

    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => { createEventModal.style.display = 'flex'; });
    }
    if (closeModalBtns) {
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => { createEventModal.style.display = 'none'; });
        });
    }
    if (createEventForm) {
        createEventForm.addEventListener('submit', createEvent);
    }
    window.addEventListener('click', (event) => {
        if (event.target === createEventModal) {
            createEventModal.style.display = 'none';
        }
    });
});