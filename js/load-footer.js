document.addEventListener("DOMContentLoaded", () => {
    // Evitar poner footer en la vista del editor (que es a pantalla completa)
    if (window.location.pathname.includes('ejercicio.html')) return;

    fetch('/components/footer.html')
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar el footer");
            return response.text();
        })
        .then(html => {
            const adminMain = document.querySelector('.admin-main');
            
            if (adminMain) {
                // Admin layout (tiene sidebar fijo)
                adminMain.style.display = 'flex';
                adminMain.style.flexDirection = 'column';
                adminMain.style.minHeight = '100vh';
                adminMain.insertAdjacentHTML('beforeend', html);
                
                const footer = adminMain.lastElementChild;
                if(footer.tagName === 'FOOTER') {
                    footer.style.marginTop = 'auto';
                }
            } else {
                // Normal layout
                document.body.style.display = 'flex';
                document.body.style.flexDirection = 'column';
                document.body.style.minHeight = '100vh';
                
                document.body.insertAdjacentHTML('beforeend', html);
                
                const footer = document.body.lastElementChild;
                if(footer.tagName === 'FOOTER') {
                    footer.style.marginTop = 'auto';
                    
                    if (document.getElementById('auth-screen')) {
                        footer.classList.add('position-absolute', 'bottom-0');
                        footer.classList.remove('mt-5', 'position-relative');
                    }
                }
            }
        })
        .catch(console.error);
});
