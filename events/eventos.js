// Script para corrigir a lógica dos marcadores no mapa
document.addEventListener('DOMContentLoaded', function() {
    // Referência ao iframe do mapa
    const mapIframe = document.querySelector('.map iframe');
    
    // Referência ao container do mapa
    const mapContainer = document.querySelector('.map');
    
    // Referência aos marcadores
    const markers = document.querySelectorAll('.map-marker');
    
    // Referência ao tooltip
    const tooltip = document.querySelector('.map-tooltip');
    
    // Função para inicializar o mapa com marcadores dinâmicos
    function initMap() {
        // Remover os marcadores estáticos existentes
        markers.forEach(marker => {
            marker.remove();
        });
        
        // Dados dos eventos (normalmente viriam de um banco de dados)
        const events = [
            {
                name: "Feira de Ciências",
                date: "15/05 - 14:00",
                location: "Auditório Principal",
                lat: -23.5608,
                lng: -46.6547
            },
            {
                name: "Torneio de Basquete",
                date: "22/05 - 09:00",
                location: "Quadra Poliesportiva",
                lat: -23.5670,
                lng: -46.6520
            },
            {
                name: "Show da Banda Escolar",
                date: "28/05 - 19:00",
                location: "Pátio Central",
                lat: -23.5630,
                lng: -46.6580
            }
        ];
        
        // Criar um novo script para injetar no iframe após o carregamento
        mapIframe.addEventListener('load', function() {
            try {
                // Acessar o documento do iframe
                const iframeDocument = mapIframe.contentDocument || mapIframe.contentWindow.document;
                
                // Injetar script para adicionar marcadores ao mapa do Google
                const script = iframeDocument.createElement('script');
                script.textContent = `
                    // Função para adicionar marcadores ao mapa
                    function addMarkers() {
                        // Verificar se o Google Maps API está disponível
                        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                            console.error('Google Maps API não está disponível');
                            return;
                        }
                        
                        // Obter a instância do mapa
                        const maps = document.querySelectorAll('iframe[src*="google.com/maps"]');
                        if (maps.length === 0) return;
                        
                        const mapInstance = maps[0].contentWindow.google.maps.map;
                        if (!mapInstance) return;
                        
                        // Dados dos eventos
                        const events = ${JSON.stringify(events)};
                        
                        // Adicionar marcadores para cada evento
                        events.forEach(event => {
                            const marker = new google.maps.Marker({
                                position: { lat: event.lat, lng: event.lng },
                                map: mapInstance,
                                title: event.name,
                                animation: google.maps.Animation.DROP
                            });
                            
                            // Adicionar infowindow para cada marcador
                            const infowindow = new google.maps.InfoWindow({
                                content: \`
                                    <div>
                                        <h4>\${event.name}</h4>
                                        <p>\${event.date}</p>
                                        <p>\${event.location}</p>
                                    </div>
                                \`
                            });
                            
                            // Abrir infowindow ao clicar no marcador
                            marker.addListener('click', function() {
                                infowindow.open(mapInstance, marker);
                            });
                        });
                    }
                    
                    // Tentar adicionar marcadores após um pequeno delay
                    setTimeout(addMarkers, 1000);
                `;
                
                // Adicionar o script ao documento do iframe
                iframeDocument.body.appendChild(script);
            } catch (error) {
                console.error('Erro ao acessar o iframe:', error);
                
                // Plano B: Usar marcadores personalizados com posicionamento relativo
                createCustomMarkers(events);
            }
        });
    }
    
    // Função alternativa para criar marcadores personalizados
    function createCustomMarkers(events) {
        // Limpar marcadores existentes
        mapContainer.querySelectorAll('.map-marker').forEach(marker => marker.remove());
        
        // Adicionar novos marcadores com posicionamento relativo
        events.forEach(event => {
            // Converter coordenadas para posição relativa no mapa
            // Estas são aproximações baseadas no centro do mapa
            const latRange = [-23.57, -23.56]; // Aproximação do range de latitude visível
            const lngRange = [-46.66, -46.65]; // Aproximação do range de longitude visível
            
            // Calcular posição percentual no mapa
            const latPercent = 100 - ((event.lat - latRange[0]) / (latRange[1] - latRange[0]) * 100);
            const lngPercent = (event.lng - lngRange[0]) / (lngRange[1] - lngRange[0]) * 100;
            
            // Criar marcador
            const marker = document.createElement('div');
            marker.className = 'map-marker';
            marker.style.top = `${latPercent}%`;
            marker.style.left = `${lngPercent}%`;
            marker.setAttribute('data-event', event.name);
            marker.setAttribute('data-date', event.date);
            marker.setAttribute('data-location', event.location);
            
            // Adicionar evento de clique para mostrar tooltip
            marker.addEventListener('click', function() {
                tooltip.querySelector('h4').textContent = this.getAttribute('data-event');
                tooltip.querySelector('p:nth-child(2)').textContent = this.getAttribute('data-date');
                tooltip.querySelector('p:nth-child(3)').textContent = this.getAttribute('data-location');
                
                // Posicionar tooltip próximo ao marcador
                tooltip.style.top = `${this.offsetTop - tooltip.offsetHeight - 10}px`;
                tooltip.style.left = `${this.offsetLeft - (tooltip.offsetWidth / 2) + 10}px`;
                tooltip.style.display = 'block';
            });
            
            // Adicionar marcador ao mapa
            mapContainer.appendChild(marker);
        });
        
        // Fechar tooltip ao clicar fora
        document.addEventListener('click', function(e) {
            if (!e.target.classList.contains('map-marker')) {
                tooltip.style.display = 'none';
            }
        });
    }
    
    // Inicializar o mapa
    initMap();
});
   // Script para o modal de criar evento
   document.addEventListener('DOMContentLoaded', function() {
    const createEventBtn = document.getElementById('createEventBtn');
    const createEventModal = document.getElementById('createEventModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    
    createEventBtn.addEventListener('click', function() {
        createEventModal.style.display = 'flex';
    });
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            createEventModal.style.display = 'none';
        });
    });
    
    // Fechar modal ao clicar fora dele
    window.addEventListener('click', function(event) {
        if (event.target === createEventModal) {
            createEventModal.style.display = 'none';
        }
    });
    
    // Prevenir envio do formulário (apenas para demonstração)
    document.querySelector('.modal-form').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Evento criado com sucesso!');
        createEventModal.style.display = 'none';
    });
    
    // Interatividade do mapa
    const mapMarkers = document.querySelectorAll('.map-marker');
    const mapTooltip = document.querySelector('.map-tooltip');
    
    mapMarkers.forEach(marker => {
        marker.addEventListener('mouseenter', function(e) {
            const eventName = this.getAttribute('data-event');
            mapTooltip.querySelector('h4').textContent = eventName;
            
            // Posicionar tooltip próximo ao marcador
            const markerRect = this.getBoundingClientRect();
            const mapRect = document.querySelector('.map').getBoundingClientRect();
            
            mapTooltip.style.top = (markerRect.top - mapRect.top - 70) + 'px';
            mapTooltip.style.left = (markerRect.left - mapRect.left + 15) + 'px';
            mapTooltip.style.display = 'block';
        });
        
        marker.addEventListener('mouseleave', function() {
            mapTooltip.style.display = 'none';
        });
    });
});
    // Script para o modal de criar evento
        document.addEventListener('DOMContentLoaded', function() {
            const createEventBtn = document.getElementById('createEventBtn');
            const createEventModal = document.getElementById('createEventModal');
            const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
            
            createEventBtn.addEventListener('click', function() {
                createEventModal.style.display = 'flex';
            });
            
            closeModalBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    createEventModal.style.display = 'none';
                });
            });
            
            // Fechar modal ao clicar fora dele
            window.addEventListener('click', function(event) {
                if (event.target === createEventModal) {
                    createEventModal.style.display = 'none';
                }
            });
            
            // Prevenir envio do formulário (apenas para demonstração)
            document.querySelector('.modal-form').addEventListener('submit', function(e) {
                e.preventDefault();
                alert('Evento criado com sucesso!');
                createEventModal.style.display = 'none';
            });
            
            // Interatividade do mapa
            const mapMarkers = document.querySelectorAll('.map-marker');
            const mapTooltip = document.querySelector('.map-tooltip');
            
            mapMarkers.forEach(marker => {
                marker.addEventListener('mouseenter', function(e) {
                    const eventName = this.getAttribute('data-event');
                    mapTooltip.querySelector('h4').textContent = eventName;
                    
                    // Posicionar tooltip próximo ao marcador
                    const markerRect = this.getBoundingClientRect();
                    const mapRect = document.querySelector('.map').getBoundingClientRect();
                    
                    mapTooltip.style.top = (markerRect.top - mapRect.top - 70) + 'px';
                    mapTooltip.style.left = (markerRect.left - mapRect.left + 15) + 'px';
                    mapTooltip.style.display = 'block';
                });
                
                marker.addEventListener('mouseleave', function() {
                    mapTooltip.style.display = 'none';
                });
            });
        });
            // Script para o modal de criar evento
            document.addEventListener('DOMContentLoaded', function() {
                const createEventBtn = document.getElementById('createEventBtn');
                const createEventModal = document.getElementById('createEventModal');
                const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
                
                createEventBtn.addEventListener('click', function() {
                    createEventModal.style.display = 'flex';
                });
                
                closeModalBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        createEventModal.style.display = 'none';
                    });
                });
                
                // Fechar modal ao clicar fora dele
                window.addEventListener('click', function(event) {
                    if (event.target === createEventModal) {
                        createEventModal.style.display = 'none';
                    }
                });
                
                // Prevenir envio do formulário (apenas para demonstração)
                document.querySelector('.modal-form').addEventListener('submit', function(e) {
                    e.preventDefault();
                    alert('Evento criado com sucesso!');
                    createEventModal.style.display = 'none';
                });
                
                // Interatividade do mapa
                const mapMarkers = document.querySelectorAll('.map-marker');
                const mapTooltip = document.querySelector('.map-tooltip');
                
                mapMarkers.forEach(marker => {
                    marker.addEventListener('mouseenter', function(e) {
                        const eventName = this.getAttribute('data-event');
                        mapTooltip.querySelector('h4').textContent = eventName;
                        
                        // Posicionar tooltip próximo ao marcador
                        const markerRect = this.getBoundingClientRect();
                        const mapRect = document.querySelector('.map').getBoundingClientRect();
                        
                        mapTooltip.style.top = (markerRect.top - mapRect.top - 70) + 'px';
                        mapTooltip.style.left = (markerRect.left - mapRect.left + 15) + 'px';
                        mapTooltip.style.display = 'block';
                    });
                    
                    marker.addEventListener('mouseleave', function() {
                        mapTooltip.style.display = 'none';
                    });
                });
            });
            //testeeee
            //testee