/**
 * @file Módulo de Navegación SPA (Single-Page Application) del Panel de Administración.
 * @description Este script es el motor que transforma el panel de administración en una
 *              Single-Page Application (SPA), proporcionando una experiencia de usuario
 *              rápida y fluida, similar a la de una aplicación de escritorio, al eliminar
 *              las recargas de página completas durante la navegación.
 *              También gestiona la funcionalidad de colapsar/expandir el sidebar.
 *
 * @funcionalidadesClave
 * 1.  **Navegación Asíncrona:** Intercepta los clics en los enlaces de navegación designados
 *     (ej. en la barra lateral) y, en lugar de recargar la página, utiliza `fetch` para
 *     obtener el contenido de la nueva vista de forma asíncrona.
 *
 * 2.  **Inyección de Contenido Dinámico:** Analiza el HTML recibido, extrae el contenedor
 *     principal (`#main-content-container`) y lo inyecta en el DOM actual, actualizando
 *     también el título de la página.
 *
 * 3.  **Gestión Inteligente de Scripts:**
 *     - **Carga Única:** Mantiene un registro de los scripts ya cargados para evitar
 *       volver a cargarlos y prevenir errores de redeclaración de variables.
 *     - **Ejecución Contextual:** Carga y ejecuta dinámicamente los scripts específicos
 *       de cada página solo cuando son necesarios.
 *
 * 4.  **Ciclo de Vida de Eventos (Event Lifecycle):** Dispara eventos personalizados para
 *     orquestar la inicialización y destrucción de los módulos de JavaScript de cada página:
 *     - `content-will-load`: Se emite ANTES de cargar nuevo contenido, permitiendo que los scripts actuales limpien listeners y timers.
 *     - `content-loaded`: Se emite DESPUÉS de que el nuevo contenido y sus scripts se han cargado, sirviendo como señal para la inicialización.
 */
document.addEventListener('DOMContentLoaded', function () {
    const mainContentContainer = document.getElementById('main-content-container');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const loadingOverlay = document.getElementById('loading-overlay');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const body = document.body;
    const SIDEBAR_COLLAPSED_KEY = 'adminSidebarCollapsed';

    //  Registrar los scripts ya cargados en la página inicial.
    // Esto evita que el SPA intente volver a cargarlos después de un hard refresh.
    function registerInitialScripts() {
        window.spaLoadedScripts = window.spaLoadedScripts || new Set();
        document.querySelectorAll('script[src]').forEach(script => {
            const scriptURL = new URL(script.src, window.location.origin).href;
            window.spaLoadedScripts.add(scriptURL);
        });
    }

    // Almacén para scripts ya cargados por el SPA
    window.spaLoadedScripts = window.spaLoadedScripts || new Set();

    function showLoadingOverlay() {
        loadingOverlay.classList.remove('hidden');
        setTimeout(() => {
            loadingOverlay.classList.add('opacity-100');
        }, 10);
    }

    function hideLoadingOverlay() {
        loadingOverlay.classList.remove('opacity-100');
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
        }, 300);
    }

    function loadContent(url, pushState = true) {
        // --- MEJORA PROFESIONAL: CICLO DE VIDA DE LA SPA ---
        // 1. Evento 'content-will-load': Se dispara ANTES de cargar el nuevo contenido.
        //    Es la señal para que los módulos de la página actual (ej. lista_ventas.js)
        //    se "destruyan": limpien sus event listeners y detengan temporizadores (setInterval).
        //    Esto evita que el JS de una página interfiera con otra, solucionando el error reportado.
        document.dispatchEvent(new CustomEvent('content-will-load'));
        console.log(`Event 'content-will-load' dispatched for URL: ${url}`);

        showLoadingOverlay();
        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (response.redirected && !response.url.includes('/administracion')) { // Avoid redirecting to login if already there
                window.location.href = response.url;
                return null;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text(); // Return the text content of the response
        })
        .then(html => {
            if (!html) return;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const mainContent = doc.getElementById('main-content-container');
            
            if (!mainContent) {
                console.error('Error: #main-content-container not found in fetched content.');
                window.location.reload();
                return;
            }

            const newContent = mainContent.innerHTML;
            mainContentContainer.innerHTML = newContent;

            const newTitle = doc.querySelector('title')?.textContent;
            if (newTitle) {
                document.title = newTitle;
            }

            // Cargar y ejecutar scripts de la página cargada.
            // Se buscan scripts SOLO dentro del contenedor principal para no
            // volver a ejecutar scripts globales de base.html.
            // Esto soluciona el error "Identifier '...' has already been declared".
            const scripts = Array.from(mainContent.querySelectorAll('script'));

            // Limpiar scripts inline gestionados por el SPA anterior.
            // Esto evita que se acumulen en el body en cada navegación.
            document.querySelectorAll('script[data-spa-managed-inline]').forEach(s => s.remove());

            const executeScripts = async () => {
                for (const script of scripts) {
                    // Omitir scripts que no son de JS ejecutable (ej. application/json)
                    if (script.type && !['text/javascript', 'application/javascript', ''].includes(script.type)) {
                        continue;
                    }

                    if (script.src) {
                        const scriptURL = new URL(script.src, window.location.origin).href;

                        // Si el script ya fue cargado, llamar a su función de reinicialización si existe
                        if (window.spaLoadedScripts.has(scriptURL)) {
                            // El script ya está cargado. Su listener 'content-loaded' se encargará de la reinicialización.
                            console.log(`Script ${scriptURL} already loaded. Skipping re-execution.`);
                            continue; // No volver a cargar el script
                        }

                        // Si es un script nuevo, cargarlo
                        const newScript = document.createElement('script');
                        script.getAttributeNames().forEach(attr => newScript.setAttribute(attr, script.getAttribute(attr)));
                        newScript.setAttribute('data-spa-managed', 'true');

                        try {
                            await new Promise((resolve, reject) => {
                                newScript.onload = () => {
                                    window.spaLoadedScripts.add(scriptURL);
                                    console.log(`Script loaded and registered: ${scriptURL}`);
                                    resolve();
                                };
                                newScript.onerror = reject;
                                document.body.appendChild(newScript);
                            });
                        } catch (error) {
                            console.error(`Failed to load script: ${scriptURL}`, error);
                        }
                    } else {
                        // Para scripts inline, simplemente los añadimos para que se ejecuten
                        const newScript = document.createElement('script');
                        script.getAttributeNames().forEach(attr => newScript.setAttribute(attr, script.getAttribute(attr)));
                        newScript.setAttribute('data-spa-managed-inline', 'true'); // Etiqueta específica para inline
                        newScript.textContent = script.innerText;
                        document.body.appendChild(newScript);
                    }
                }
            };

            executeScripts()
                .then(() => {
                    // 2. Evento 'content-loaded': Se dispara DESPUÉS de que el nuevo contenido
                    //    y sus scripts se han cargado. Es la señal para que el módulo de la
                    //    nueva página se inicialice.
                    document.dispatchEvent(new CustomEvent('content-loaded', { 
                        detail: { container: mainContentContainer, url: url } 
                    }));
                    // Devolver una promesa que se resuelva cuando el contenido esté completamente listo
                    // Esto es útil si 'content-loaded' desencadena más operaciones asíncronas.
                    return new Promise(resolve => setTimeout(resolve, 0));
                })
                .then(() => {
                    // Una vez que los scripts se han ejecutado y el evento 'content-loaded' se ha procesado,
                    // actualizamos el estado de la aplicación y la UI.
                    if (pushState) {
                        history.pushState({ path: url }, '', url);
                    }
                    updateActiveLink(url);

                    // Cerrar el menú lateral en móvil si está abierto
                    const mobileSidebar = document.getElementById('mobile-sidebar');
                    if (mobileSidebar && !mobileSidebar.classList.contains('hidden')) {
                        const mobileSidebarContent = mobileSidebar.querySelector('.sidebar-transition');
                        mobileSidebarContent.classList.add('-translate-x-full');
                        setTimeout(() => mobileSidebar.classList.add('hidden'), 300);
                    }

                    // Finalmente, ocultar el overlay de carga, ya que la página está lista para ser interactiva.
                    hideLoadingOverlay();
                });
        })
        .catch(e => {
            console.error('Error loading content:', e);
            mainContentContainer.innerHTML = '<div class="text-red-500 text-center p-8">Error al cargar el contenido. Por favor, inténtalo de nuevo.</div>';
            hideLoadingOverlay();
        });
    }

    window.loadAdminContent = loadContent;

    function updateActiveLink(currentUrl) {
        let currentPathname = new URL(currentUrl, window.location.origin).pathname;
        if (currentPathname.length > 1 && currentPathname.endsWith('/')) {
            currentPathname = currentPathname.slice(0, -1);
        }
        
        sidebarLinks.forEach(link => {
            let linkPathname = new URL(link.href, window.location.origin).pathname;
            if (linkPathname.length > 1 && linkPathname.endsWith('/')) {
                linkPathname = linkPathname.slice(0, -1);
            }

            link.classList.remove('active', 'bg-blue-800', 'text-white');
            link.classList.add('text-blue-200', 'hover:bg-blue-800', 'hover:text-white');

            if (linkPathname === currentPathname && link.getAttribute('href') !== '#') {
                link.classList.add('active', 'bg-blue-800', 'text-white');
                link.classList.remove('text-blue-200', 'hover:bg-blue-800', 'hover:text-white');
            }
        });
    }

    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.path) {
            loadContent(event.state.path, false);
        }
    });

    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('/admin/') && href !== '/admin/producto/crear') {
                e.preventDefault();
                loadContent(href);
            }
        });
    });

    document.addEventListener('click', function(e) {
        const targetLink = e.target.closest('.spa-back-link');
        if (targetLink) {
            const href = targetLink.getAttribute('href');
            if (href) {
                e.preventDefault();
                loadContent(href);
            }
        }
    });

    document.addEventListener('click', function(e) {
        const targetLink = e.target.closest('.spa-link');
        if (targetLink) {
            const href = targetLink.getAttribute('href');
            if (href && href.startsWith('/admin/') && href !== '/admin/producto/crear') {
                e.preventDefault();
                loadContent(href);
            }
        }
    });

    //  Ejecutar el registro de scripts iniciales.
    registerInitialScripts();

    updateActiveLink(window.location.pathname + window.location.search);

    // --- Sidebar Toggle Functionality ---
    function toggleSidebar() {
        // MEJORA: Alternar la clase en `document.documentElement` para ser consistente con el script de base.html
        const isCollapsed = document.documentElement.classList.toggle('sidebar-collapsed');
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed);
    }

    // Add event listener for the toggle button
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
});