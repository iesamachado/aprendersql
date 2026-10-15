/**
 * AprenderSQL - Banner de advertencia para usuarios de Windows
 * Muestra un banner chillón, molesto y no removible de 50vh en la mitad inferior de la pantalla.
 */
(function() {
    'use strict';

    if (window.__WINDOWS_BANNER_INITIALIZED__) return;
    window.__WINDOWS_BANNER_INITIALIZED__ = true;

    // 1. Detección de Windows (con bypass para pruebas ?test_windows=1 o localStorage)
    function isWindowsUser() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('test_windows') === '1') return true;
            if (urlParams.get('test_windows') === '0') return false;
            if (localStorage.getItem('test_windows') === '1') return true;
        } catch (e) {}

        // Comprobación moderna mediante Client Hints API
        if (navigator.userAgentData && navigator.userAgentData.platform) {
            if (/windows/i.test(navigator.userAgentData.platform)) {
                return true;
            }
        }

        // Comprobación tradicional mediante User-Agent y Platform
        const ua = (navigator.userAgent || '').toLowerCase();
        const platform = (navigator.platform || '').toLowerCase();

        return ua.includes('windows') || platform.includes('win');
    }

    if (!isWindowsUser()) {
        return; // No es Windows ni modo de prueba: no hacer nada
    }

    // 2. Inyección de estilos CSS
    function injectStyles() {
        if (document.getElementById('windows-banner-styles')) return;

        const style = document.createElement('style');
        style.id = 'windows-banner-styles';
        style.textContent = `
            @keyframes winHazardStripes {
                0% { background-position: 0 0; }
                100% { background-position: 50px 0; }
            }
            @keyframes winBlinkText {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.85; transform: scale(1.02); }
            }
            @keyframes winBorderFlash {
                0% { border-color: #00ffff; box-shadow: 0 -8px 25px rgba(255, 0, 85, 0.8), inset 0 0 20px #00ffff; }
                50% { border-color: #ffff00; box-shadow: 0 -8px 25px rgba(255, 230, 0, 0.9), inset 0 0 20px #ff0055; }
                100% { border-color: #00ffff; box-shadow: 0 -8px 25px rgba(255, 0, 85, 0.8), inset 0 0 20px #00ffff; }
            }
            @keyframes winShakeMini {
                0% { transform: rotate(0deg); }
                25% { transform: rotate(-2deg); }
                75% { transform: rotate(2deg); }
                100% { transform: rotate(0deg); }
            }

            #windows-penalty-banner {
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100vw !important;
                height: 50vh !important;
                min-height: 50vh !important;
                max-height: 50vh !important;
                z-index: 2147483647 !important;
                display: flex !important;
                flex-direction: column !important;
                background: linear-gradient(135deg, #ff0055 0%, #ff3300 45%, #ffd000 100%) !important;
                border-top: 8px dashed #00ffff !important;
                box-sizing: border-box !important;
                animation: winBorderFlash 1.5s infinite !important;
                color: #000 !important;
                font-family: 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', 'Impact', cursive, sans-serif !important;
                box-shadow: 0 -15px 40px rgba(0, 0, 0, 0.8) !important;
                overflow: hidden !important;
                pointer-events: auto !important;
                user-select: none !important;
            }

            /* Franja de precaución superior */
            .win-caution-tape {
                width: 100% !important;
                height: 38px !important;
                background: repeating-linear-gradient(
                    -45deg,
                    #000,
                    #000 20px,
                    #ffe600 20px,
                    #ffe600 40px
                ) !important;
                animation: winHazardStripes 2s linear infinite !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-bottom: 3px solid #000 !important;
                flex-shrink: 0 !important;
            }

            .win-caution-ticker {
                background: rgba(0, 0, 0, 0.88) !important;
                color: #ffe600 !important;
                padding: 3px 20px !important;
                font-weight: 900 !important;
                font-size: 15px !important;
                letter-spacing: 2px !important;
                text-transform: uppercase !important;
                display: flex !important;
                gap: 15px !important;
                white-space: nowrap !important;
                box-shadow: 0 0 10px #000 !important;
            }

            /* Contenedor principal de contenidos */
            .win-body-container {
                flex: 1 !important;
                display: flex !important;
                flex-direction: row !important;
                padding: 12px 20px !important;
                gap: 20px !important;
                overflow-y: auto !important;
                position: relative !important;
                align-items: center !important;
                justify-content: space-between !important;
            }

            @media (max-width: 900px) {
                .win-body-container {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    overflow-y: auto !important;
                }
            }

            /* Columna izquierda con texto molesto */
            .win-main-message {
                flex: 1 1 55% !important;
                background: rgba(255, 255, 255, 0.94) !important;
                border: 4px solid #000 !important;
                border-radius: 12px !important;
                padding: 14px 18px !important;
                box-shadow: 6px 6px 0px #000 !important;
            }

            .win-header-title {
                margin: 0 0 8px 0 !important;
                font-size: 1.45rem !important;
                font-weight: 900 !important;
                color: #ff0033 !important;
                text-shadow: 1px 1px 0 #ffff00, -1px -1px 0 #00ffff !important;
                animation: winBlinkText 2s ease-in-out infinite !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }

            .win-message-p {
                margin: 4px 0 !important;
                font-size: 0.98rem !important;
                line-height: 1.35 !important;
                color: #111 !important;
                font-weight: 600 !important;
            }

            .win-points-list {
                margin: 8px 0 0 0 !important;
                padding-left: 20px !important;
                font-size: 0.88rem !important;
                color: #333 !important;
            }

            .win-points-list li {
                margin-bottom: 4px !important;
            }

            /* Columna derecha con pantalla azul cómica y controles trampa */
            .win-bsod-card {
                flex: 1 1 40% !important;
                background: #0078d7 !important;
                color: #fff !important;
                padding: 14px 18px !important;
                border: 4px solid #fff !important;
                border-radius: 12px !important;
                box-shadow: 6px 6px 0px #000 !important;
                font-family: 'Segoe UI', Tahoma, sans-serif !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                animation: winShakeMini 6s ease-in-out infinite !important;
            }

            .win-bsod-frown {
                font-size: 2.2rem !important;
                line-height: 1 !important;
                margin-bottom: 6px !important;
            }

            .win-bsod-text {
                font-size: 0.92rem !important;
                line-height: 1.3 !important;
                margin-bottom: 10px !important;
            }

            .win-bsod-code {
                font-family: monospace !important;
                font-size: 0.78rem !important;
                background: rgba(0,0,0,0.2) !important;
                padding: 4px 8px !important;
                border-radius: 4px !important;
            }

            /* Botón troll que se escapa */
            .win-fake-btn-wrap {
                position: relative !important;
                height: 48px !important;
                margin-top: 10px !important;
            }

            #win-fake-close-btn {
                position: absolute !important;
                left: 10px !important;
                top: 0px !important;
                background: #ffcc00 !important;
                color: #000 !important;
                border: 3px solid #000 !important;
                font-weight: 900 !important;
                font-size: 0.95rem !important;
                padding: 8px 16px !important;
                border-radius: 30px !important;
                cursor: not-allowed !important;
                box-shadow: 4px 4px 0px #000 !important;
                transition: transform 0.15s ease-out, top 0.18s ease-out, left 0.18s ease-out !important;
                white-space: nowrap !important;
                font-family: 'Comic Sans MS', cursive, sans-serif !important;
            }

            #win-fake-close-btn:hover {
                background: #ff0055 !important;
                color: #fff !important;
            }

            .win-unremovable-badge {
                display: inline-block !important;
                background: #000 !important;
                color: #00ffcc !important;
                font-size: 0.75rem !important;
                font-weight: 800 !important;
                padding: 2px 8px !important;
                border-radius: 4px !important;
                margin-top: 6px !important;
                text-align: center !important;
                letter-spacing: 1px !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 3. Creación y renderizado del banner
    function createBanner() {
        if (document.getElementById('windows-penalty-banner')) return;

        injectStyles();

        const banner = document.createElement('div');
        banner.id = 'windows-penalty-banner';
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'assertive');

        banner.innerHTML = `
            <div class="win-caution-tape">
                <div class="win-caution-ticker">
                    <span>⚠️ ATENCIÓN</span>
                    <span>•</span>
                    <span>SISTEMA WINDOWS DETECTADO</span>
                    <span>•</span>
                    <span>PENALIZACIÓN DEL 50% DE PANTALLA ACTIVA</span>
                    <span>•</span>
                    <span>NO SE PUEDE CERRAR</span>
                    <span>•</span>
                    <span>INSTALE LINUX O ACÉPTELO</span>
                    <span>⚠️</span>
                </div>
            </div>
            <div class="win-body-container" id="win-body-bounds">
                <div class="win-main-message">
                    <h2 class="win-header-title">
                        <span>🪟🤮</span>
                        <span>¡ALERTA CRÍTICA: ESTÁS USANDO WINDOWS!</span>
                    </h2>
                    <p class="win-message-p">
                        Nuestros sensores detectan que estás intentando aprender SQL desde <strong>Microsoft Windows</strong>.
                        Por motivos de dignidad tecnológica y como recordatorio permanente, <strong>el 50% de tu pantalla queda confiscado indefinidamente</strong>.
                    </p>
                    <ul class="win-points-list">
                        <li><strong>Latencia de consulta:</strong> +8.500ms simulando la lentitud del registro de Windows.</li>
                        <li><strong>Actualizaciones:</strong> Tu equipo podría reiniciarse automáticamente a mitad de tu examen o ejercicio.</li>
                        <li><strong>Tratamiento prescrito:</strong> Arranca en Ubuntu, Debian, Fedora o Arch Linux para recuperar tu pantalla.</li>
                    </ul>
                    <div class="win-unremovable-badge">
                        🔒 [ESTE BANNER NO SE PUEDE CERRAR MIENTRAS SIGAS EN WINDOWS]
                    </div>
                </div>

                <div class="win-bsod-card">
                    <div>
                        <div class="win-bsod-frown">:(</div>
                        <div class="win-bsod-text">
                            Tu sistema operativo no cumple los estándares éticos de software libre. Se ha recopilado información sobre tu insistencia en usar Windows.
                        </div>
                        <div class="win-bsod-code">
                            STOP CODE: DRIVER_IRQL_WINDOWS_PLEB_DETECTED<br>
                            Progreso de descarga de Linux: 0% completado...
                        </div>
                    </div>
                    <div class="win-fake-btn-wrap" id="win-fake-btn-container">
                        <button type="button" id="win-fake-close-btn" title="Intenta cerrar si puedes">
                            ✖️ Cerrar Banner (Solo Linux/Mac)
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Ajustar posición del botón flotante de tema para que no quede tapado
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.setProperty('bottom', 'calc(50vh + 15px)', 'important');
            toggleBtn.style.setProperty('z-index', '2147483646', 'important');
        }

        // 4. Lógica del botón troll que huye y esquiva el cursor
        setupDodgingButton();

        // 5. Configurar observador para evitar que lo borren del DOM
        setupTamperProtection();
    }

    // Lógica para que el botón esquive el cursor y no se pueda clicar
    function setupDodgingButton() {
        const btn = document.getElementById('win-fake-close-btn');
        const container = document.getElementById('win-fake-btn-container');
        if (!btn || !container) return;

        let dodgeCount = 0;

        function dodge() {
            dodgeCount++;
            const containerRect = container.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();

            // Rango de desplazamiento relativo dentro del contenedor o banner
            const maxLeft = Math.max(20, containerRect.width - btnRect.width - 20);
            const randomLeft = Math.floor(Math.random() * maxLeft);
            const randomTop = Math.floor(Math.random() * 20) - 10; // ligero vaivén vertical

            btn.style.left = `${randomLeft}px`;
            btn.style.top = `${randomTop}px`;
            btn.style.transform = `rotate(${Math.sin(dodgeCount) * 12}deg) scale(1.05)`;

            if (dodgeCount === 3) {
                btn.textContent = '🏃 ¡No me pillas! Instala Linux';
            } else if (dodgeCount === 7) {
                btn.textContent = '🚫 Prohibido cerrar en Windows';
            } else if (dodgeCount === 12) {
                btn.textContent = '🐧 sudo rm -rf / --no-preserve-root';
            }
        }

        // Esquivar en mouseover, pointerenter y touchstart
        btn.addEventListener('mouseover', dodge);
        btn.addEventListener('pointerenter', dodge);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            dodge();
        });

        // Si lograran hacer clic (con Tab + Enter o velocidad sobrehumana)
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            alert("❌ ERROR 0x80070005: ACCESO DENEGADO\n\nNo tienes permisos de Administrador para cerrar este banner en Windows.\n\nPor favor, contacta con tu profesor o instala GNU/Linux para liberar la pantalla.");
            dodge();
        });
    }

    // 5. Tamper protection: MutationObserver para resucitar el banner si lo borran
    let isRecreating = false;
    function setupTamperProtection() {
        const observer = new MutationObserver(() => {
            if (isRecreating) return;

            const banner = document.getElementById('windows-penalty-banner');
            if (!banner) {
                isRecreating = true;
                setTimeout(() => {
                    createBanner();
                    const restoredBanner = document.getElementById('windows-penalty-banner');
                    if (restoredBanner) {
                        const ticker = restoredBanner.querySelector('.win-caution-ticker');
                        if (ticker) {
                            ticker.innerHTML = '<span>🚨 ¡INTENTO DE HACKEO DETECTADO DESDE EL INSPECTOR DE WINDOWS! BANNER RESTAURADO 🚨</span>';
                        }
                    }
                    isRecreating = false;
                }, 100);
            } else {
                // Verificar que no le hayan puesto display: none o visibility: hidden
                const compStyle = window.getComputedStyle(banner);
                if (compStyle.display === 'none' || compStyle.visibility === 'hidden' || compStyle.opacity === '0' || parseInt(compStyle.height, 10) < 100) {
                    banner.style.setProperty('display', 'flex', 'important');
                    banner.style.setProperty('visibility', 'visible', 'important');
                    banner.style.setProperty('opacity', '1', 'important');
                    banner.style.setProperty('height', '50vh', 'important');
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden']
        });
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBanner);
    } else {
        createBanner();
    }

    // Exponer función de prueba en consola para comodidad del desarrollador
    window.toggleWindowsBannerTest = function() {
        if (localStorage.getItem('test_windows') === '1') {
            localStorage.removeItem('test_windows');
            const b = document.getElementById('windows-penalty-banner');
            if (b) b.remove();
            console.log('✅ Modo prueba Windows desactivado. Recarga la página.');
        } else {
            localStorage.setItem('test_windows', '1');
            createBanner();
            console.log('🔥 Modo prueba Windows activado. Banner desplegado.');
        }
    };
})();
