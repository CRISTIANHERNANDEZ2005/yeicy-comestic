// MEJORA PROFESIONAL: Módulo de Notificaciones en Carga de Página

class PageLoadNotifier {
    constructor() {
        this.modal = document.getElementById('realtime-notification-modal');
        if (!this.modal) {
            console.error('El elemento de la modal de notificación no fue encontrado. El notificador no se iniciará.');
            return;
        }

        this.modalContent = document.getElementById('realtime-notification-content');
        this.header = document.getElementById('notification-header');
        this.iconContainer = document.getElementById('notification-icon-container');
        this.title = document.getElementById('notification-title');
        this.message = document.getElementById('notification-message');
        this.statusBadge = document.getElementById('notification-status');
        this.orderId = document.getElementById('notification-order-id');
        this.timestamp = document.getElementById('notification-timestamp');
        this.closeBtn = document.getElementById('notification-close-btn');
        this.actionBtn = document.getElementById('notification-action-btn');
        
        this.icons = {
            'recibido': '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>',
            'en preparacion': '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>',
            'en camino': '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>',
            'entregado': '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            'cancelado': '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        this.statusLabels = {
            'recibido': 'Recibido',
            'en preparacion': 'En Preparación',
            'en camino': 'En Camino',
            'entregado': 'Entregado',
            'cancelado': 'Cancelado'
        };

        this.init();
    }

    init() {
        // Solo continuar si la modal existe
        if (!this.modal) return;

        const isAuthenticated = document.body.getAttribute('data-is-authenticated') === 'true';
        if (isAuthenticated) {
            this.checkForNotifications();
        }

        this.closeBtn.addEventListener('click', () => this.hideModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
    }

    async checkForNotifications() {
        console.log('Buscando notificaciones de pedidos...');
        try {
            const response = await fetch('/events/api/check-notifications');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const data = await response.json();

            if (data.success && data.notifications && data.notifications.length > 0) {
                console.log(`Se encontraron ${data.notifications.length} notificaciones. Mostrando la más reciente.`);
                // Mostrar solo la primera (la más reciente) para no abrumar al usuario
                this.showModal(data.notifications[0]);
            } else if (!data.success) {
                console.error('La API de notificaciones devolvió un error:', data.message);
            } else {
                console.log('No hay notificaciones nuevas.');
            }
        } catch (error) {
            console.error('Error al buscar notificaciones:', error);
        }
    }

    showModal(data) {
        const { title, message, status, order_id } = data;
        const statusKey = status.replace(/ /g, '-');
        const formattedStatus = this.statusLabels[statusKey] || status;

        // Configurar cabecera con color de estado
        this.header.className = `h-2 w-full transition-all duration-500 header-${statusKey}`;

        // Configurar título y mensaje
        this.title.textContent = title;
        this.message.textContent = message;

        // Configurar icono y color
        const iconClass = `icon-${statusKey}`;
        this.iconContainer.innerHTML = this.icons[statusKey] || this.icons['recibido'];
        this.iconContainer.className = `w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-300 hover:scale-110 ${iconClass}`;

        // Configurar detalles del pedido
        this.statusBadge.textContent = formattedStatus;
        this.statusBadge.className = `text-sm font-semibold px-3 py-1 rounded-full badge-${statusKey}`;
        this.orderId.textContent = order_id;
        
        // Configurar timestamp
        const now = new Date();
        this.timestamp.textContent = `Notificado: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

        // Configurar botón de acción
        this.actionBtn.href = `/pedido/${order_id}`;

        // Mostrar modal con animación
        this.modal.classList.remove('hidden');
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10); // Pequeño delay para que la transición CSS funcione
        
        // Forzar animación de entrada para los detalles
        setTimeout(() => {
            document.getElementById('notification-details').style.animation = 'slideIn 0.5s ease-out forwards';
        }, 300);
    }

    hideModal() {
        this.modal.classList.remove('show');
        setTimeout(() => {
            this.modal.classList.add('hidden');
            // Resetear animación para la próxima vez
            document.getElementById('notification-details').style.animation = 'none';
        }, 300); // Coincide con la duración de la transición
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar el notificador solo si el elemento de la modal existe
    if (document.getElementById('realtime-notification-modal')) {
        new PageLoadNotifier();
    }
});