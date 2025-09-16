document.addEventListener('DOMContentLoaded', function () {
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
    const popularEventsContainer = document.getElementById('popular-events-container');
    const myEventsContainer = document.getElementById('my-events-list'); // Nova referência
    const createEventModal = document.getElementById('createEventModal');
    const createEventForm = document.querySelector('#createEventModal .modal-form');
    const createEventBtn = document.getElementById('createEventBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    // --- LÓGICA DOS CONTADORES DE CARACTERES ---
    const eventNameInput = document.getElementById('eventName');
    const eventNameCounter = document.getElementById('eventName-char-counter');
    const eventLocationInput = document.getElementById('eventLocation');
    const eventLocationCounter = document.getElementById('eventLocation-char-counter');

    if (eventNameInput && eventNameCounter) {
        eventNameInput.addEventListener('input', () => {
            const currentLength = eventNameInput.value.length;
            eventNameCounter.textContent = `${currentLength}/20`;
        });
    }

    if (eventLocationInput && eventLocationCounter) {
        eventLocationInput.addEventListener('input', () => {
            const currentLength = eventLocationInput.value.length;
            eventLocationCounter.textContent = `${currentLength}/40`;
        });
    }

    // ==========================================================
    // LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO
    // ==========================================================
    auth.onAuthStateChanged(function (user) {
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
     * Carrega todos os eventos, os populares e os do usuário.
     */
    async function loadEvents() {
        // Exibe indicadores de carregamento
        eventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando eventos...</div>';
        if (popularEventsContainer) {
            popularEventsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        }
        if (myEventsContainer) {
            myEventsContainer.innerHTML = '<li><i class="fas fa-spinner fa-spin"></i></li>';
        }
    
        try {
            // --- INÍCIO DA LÓGICA DE FILTRAGEM ---
    
            // 1. Pega a lista de IDs de amigos do usuário atual.
            const friendsSnapshot = await db.collection('users').doc(currentUser.uid).collection('friends').get();
            const friendIds = friendsSnapshot.docs.map(doc => doc.id);
            
            // 2. Adiciona o próprio ID do usuário à lista.
            // Isso garante que o usuário sempre veja seus próprios eventos, mesmo os privados.
            friendIds.push(currentUser.uid);
    
            // 3. Busca todos os eventos no banco de dados, ordenados por data.
            const snapshot = await db.collection('events')
                .orderBy('eventDateTime', 'asc')
                .get();
    
            const allEventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
            // 4. Filtra a lista de todos os eventos para encontrar apenas os que o usuário pode ver.
            const visibleEvents = allEventsData.filter(event => {
                // A condição para um evento ser visível é:
                // - O evento NÃO é "só para amigos" (é público), OU
                // - O evento É "só para amigos" E o ID do criador está na lista de amigos do usuário.
                return !event.isFriendsOnly || (event.isFriendsOnly && friendIds.includes(event.creatorId));
            });
    
            // --- FIM DA LÓGICA DE FILTRAGEM ---
    
            // 5. Limpa a área de exibição e mostra os eventos filtrados.
            eventsContainer.innerHTML = '';
            if (visibleEvents.length === 0) {
                eventsContainer.innerHTML = '<p>Nenhum evento futuro encontrado.</p>';
            } else {
                visibleEvents.forEach(event => {
                    addEventToDOM(event);
                });
            }
    
            // 6. Atualiza as seções "Populares" e "Meus Eventos" com base nos eventos visíveis.
            const sortedByPopularity = [...visibleEvents].sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0));
            if (popularEventsContainer) {
                 displayPopularEvents(sortedByPopularity.slice(0, 3));
            }
    
            const myEvents = visibleEvents.filter(event => event.participants && event.participants.includes(currentUser.uid));
            if (myEventsContainer) {
                displayMyEvents(myEvents);
            }
    
        } catch (error) {
            console.error("Erro detalhado ao carregar eventos:", error);
            eventsContainer.innerHTML = '<p>Ocorreu um erro ao carregar os eventos. Tente novamente mais tarde.</p>';
        }
    }
    /**
        * Exibe os eventos do usuário na barra lateral.
        * @param {Array} myEvents - Uma lista com os eventos que o usuário participa.
        */
    function displayMyEvents(myEvents) {
        if (!myEventsContainer) return;
        myEventsContainer.innerHTML = '';

        if (myEvents.length === 0) {
            myEventsContainer.innerHTML = '<li><p>Você não participa de nenhum evento.</p></li>';
            return;
        }

        myEvents.forEach(event => {
            const eventElement = document.createElement('li');
            // --- CORREÇÃO AQUI: O link agora aponta para single-event.html ---
            eventElement.innerHTML = `<a href="single-event.html?id=${event.id}"><i class="fas fa-calendar-check"></i> ${event.eventName}</a>`;
            myEventsContainer.appendChild(eventElement);
        });
    }
    /**
     * Cria o HTML para a lista de eventos populares.
     * @param {Array} popularEvents - Uma lista com os eventos mais populares.
     */
    /**

     */
    // Encontre e substitua esta função no seu código (provavelmente em eventos.js ou global.js)

async function checkUpcomingEventNotifications() {
    if (!currentUser || !currentUser.uid) return;

    try {
        const now = new Date();
        // Define o limite de tempo para "próximo": 48 horas para cobrir hoje e amanhã com segurança
        const upcomingLimit = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        // 1. Encontra todos os eventos futuros em que o utilizador participa
        const eventsSnapshot = await db.collection('events')
            .where('participants', 'array-contains', currentUser.uid)
            .where('eventDateTime', '>=', now) // Apenas eventos que ainda não aconteceram
            .where('eventDateTime', '<=', upcomingLimit) // Apenas eventos nas próximas 48h
            .get();

        if (eventsSnapshot.empty) {
            return;
        }

        // 2. Para cada evento próximo, verifica se já existe uma notificação
        eventsSnapshot.forEach(async (doc) => {
            const event = { id: doc.id, ...doc.data() };
            const eventId = event.id;

            const notificationQuery = await db.collection('users').doc(currentUser.uid).collection('notifications')
                .where('type', '==', 'event_reminder')
                .where('eventId', '==', eventId)
                .limit(1)
                .get();

            // 3. Se não existir notificação, cria uma nova com o texto corrigido
            if (notificationQuery.empty) {
                const eventDate = event.eventDateTime.toDate();
                const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // --- INÍCIO DA LÓGICA CORRIGIDA ---
                let dayQualifier = ''; // Variável para "hoje" ou "amanhã"
                const today = new Date();

                // Compara se o dia, mês e ano do evento são os mesmos de hoje
                if (eventDate.getDate() === today.getDate() &&
                    eventDate.getMonth() === today.getMonth() &&
                    eventDate.getFullYear() === today.getFullYear()) {
                    dayQualifier = 'hoje';
                } else {
                    // Se não for hoje, assume-se que é amanhã (pois a query limita a 48h)
                    dayQualifier = 'amanhã';
                }

                const notificationContent = `Lembrete: O evento "${event.eventName}" começa ${dayQualifier} às ${formattedTime}!`;
                // --- FIM DA LÓGICA CORRIGIDA ---

                await db.collection('users').doc(currentUser.uid).collection('notifications').add({
                    type: 'event_reminder',
                    eventId: eventId,
                    fromUserName: 'Sistema de Eventos',
                    content: notificationContent, // Usa o novo conteúdo dinâmico
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
            }
        });
    } catch (error) {
        console.error("Erro ao verificar notificações de eventos:", error);
    }
}
    function displayPopularEvents(popularEvents) {
        popularEventsContainer.innerHTML = '';

        if (popularEvents.length === 0) {
            popularEventsContainer.innerHTML = '<p>Nenhum evento popular.</p>';
            return;
        }

        popularEvents.forEach(event => {
            const eventDate = event.eventDateTime.toDate();
            const day = eventDate.getDate();
            const month = eventDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');

            // **INÍCIO DA ALTERAÇÃO**
            // Cria um link <a> que envolve todo o item do evento
            const eventLink = document.createElement('a');
            eventLink.href = `single-event.html?id=${event.id}`;
            eventLink.style.textDecoration = 'none';
            eventLink.style.color = 'inherit';

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

            // Adiciona o elemento do evento dentro do link
            eventLink.appendChild(eventElement);
            // Adiciona o link ao contêiner
            popularEventsContainer.appendChild(eventLink);
            // **FIM DA ALTERAÇÃO**
        });

        const seeMoreLink = document.createElement('a');
        seeMoreLink.href = "#";
        seeMoreLink.className = "see-more";

        popularEventsContainer.appendChild(seeMoreLink);
    }
    /**
     * Cria o HTML de um cartão de evento e adiciona-o à página.
     * @param {object} event - O objeto do evento com os seus dados.
     */
    // Em eventos.js
    function addEventToDOM(event) {
        const eventCardWrapper = document.createElement('a');
        eventCardWrapper.className = 'event-card-link';
        eventCardWrapper.href = `single-event.html?id=${event.id}`;
    
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
    
        const eventDate = event.eventDateTime.toDate();
        const formattedDate = eventDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit' });
        const formattedTime = eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
        const isParticipating = event.participants && event.participants.includes(currentUser.uid);
        const isCreator = event.creatorId === currentUser.uid;
    
        // Adiciona um ícone se o evento for apenas para amigos
        const friendsOnlyIcon = event.isFriendsOnly ?
            '<i class="fas fa-user-friends" title="Apenas para amigos" style="margin-left: 8px; color: var(--text-secondary); opacity: 0.8;"></i>' : '';
    
        const deleteButtonHTML = isCreator ?
            `<button class="event-btn delete-btn" style="background-color: #dc3545;"><i class="fas fa-trash"></i> Excluir</button>` : '';
    
        const description = event.description;
        const DESCRIPTION_LIMIT = 100;
        let descriptionHTML = `<p class="event-description">${description}</p>`;
        if (description.length > DESCRIPTION_LIMIT) {
            descriptionHTML += `<div class="event-see-more-container"><span class="event-see-more">Ver mais...</span></div>`;
        }
    
        eventCard.innerHTML = `
        <div class="event-header">
            <h3>${event.eventName}${friendsOnlyIcon}</h3>
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
            ${descriptionHTML}
            <div class="event-tags">
                ${event.tags.map(tag => `<span class="hobby-tag">${tag}</span>`).join('')}
            </div>
            <div class="event-actions">
                <button class="event-btn participate-btn ${isParticipating ? 'secondary' : ''}">
                    ${isParticipating ? 'Sair do Evento' : 'Participar'}
                </button>
                ${deleteButtonHTML}
            </div>
        </div>
        `;
    
        // Adiciona listeners aos botões
        const participateBtn = eventCard.querySelector('.participate-btn');
        participateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleParticipation(event.id, participateBtn);
        });
    
        if (isCreator) {
            const deleteBtn = eventCard.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteEvent(event.id);
            });
        }
    
        eventCardWrapper.appendChild(eventCard);
        eventsContainer.appendChild(eventCardWrapper);
    }


    async function deleteEvent(eventId) {
        const confirmed = await showConfirmationModal("Excluir Evento", "Você tem a certeza que quer excluir este evento? Esta ação não pode ser desfeita.");
        if (confirmed) {
            try {
                await db.collection('events').doc(eventId).delete();
                showToast("Evento excluído com sucesso!", "success");
                loadEvents();
            } catch (error) {
                console.error("Erro ao excluir evento:", error);
                showCustomAlert("Ocorreu um erro ao excluir o evento.");
            }
        }
    }
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

    // Em eventos.js
  // Em eventos.js
  async function createEvent(e) {
    e.preventDefault();

    // 1. Pega todos os valores dos campos
    const eventName = document.getElementById('eventName').value;
    const eventLocation = document.getElementById('eventLocation').value;
    const eventDate = document.getElementById('eventDate').value;
    const eventTime = document.getElementById('eventTime').value;
    const description = document.getElementById('eventDescription').value;
    const selectedCheckboxes = document.querySelectorAll('#createEventModal input[name="event-tags"]:checked');
    const tags = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
    const isFriendsOnly = document.getElementById('isFriendsOnly').checked;

    // 2. Faz todas as verificações
    if (!eventName || !eventLocation || !eventDate || !eventTime || !description || tags.length === 0) {
        showCustomAlert("Por favor, preencha todos os campos e selecione pelo menos uma tag.");
        return;
    }
    if (eventName.length > 20 || eventLocation.length > 40) {
        showCustomAlert("O nome ou a localização do evento excedem o limite de caracteres.");
        return;
    }

    // --- INÍCIO DA CORREÇÃO DEFINITIVA DO FUSO HORÁRIO ---
    const [year, month, day] = eventDate.split('-').map(Number);
    const [hours, minutes] = eventTime.split(':').map(Number);

    // Cria a data do evento usando os componentes numéricos, o que força o uso do fuso horário local.
    const eventDateTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();
    // --- FIM DA CORREÇÃO DEFINITIVA DO FUSO HORÁRIO ---

    if (eventDateTime < now) {
        showCustomAlert("Não é possível criar eventos em uma data ou hora que já passou.");
        return;
    }

    // 3. Continua com a criação do evento se tudo estiver correto
    try {
        await db.collection('events').add({
            eventName,
            eventLocation,
            eventDateTime, // Salva o objeto Date correto
            description,
            tags,
            creatorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            participants: [currentUser.uid],
            isFriendsOnly: isFriendsOnly
        });

        createEventModal.style.display = 'none';
        createEventForm.reset();
        showToast("Evento criado com sucesso!", "success");
        loadEvents();

    } catch (error) {
        console.error("Erro ao criar evento: ", error);
        showCustomAlert("Ocorreu um erro ao criar o evento.");
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