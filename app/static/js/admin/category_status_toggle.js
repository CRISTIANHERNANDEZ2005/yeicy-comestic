/**
 * @file Módulo para el Cambio de Estado de Categorías.
 * @description Este script proporciona una función reutilizable `toggleCategoryStatus` para
 *              gestionar la activación y desactivación de categorías, subcategorías y
 *              seudocategorías. Está diseñado para ofrecer una experiencia de usuario
 *              fluida y con feedback visual inmediato.
 *
 * @funcionalidad
 * 1.  **Petición Asíncrona:** Envía una solicitud `POST` a la API correspondiente para
 *     actualizar el estado de la categoría en la base de datos.
 * 2.  **Feedback Visual:** Muestra una animación de carga en el interruptor (toggle)
 *     mientras se procesa la solicitud, y resalta la fila afectada.
 * 3.  **Manejo de Estados:** Actualiza la apariencia del interruptor para reflejar el
 *     nuevo estado (activo/inactivo) tras una respuesta exitosa.
 * 4.  **Gestión de Errores:** En caso de fallo en la API o en la red, revierte
 *     visualmente el interruptor a su estado original y muestra una notificación
 *     de error al usuario, garantizando la consistencia de la UI.
 */

function toggleCategoryStatus(categoryId, categoryType, isActive) {
    const toggle = document.getElementById(`toggle-${categoryType}-${categoryId}`);
    if (!toggle) {
        console.error(`No se encontró el toggle para la categoría ${categoryType}-${categoryId}`);
        return;
    }

    const label = toggle.nextElementSibling;
    const span = label.querySelector('span');
    const row = toggle.closest('tr');

    const originalChecked = toggle.checked;
    const originalLabelClasses = Array.from(label.classList);
    const originalSpanClasses = Array.from(span.classList);
    const originalSpanInnerHTML = span.innerHTML;

    // Deshabilitar el interruptor durante la petición para evitar clics múltiples.
    toggle.disabled = true;

    // Añadir animación de carga al interruptor para feedback visual.
    span.innerHTML = `
        <svg class="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    `;

    // Resaltar la fila de la tabla durante la operación.
    if (row) {
        row.classList.add('bg-blue-100');
    }

    // Construir la URL de la API dinámicamente según el tipo de categoría.
    let apiUrl = '';
    if (categoryType === 'main') {
        apiUrl = `/admin/api/categorias-principales/${categoryId}/status`;
    } else if (categoryType === 'sub') {
        apiUrl = `/admin/api/subcategorias/${categoryId}/status`;
    } else if (categoryType === 'pseudo') {
        apiUrl = `/admin/api/seudocategorias/${categoryId}/status`;
    } else {
        console.error('Tipo de categoría desconocido:', categoryType);
        // Revertir el interruptor visualmente y mostrar error.
        toggle.checked = originalChecked;
        label.className = originalLabelClasses.join(' ');
        span.className = originalSpanClasses.join(' ');
        span.innerHTML = originalSpanInnerHTML;
        window.toast.error('Error: Tipo de categoría desconocido.');
        if (row) {
            row.classList.remove('bg-blue-100');
        }
        toggle.disabled = false;
        return;
    }

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken() // Asume que getCsrfToken() está disponible globalmente.
        },
        body: JSON.stringify({
            estado: isActive ? 'activo' : 'inactivo'
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.message || 'Error en la solicitud');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Si el estado no cambió en el backend, mostrar un mensaje informativo y revertir la UI.
            if (data.status_unchanged) {
                window.toast.info(data.message);
                toggle.checked = originalChecked;
                label.className = originalLabelClasses.join(' ');
                span.className = originalSpanClasses.join(' ');
                span.innerHTML = originalSpanInnerHTML;
                return;
            }

            // Actualizar la UI del interruptor para reflejar el nuevo estado.
            if (data.new_status === 'activo') {
                label.classList.remove('bg-gray-300');
                label.classList.add('bg-gradient-to-r', 'from-green-400', 'to-emerald-500', 'shadow-lg');
                span.classList.add('transform', 'translate-x-7');
                span.classList.remove('translate-x-0');
                span.innerHTML = `
                    <svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                `;
            } else {
                label.classList.add('bg-gray-300');
                label.classList.remove('bg-gradient-to-r', 'from-green-400', 'to-emerald-500', 'shadow-lg');
                span.classList.remove('transform', 'translate-x-7');
                span.classList.add('translate-x-0');
                span.innerHTML = `
                    <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                `;
            }
            window.toast.success(data.message);

            // Recargar la tabla para reflejar cambios (ej. la aparición/desaparición del botón de editar).
            if (window.categoriesApp && typeof window.categoriesApp.loadTableData === 'function') {
                window.categoriesApp.loadTableData(false); // `false` para no resetear la paginación.
            }

        } else {
            // Revertir el interruptor visualmente y mostrar error si la API devuelve success: false.
            toggle.checked = originalChecked;
            label.className = originalLabelClasses.join(' ');
            span.className = originalSpanClasses.join(' ');
            span.innerHTML = originalSpanInnerHTML;
            window.toast.error(data.message || 'No se pudo cambiar el estado de la categoría. Inténtalo de nuevo.');
        }
    })
    .catch(error => {
        console.error('Error al cambiar estado de la categoría:', error);
        // Revertir el interruptor visualmente en caso de error de red o de la promesa.
        toggle.checked = originalChecked;
        label.className = originalLabelClasses.join(' ');
        span.className = originalSpanClasses.join(' ');
        span.innerHTML = originalSpanInnerHTML;
        window.toast.error('Error de conexión o servidor. No se pudo cambiar el estado de la categoría.');
    })
    .finally(() => {
        // Restaurar el estado original de la fila, eliminando el resaltado.
        if (row) {
            row.classList.remove('bg-blue-100');
        }
        
        // Habilitar el interruptor nuevamente, independientemente del resultado.
        toggle.disabled = false;
    });
}
