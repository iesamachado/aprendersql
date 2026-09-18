import { initTaskPage } from './auth.js';

let user, userDoc, db, fb;

initTaskPage().then(res => {
  user = res.user; userDoc = res.userDoc; db = res.db; fb = res.fb;
  loadTeoria();
}).catch(console.error);

function loadTeoria() {
  const params = new URLSearchParams(window.location.search);
  const claseId = params.get('claseId');
  const bloqueId = parseInt(params.get('bloqueId'));
  
  // Allow teachers/admins to preview theory without a specific class
  if (!claseId && !(userDoc && ['admin', 'docente'].includes(userDoc.rol))) { 
      window.location.href = 'clases.html'; 
      return; 
  }
  
  const btnVolver = document.getElementById('btn-volver-tandas');
  btnVolver.onclick = () => {
    if (userDoc && ['admin', 'docente'].includes(userDoc.rol)) {
      if (claseId) {
          window.location.href = `../admin/clase.html?id=${claseId}`;
      } else {
          window.location.href = `../admin/roadmap.html`;
      }
    } else {
      window.location.href = `tandas.html?claseId=${claseId}`;
    }
  };
  
  const bloqueData = window.BLOQUES?.find(b => b.id === bloqueId);
  if (!bloqueData) {
    document.getElementById('teoria-wrapper').innerHTML = '<div class="alert alert-danger">Bloque no encontrado.</div>';
    return;
  }
  
  document.getElementById('header-bloque-nombre').textContent = 'Teoría: ' + bloqueData.nombre;
  
  // Fetch the HTML file for the block
  const url = `teoria/tema${bloqueId}.html?v=${new Date().getTime()}`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('No hay contenido teórico disponible aún para este bloque.');
      }
      return response.text();
    })
    .then(htmlContent => {
      document.getElementById('teoria-wrapper').innerHTML = htmlContent;
      if (typeof window.initInteractiveTheory === 'function') {
        window.initInteractiveTheory();
      }
      if (window.mermaid) {
        window.mermaid.run().catch(e => console.error("Mermaid error:", e));
      }
    })
    .catch(error => {
      document.getElementById('teoria-wrapper').innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-tools me-2"></i> ${error.message}
        </div>
      `;
    });
}


window.imprimirTema = function() {
  window.print();
};

// ── MODO PRESENTACION ──────────────────────────────────────────
let presentationMode = false;
let slides = [];
let currentSlideIndex = 0;

window.togglePresentation = function() {
    const overlay = document.getElementById('presentation-overlay');
    
    if (presentationMode) {
        // Cerrar
        presentationMode = false;
        overlay.style.display = 'none';
        document.body.classList.remove('presentation-active');
        document.getElementById('presentation-content').innerHTML = '';
        slides = [];
    } else {
        // Abrir
        presentationMode = true;
        overlay.style.display = 'flex';
        document.body.classList.add('presentation-active');
        
        buildSlides();
        currentSlideIndex = 0;
        showSlide(currentSlideIndex);
    }
};

function buildSlides() {
    slides = [];
    const container = document.getElementById('teoria-content');
    if (!container) return;
    
    let currentSlide = document.createElement('div');
    currentSlide.className = 'presentation-slide';
    
    // Clonamos cada nodo de nivel superior
    Array.from(container.children).forEach(child => {
        // Ignorar modales para no duplicarlos en DOM
        if (child.classList && child.classList.contains('modal')) return;
        
        if (child.tagName.toLowerCase() === 'h2') {
            // Guardar la diapositiva anterior si tiene contenido
            if (currentSlide.innerHTML.trim() !== '') {
                slides.push(currentSlide);
            }
            // Iniciar nueva diapositiva
            currentSlide = document.createElement('div');
            currentSlide.className = 'presentation-slide';
        }
        
        // Clonar nodo con eventos no se puede facil, pero como es teoria pura html, cloneNode vale
        currentSlide.appendChild(child.cloneNode(true));
    });
    
    // Meter la ultima diapositiva
    if (currentSlide.innerHTML.trim() !== '') {
        slides.push(currentSlide);
    }
}

function showSlide(index) {
    const content = document.getElementById('presentation-content');
    const counter = document.getElementById('presentation-counter');
    
    content.innerHTML = '';
    
    if (slides[index]) {
        content.appendChild(slides[index]);
    }
    
    counter.textContent = `${index + 1} / ${slides.length}`;
    
    // Scrollear arriba
    content.scrollTop = 0;
}

window.nextSlide = function() {
    if (currentSlideIndex < slides.length - 1) {
        currentSlideIndex++;
        showSlide(currentSlideIndex);
    }
};

window.prevSlide = function() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        showSlide(currentSlideIndex);
    }
};

// Controles de teclado
document.addEventListener('keydown', (e) => {
    if (!presentationMode) return;
    
    if (e.key === 'ArrowRight' || e.code === 'Space') {
        window.nextSlide();
    } else if (e.key === 'ArrowLeft') {
        window.prevSlide();
    } else if (e.key === 'Escape') {
        window.togglePresentation();
    }
});
