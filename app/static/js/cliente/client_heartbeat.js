/**
 * client_heartbeat.js
 *
 * Este script implementa un mecanismo de "heartbeat" (latido) para los clientes
 * que han iniciado sesión. Su propósito es mantener actualizado el estado "En línea"
 * del usuario mientras navega activamente por el sitio.
 */

(function() {
    // Variable para almacenar el temporizador del heartbeat.
    let heartbeatInterval = null;

    /**
     * Envía una petición POST al endpoint de heartbeat del cliente.
     * Esta petición le dice al servidor "el usuario sigue activo".
     */
    function sendHeartbeat() {
        // Solo envía el latido si la pestaña del navegador está visible.
        // Esto es una optimización clave para no gastar recursos si el usuario
        // está en otra pestaña o tiene el navegador minimizado.
        if (document.visibilityState === 'visible') {
            fetch('/auth/heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // El token JWT se envía automáticamente a través de la cookie 'token'.
                },
            }).catch(error => {
                // No es un error crítico, solo lo mostramos en la consola.
                console.warn("Client heartbeat failed:", error);
            });
        }
    }

    /**
     * Inicia el proceso de heartbeat.
     * Se ejecuta una vez al cargar la página y luego periódicamente.
     */
    function startHeartbeat() {
        // Detiene cualquier intervalo anterior para evitar duplicados.
        if (heartbeatInterval) clearInterval(heartbeatInterval);

        // MEJORA PROFESIONAL: Enviar un latido inmediatamente al cargar la página.
        // Esto asegura que el estado "En línea" se actualice al instante en cada recarga.
        sendHeartbeat();

        // Envía un latido cada 60 segundos.
        heartbeatInterval = setInterval(sendHeartbeat, 60000);
    }

    // Iniciar el heartbeat cuando el DOM esté completamente cargado.
    document.addEventListener('DOMContentLoaded', startHeartbeat);
})();