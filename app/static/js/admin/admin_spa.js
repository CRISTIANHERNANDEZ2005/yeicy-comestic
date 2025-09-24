document.addEventListener('DOMContentLoaded', function() {
    const mainContentContainer = document.getElementById('main-content-container');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const loadingOverlay = document.getElementById('loading-overlay');

    // MEJORA PROFESIONAL: Registrar los scripts ya cargados en la página inicial.
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
        showLoadingOverlay();
        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (response.redirected) {
                window.location.href = response.url;
                return null;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
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
                        newScript.setAttribute('data-spa-managed', 'true');
                        newScript.textContent = script.innerText;
                        document.body.appendChild(newScript);
                    }
                }
            };
            
            executeScripts()
                .then(() => {
                    // Disparar evento personalizado DESPUÉS de que los scripts se hayan cargado
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
    
    // MEJORA PROFESIONAL: Ejecutar el registro de scripts iniciales.
    registerInitialScripts();

    updateActiveLink(window.location.pathname + window.location.search);
});