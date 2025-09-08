
function toggleCategoryStatus(categoryId, categoryType, isActive) {
    const toggle = document.getElementById(`toggle-${categoryType}-${categoryId}`);
    if (!toggle) {
        console.error(`No se encontró el toggle para la categoría ${categoryType}-${categoryId}`);
        return;
    }

    const label = toggle.nextElementSibling;
    const span = label.querySelector('span');
    const row = toggle.closest('tr');

    // Store original state to revert on error
    const originalChecked = toggle.checked;
    const originalLabelClasses = Array.from(label.classList);
    const originalSpanClasses = Array.from(span.classList);
    const originalSpanInnerHTML = span.innerHTML;

    // Deshabilitar el toggle durante la petición
    toggle.disabled = true;

    // Añadir animación de carga
    span.innerHTML = `
        <svg class="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    `;

    // Resaltar la fila durante la operación
    if (row) {
        row.classList.add('bg-blue-100');
    }

    // Realizar la petición AJAX
    let apiUrl = '';
    if (categoryType === 'main') {
        apiUrl = `/admin/api/categorias-principales/${categoryId}/status`;
    } else if (categoryType === 'sub') {
        apiUrl = `/admin/api/subcategorias/${categoryId}/status`;
    } else if (categoryType === 'pseudo') {
        apiUrl = `/admin/api/seudocategorias/${categoryId}/status`;
    } else {
        console.error('Tipo de categoría desconocido:', categoryType);
        // Revertir el toggle visualmente y mostrar error
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

    fetch(apiUrl, { // Use the dynamically constructed URL
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken() // Assuming getCsrfToken() is available globally
        },
        body: JSON.stringify({
            estado: isActive ? 'activo' : 'inactivo'
            // category_type is not needed in the body as it's part of the URL
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
            // Si el estado no cambió, mostrar mensaje informativo y revertir
            if (data.status_unchanged) {
                window.toast.info(data.message);
                toggle.checked = originalChecked;
                label.className = originalLabelClasses.join(' ');
                span.className = originalSpanClasses.join(' ');
                span.innerHTML = originalSpanInnerHTML;
                return;
            }

            // Actualizar la UI del toggle
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

        } else {
            // Revertir el toggle visualmente y mostrar error si success is false
            toggle.checked = originalChecked;
            label.className = originalLabelClasses.join(' ');
            span.className = originalSpanClasses.join(' ');
            span.innerHTML = originalSpanInnerHTML;
            window.toast.error(data.message || 'No se pudo cambiar el estado de la categoría. Inténtalo de nuevo.');
        }
    })
    .catch(error => {
        console.error('Error al cambiar estado de la categoría:', error);
        // Revertir el toggle visualmente en caso de error de red o de la promesa
        toggle.checked = originalChecked;
        label.className = originalLabelClasses.join(' ');
        span.className = originalSpanClasses.join(' ');
        span.innerHTML = originalSpanInnerHTML; // Restore original icon
        window.toast.error('Error de conexión o servidor. No se pudo cambiar el estado de la categoría.');
    })
    .finally(() => {
        // Restaurar el estado original de la fila
        if (row) {
            row.classList.remove('bg-blue-100');
        }
        
        // Habilitar el toggle nuevamente
        toggle.disabled = false;
    });
}
