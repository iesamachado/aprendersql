(function() {
    // 1. Initial theme load (blocking, to prevent flash)
    const storedTheme = localStorage.getItem('aprendersql_theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', storedTheme);

    // 2. Add floating toggle button on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = 'btn btn-outline-secondary rounded-circle shadow';
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.width = '45px';
        btn.style.height = '45px';
        btn.style.zIndex = '9999';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.backdropFilter = 'blur(4px)';
        btn.style.transition = 'all 0.3s';
        
        // Ensure it doesn't overlap with the footer's absolute positioning on auth-screen
        if (document.getElementById('auth-screen')) {
             btn.style.bottom = '80px';
        }
        
        // Icon logic
        const updateIcon = () => {
            const current = document.documentElement.getAttribute('data-bs-theme');
            if (current === 'light') {
                btn.innerHTML = '<i class="fas fa-moon"></i>';
                btn.classList.remove('btn-outline-light');
                btn.classList.add('btn-outline-dark');
                btn.style.backgroundColor = 'rgba(255,255,255,0.8)';
            } else {
                btn.innerHTML = '<i class="fas fa-sun"></i>';
                btn.classList.remove('btn-outline-dark');
                btn.classList.add('btn-outline-light');
                btn.style.backgroundColor = 'rgba(0,0,0,0.5)';
            }
        };

        updateIcon();
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-bs-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', next);
            localStorage.setItem('aprendersql_theme', next);
            updateIcon();
            
            // Dispatch event for any custom logic (like code editor themes)
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: next }));
        });
        
        // Listen for external theme changes (like Monaco editor setting it)
        window.addEventListener('themeChanged', (e) => {
            if (e.detail) {
               updateIcon();
            }
        });
    });
})();
