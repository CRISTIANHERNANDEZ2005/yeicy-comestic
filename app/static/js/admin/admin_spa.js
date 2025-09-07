document.addEventListener('DOMContentLoaded', function() {
    const mainContentContainer = document.getElementById('main-content-container');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const loadingOverlay = document.getElementById('loading-overlay');
    
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
            
            // Ejecutar scripts de la página cargada
            const scripts = doc.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.src) {
                    // Script externo
                    const newScript = document.createElement('script');
                    newScript.src = script.src;
                    document.body.appendChild(newScript);
                } else {
                    // Script inline
                    try {
                        eval(script.innerText);
                    } catch (e) {
                        console.error('Error executing script:', e);
                    }
                }
            });
            
            // Disparar evento personalizado
            document.dispatchEvent(new CustomEvent('content-loaded', { 
                detail: { container: mainContentContainer, url: url } 
            }));
            
            if (pushState) {
                history.pushState({ path: url }, '', url);
            }
            
            updateActiveLink(url);
            
            const mobileSidebar = document.getElementById('mobile-sidebar');
            const mobileSidebarContent = mobileSidebar.querySelector('.sidebar-transition');
            if (!mobileSidebar.classList.contains('hidden')) {
                mobileSidebarContent.classList.add('-translate-x-full');
                setTimeout(() => {
                    mobileSidebar.classList.add('hidden');
                }, 300);
            }
            
            hideLoadingOverlay();
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
    
    updateActiveLink(window.location.pathname + window.location.search);
});