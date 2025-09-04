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
                'X-Requested-With': 'XMLHttpRequest' // Indicate an AJAX request
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Parse the HTML response
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newContent = doc.getElementById('main-content-container').innerHTML;

            // Update the main content area
            mainContentContainer.innerHTML = newContent;

            // Update URL in browser history
            if (pushState) {
                history.pushState({ path: url }, '', url);
            }

            // Update active link in sidebar
            updateActiveLink(url);

            // Re-execute scripts in the new content (if any)
            reExecuteScripts(mainContentContainer);

            // Close mobile sidebar if open
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

    function updateActiveLink(currentUrl) {
        // Normalize current URL pathname (remove trailing slash if present, unless it's just '/')
        let currentPathname = new URL(currentUrl, window.location.origin).pathname;
        if (currentPathname.length > 1 && currentPathname.endsWith('/')) {
            currentPathname = currentPathname.slice(0, -1);
        }

        sidebarLinks.forEach(link => {
            // Normalize link URL pathname
            let linkPathname = new URL(link.href, window.location.origin).pathname;
            if (linkPathname.length > 1 && linkPathname.endsWith('/')) {
                linkPathname = linkPathname.slice(0, -1);
            }

            // Always reset to default state first
            link.classList.remove('active', 'bg-blue-800', 'text-white');
            link.classList.add('text-blue-200', 'hover:bg-blue-800', 'hover:text-white');

            // Then apply active state if it matches and it's not a placeholder link
            if (linkPathname === currentPathname && link.getAttribute('href') !== '#') {
                link.classList.add('active', 'bg-blue-800', 'text-white');
                link.classList.remove('text-blue-200', 'hover:bg-blue-800', 'hover:text-white');
            }
        });
    }

    function reExecuteScripts(element) {
        const scripts = element.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    // Handle initial page load and popstate events
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.path) {
            loadContent(event.state.path, false); // Don't push state again
        }
    });

    // Intercept clicks on sidebar links
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('/admin/')) { // Only intercept admin links
                e.preventDefault();
                loadContent(href);
            }
        });
    });

    // Initial load to set active link and handle direct access
    updateActiveLink(window.location.pathname + window.location.search);
});