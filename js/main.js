document.addEventListener('DOMContentLoaded', function () {
    // Sidebar Toggle
    var el = document.getElementById("wrapper");
    var toggleButton = document.getElementById("menu-toggle");
    var closeButton = document.getElementById("menu-close");
    var overlay = document.getElementById("sidebar-overlay");

    function toggleMenu() {
        el.classList.toggle("sb-sidenav-toggled");
        document.body.classList.toggle("sb-sidenav-toggled");

        // Handle Overlay on Mobile
        if (document.body.classList.contains("sb-sidenav-toggled") && window.innerWidth < 768) {
            overlay.classList.remove("d-none");
        } else {
            overlay.classList.add("d-none");
        }
    }

    toggleButton.onclick = toggleMenu;

    if (closeButton) {
        closeButton.onclick = function () {
            toggleMenu(); // Closes it because it's open
        };
    }

    if (overlay) {
        overlay.onclick = function () {
            toggleMenu(); // Click outside to close
        };
    }

    console.log("SQL Learning App Initialized 🚀");

    // --- INTERACTIVE GROUP BY DEMO ---
    if (document.getElementById('groupby-interactive-demo')) {
        initGroupByDemo();
    }
});

const rawData = [
    { id: 1, player: 'LeBron James', team: 'Lakers', points: 30 },
    { id: 2, player: 'Anthony Davis', team: 'Lakers', points: 25 },
    { id: 3, player: 'Stephen Curry', team: 'Warriors', points: 35 },
    { id: 4, player: 'Klay Thompson', team: 'Warriors', points: 20 },
    { id: 5, player: 'Draymond Green', team: 'Warriors', points: 10 },
    { id: 6, player: 'Jayson Tatum', team: 'Celtics', points: 32 },
];

let isGrouped = false;

function initGroupByDemo() {
    renderTable(rawData);
}

function renderTable(data) {
    const thead = document.getElementById('demo-header-row');
    const tbody = document.getElementById('demo-body-row');

    // Setup Header
    if (!isGrouped) {
        thead.innerHTML = `
            <th>Player <small class="text-muted">(Campo Individual)</small></th>
            <th style="cursor: pointer;" class="bg-primary bg-opacity-25" onclick="groupByTeam()">
                Team <i class="fas fa-filter ms-1"></i> <small class="d-block text-warning" style="font-size:0.7em">(Click para Agrupar)</small>
            </th>
            <th>Points <small class="text-muted">(Numérico)</small></th>
        `;
    } else {
        thead.innerHTML = `
            <th class="text-muted text-decoration-line-through">Player (Invalid)</th>
            <th class="bg-primary text-white">Team (GROUP BY)</th>
            <th id="points-header">Points (Aggregate?)</th>
        `;
    }

    // Setup Body
    tbody.innerHTML = '';

    if (!isGrouped) {
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.player}</td>
                <td class="text-info font-monospace">${row.team}</td>
                <td>${row.points}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        // Render Grouped Placeholders
        const teams = [...new Set(rawData.map(d => d.team))];
        teams.forEach(team => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-muted text-center bg-secondary bg-opacity-10">
                    <i class="fas fa-times text-danger"></i> <span style="filter: blur(2px);">LeBron...</span>
                </td>
                <td class="align-middle fw-bold text-info border-primary border-2">${team}</td>
                <td class="text-center align-middle" data-team="${team}">
                    <span class="badge bg-warning text-dark"><i class="fas fa-question"></i> Select Func</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function groupByTeam() {
    if (isGrouped) return;

    const table = document.getElementById('demo-table');
    table.classList.add('animate-collapse'); // Add CSS animation class if defined

    setTimeout(() => {
        isGrouped = true;
        renderTable();
        document.getElementById('aggregation-controls').classList.remove('d-none');

        const explanation = document.getElementById('demo-explanation');
        explanation.classList.remove('d-none');
        explanation.innerHTML = `
            <h6 class="text-white"><i class="fas fa-exclamation-triangle text-warning"></i> ¿Por qué desaparecieron los jugadores?</h6>
            <p class="mb-0 text-light small">
                Al agrupar por <strong>TEAM</strong>, la base de datos "aplasta" (colapsa) todas las filas de los 'Lakers' en una sola. 
                <br>
                SQL no sabe qué Jugador mostrar (¿LeBron o Davis?), así que ese campo se vuelve <strong>inválido</strong>.
                <br>
                Solo podemos preguntar cosas sobre el grupo entero, usando <strong>Funciones de Agregado</strong>.
            </p>
        `;
    }, 300); // Small delay for visual effect
}

window.groupByTeam = groupByTeam; // Expose to global scope
window.applyAggregation = applyAggregation;
window.resetGroupByDemo = resetGroupByDemo;

function applyAggregation(type) {
    const teams = [...new Set(rawData.map(d => d.team))];

    // Update Header
    document.getElementById('points-header').innerHTML = `Points (${type})`;
    document.getElementById('points-header').classList.add('text-success');

    teams.forEach(team => {
        // Find rows for this team
        const teamRows = rawData.filter(r => r.team === team);
        const points = teamRows.map(r => r.points);

        let result = 0;
        let explanation = "";

        if (type === 'SUM') {
            result = points.reduce((a, b) => a + b, 0);
            explanation = `SUM(${points.join('+')})`;
        } else if (type === 'AVG') {
            result = (points.reduce((a, b) => a + b, 0) / points.length).toFixed(1);
            explanation = `AVG(${points.join(',')})`;
        } else if (type === 'MAX') {
            result = Math.max(...points);
            explanation = `MAX(${points.join(',')})`;
        }

        // Update Cell
        const cell = document.querySelector(`td[data-team="${team}"]`);
        if (cell) {
            cell.innerHTML = `
                <div class="d-flex flex-column align-items-center animate-pop">
                    <span class="fs-5 fw-bold text-success">${result}</span>
                    <small class="text-muted" style="font-size: 0.7em">${explanation}</small>
                </div>
            `;
        }
    });

    const explanation = document.getElementById('demo-explanation');
    explanation.innerHTML = `
        <h6 class="text-white"><i class="fas fa-check-circle text-success"></i> ¡Correcto! Función ${type} aplicada.</h6>
        <p class="mb-0 text-light small">
            Ahora estamo viendo un solo valor resumen para cada grupo. 
            Por ejemplo, para <strong>Warriors</strong>, ${type} es ${type === 'SUM' ? '65' : '...'}.
            <br>
            Así es como funciona <code>SELECT Team, ${type}(Points) FROM Tabla GROUP BY Team</code>.
        </p>
    `;
}

function resetGroupByDemo() {
    isGrouped = false;
    document.getElementById('aggregation-controls').classList.add('d-none');
    document.getElementById('demo-explanation').classList.add('d-none');
    renderTable(rawData);
}

/* --- JOIN ANIMATION LOGIC --- */
const joinDataA = [
    { id: 101, name: 'Ana', email: 'ana@gmail.com' },
    { id: 102, name: 'Bob', email: 'bob@yahoo.com' },
    { id: 103, name: 'Dan', email: 'dan@outlook.com' },
    { id: 105, name: 'Eva', email: 'eva@live.com' }
];

const joinDataB = [
    { order: 'Ord-1', client_id: 101, item: 'Pizza', cost: '$12' },
    { order: 'Ord-2', client_id: 103, item: 'Sushi', cost: '$25' },
    { order: 'Ord-3', client_id: 101, item: 'Burger', cost: '$10' },
    { order: 'Ord-4', client_id: 104, item: 'Taco', cost: '$8' }
];

let isAnimatingJoin = false;

function initJoinAnimation() {
    renderJoinTables();
}

function renderJoinTables() {
    const containerA = document.getElementById('table-a-rows');
    const containerB = document.getElementById('table-b-rows');
    const containerRes = document.getElementById('join-result-rows');

    // Clear
    containerA.innerHTML = '';
    containerB.innerHTML = '';
    containerRes.innerHTML = '';
    const resTitle = document.getElementById('result-title');
    if (resTitle) resTitle.classList.add('opacity-0');

    // Render A (Clients)
    joinDataA.forEach(row => {
        const div = document.createElement('div');
        div.className = 'join-row';
        div.id = `row-a-${row.id}`;
        // Added Email
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span><span class="join-row-badge badge-a">ID: ${row.id}</span> <strong>${row.name}</strong></span>
                <small class="text-muted ms-2 d-none d-md-inline">${row.email}</small>
            </div>`;
        containerA.appendChild(div);
    });

    // Render B (Orders)
    joinDataB.forEach((row, index) => {
        const div = document.createElement('div');
        div.className = 'join-row';
        div.id = `row-b-${index}`;
        div.setAttribute('data-client-id', row.client_id);
        // Added Order ID and Cost
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span><strong class="text-warning">${row.order}</strong> <small>(${row.item})</small></span>
                <span class="join-row-badge badge-b ms-2">FK: ${row.client_id}</span>
                <small class="text-success ms-1 d-none d-md-inline">${row.cost}</small>
            </div>`;
        containerB.appendChild(div);
    });
}

async function startJoinAnimation() {
    if (isAnimatingJoin) return;
    isAnimatingJoin = true;

    // Reset view
    renderJoinTables();
    document.getElementById('result-title').classList.remove('opacity-0');

    const explanation = document.getElementById('join-explanation');

    // Iterate through Table B (Orders) to find matches in A (Clients)
    const rowsB = Array.from(document.querySelectorAll('#table-b-rows .join-row'));

    for (const rowB of rowsB) {
        const fk = rowB.getAttribute('data-client-id');
        const rowIdA = `row-a-${fk}`;
        const rowA = document.getElementById(rowIdA);

        // Highlight B
        rowB.classList.add('active');
        explanation.innerText = `Buscando cliente con ID ${fk} para pedido ${rowB.innerText.split(' ')[0]}...`;

        await wait(600);

        if (rowA) {
            // Match Found!
            rowA.classList.add('active');
            explanation.innerText = `¡Match encontrado! Cliente ${fk} existe en la Tabla A.`;

            // Create "Ghost" elements moving to center
            await animateMatch(rowA, rowB);

            rowA.classList.remove('active');
            rowA.classList.add('matched');
            rowB.classList.add('matched');

        } else {
            // No Match
            explanation.innerText = `No se encontró cliente con ID ${fk}. Ignorando este pedido.`;
            rowB.classList.add('faded');
            await wait(800);
        }

        rowB.classList.remove('active');
        await wait(300);
    }

    explanation.innerText = "Proceso completo. Solo se muestran las filas con coincidencia.";
    isAnimatingJoin = false;
}

function animateMatch(elA, elB) {
    return new Promise(resolve => {
        const cloneA = elA.cloneNode(true);
        const cloneB = elB.cloneNode(true);

        positionClone(elA, cloneA);
        positionClone(elB, cloneB);

        document.getElementById('join-animation-container').appendChild(cloneA);
        document.getElementById('join-animation-container').appendChild(cloneB);

        cloneA.classList.add('anim-move-right');
        cloneB.classList.add('anim-move-left');

        setTimeout(() => {
            const containerRes = document.getElementById('join-result-rows');
            const resDiv = document.createElement('div');
            resDiv.className = 'result-row';

            // Extract text for result
            const name = elA.querySelector('strong').innerText;
            const email = elA.querySelector('small.text-muted').innerText;
            const order = elB.querySelector('strong').innerText;
            const item = elB.querySelector('small').innerText.replace(/[()]/g, '');
            const cost = elB.querySelector('small.text-success').innerText;

            // Combined Row visual
            resDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center small" style="font-size: 0.8em">
                     <span class="text-info fw-bold">${name}</span>
                     <span class="text-muted d-none d-lg-inline">${email}</span>
                     <i class="fas fa-link text-secondary mx-1"></i>
                     <span class="text-warning fw-bold">${order}</span>
                     <span class="text-light">${item}</span>
                     <span class="text-success fw-bold">${cost}</span>
                </div>
            `;

            containerRes.appendChild(resDiv);

            cloneA.remove();
            cloneB.remove();
            resolve();
        }, 800);
    });
}

function positionClone(original, clone) {
    const rect = original.getBoundingClientRect();
    const containerRect = document.getElementById('join-animation-container').getBoundingClientRect();

    clone.style.position = 'absolute';
    clone.style.top = (rect.top - containerRect.top) + 'px';
    clone.style.left = (rect.left - containerRect.left) + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.zIndex = '100';
    clone.style.margin = '0';
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Auto Init if present
if (document.getElementById('join-animation-container')) {
    initJoinAnimation();
}

/* --- AMBIGUOUS COLUMN ANIMATION --- */
function startAmbiguousAnimation() {
    // Reset State
    const tableA = document.getElementById('ambiguous-table-a');
    const tableB = document.getElementById('ambiguous-table-b');
    const icon = document.getElementById('ambiguous-error-icon');
    const overlay = document.getElementById('ambiguous-overlay');
    const explanation = document.getElementById('ambiguous-explanation');
    const queryDisplay = document.getElementById('ambiguous-query-display');
    const arrow = tableA.querySelector('.glitch-arrow');

    // Initial State
    icon.className = "fas fa-question-circle text-warning opacity-100";
    explanation.innerText = "Buscando 'id'... ¿De cuál tabla?";
    tableA.classList.add('border-danger', 'animate-shake');
    tableB.classList.add('border-danger', 'animate-shake');

    // Highlight 'id' columns
    document.querySelectorAll('.column-id').forEach(el => el.classList.add('bg-danger', 'text-white'));

    setTimeout(() => {
        // Show Error Overlay
        overlay.classList.remove('d-none');
        overlay.classList.add('animate-pop');
        explanation.innerText = "¡ERROR! SQL detiene la ejecución porque no sabe qué 'id' elegir.";
        icon.className = "fas fa-exclamation-triangle text-danger opacity-100";
        tableA.classList.remove('animate-shake');
        tableB.classList.remove('animate-shake');
    }, 1000);
}

function fixAmbiguousError() {
    const overlay = document.getElementById('ambiguous-overlay');
    const queryDisplay = document.getElementById('ambiguous-query-display');
    const explanation = document.getElementById('ambiguous-explanation');
    const tableA = document.getElementById('ambiguous-table-a');
    const tableB = document.getElementById('ambiguous-table-b');

    // Hide Error
    overlay.classList.add('d-none');

    // Update Query to show Fix
    queryDisplay.innerHTML = `SELECT <span class="text-success fw-bold">Clientes.id</span>, nombre, item FROM Clientes JOIN Pedidos...`;
    queryDisplay.classList.remove('text-danger', 'border-danger');
    queryDisplay.classList.add('text-success', 'border-success');

    // Visual Fix
    explanation.innerHTML = "<span class='text-success fw-bold'>¡Solucionado!</span> Ahora especificamos la tabla (Clientes.id).";

    // Update Tables visual
    document.querySelectorAll('.column-id').forEach(el => el.classList.remove('bg-danger', 'text-white'));
    tableA.classList.remove('border-danger');
    tableB.classList.remove('border-danger');

    tableA.classList.add('border-success');

    // Highlight correct column
    const idA = tableA.querySelector('.column-id');
    idA.classList.add('bg-success', 'text-white', 'me-2');
    idA.innerText = "Clientes.id";

    // Success Icon
    const icon = document.getElementById('ambiguous-error-icon');
    icon.className = "fas fa-check-circle text-success opacity-100 animate-pop";
}

/* --- UTILS --- */
document.head.insertAdjacentHTML("beforeend", `<style>
    .animate-shake { animation: shake 0.5s; }
    @keyframes shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-5px); }
        100% { transform: translateX(0); }
    }
</style>`);

/* --- SUM vs COUNT ANIMATION --- */
const curryStats = [
    { id: 1, game: 'vs LAL', points: 30 },
    { id: 2, game: 'vs BOS', points: 25 },
    { id: 3, game: 'vs MIA', points: 40 },
    { id: 4, game: 'vs CHI', points: 15 } // Bad night
];

function initSumCountDemo() {
    const container = document.getElementById('sc-rows');
    if (!container) return;

    container.innerHTML = '';
    curryStats.forEach(match => {
        container.innerHTML += `
            <div class="sc-row bg-secondary bg-opacity-10 p-2 rounded d-flex justify-content-between align-items-center" id="sc-row-${match.id}" style="width: 200px;">
                <span class="text-muted small">${match.game}</span>
                <span class="text-warning fw-bold sc-points">${match.points}</span>
            </div>
        `;
    });
}

async function startCurryAnimation(type) {
    // Reset
    initSumCountDemo();
    const resultDisplay = document.getElementById('sc-result');
    const feedback = document.getElementById('sc-feedback');
    const highlight = document.getElementById('sc-highlight');
    const funcName = document.getElementById('sc-func-name');

    resultDisplay.innerText = "0";
    resultDisplay.className = "display-4 fw-bold text-white"; // Reset color
    feedback.innerText = `Ejecutando ${type}(Puntos)...`;
    feedback.className = "small mt-2 text-warning";
    funcName.innerText = type;

    // Animation variables
    let total = 0;
    const rows = document.querySelectorAll('.sc-row');
    const tableRect = document.getElementById('sc-table').getBoundingClientRect();
    const containerRect = document.getElementById('sum-count-animation-container').getBoundingClientRect();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pointsEl = row.querySelector('.sc-points');
        const points = parseInt(pointsEl.innerText);

        // Highlight Row
        row.style.background = "#333";
        row.style.border = "1px solid white";

        // Specific Highlight based on Type
        if (type === 'COUNT') {
            // Highlight the ROW itself (counting records)
            highlight.className = "position-absolute bg-danger bg-opacity-25 border border-danger";
            moveHighlight(highlight, row, containerRect);
            total += 1; // It counts 1 per row
            feedback.innerText = "¡Contando la fila! (+1)";
        } else {
            // SUM: Highlight the VALUE (adding points)
            highlight.className = "position-absolute bg-success bg-opacity-25 border border-success";
            moveHighlight(highlight, pointsEl, containerRect); // Focus on the number
            feedback.innerText = `Sumando valor: +${points}.`;
            total += points;
        }

        highlight.classList.remove('d-none');
        resultDisplay.innerText = total; // Live update

        await wait(600);

        // Reset Row style
        row.style.background = "";
        row.style.border = "";
    }

    highlight.classList.add('d-none');

    // Final Feedback
    if (type === 'COUNT') {
        resultDisplay.className = "display-4 fw-bold text-danger";
        feedback.innerHTML = "<i class='fas fa-times-circle text-danger'></i> <strong>¡Incorrecto!</strong> <br>COUNT cuenta los PARTIDOS (las filas), no los puntos.";
    } else {
        resultDisplay.className = "display-4 fw-bold text-success";
        feedback.innerHTML = "<i class='fas fa-check-circle text-success'></i> <strong>¡Correcto!</strong> <br>SUM suma los valores de la columna.";
    }
}

function moveHighlight(el, target, containerRect) {
    const rect = target.getBoundingClientRect();
    el.style.top = (rect.top - containerRect.top) + 'px';
    el.style.left = (rect.left - containerRect.left) + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
}

// Auto Init
if (document.getElementById('sum-count-animation-container')) {
    initSumCountDemo();
}

/* --- LIMIT & PAGINATION ANIMATION --- */
const limitData = [
    { id: 1, title: 'Post Uno', author: 'Ana' },
    { id: 2, title: 'Post Dos', author: 'Bob' },
    { id: 3, title: 'Post Tres', author: 'Dan' },
    { id: 4, title: 'Post Cuatro', author: 'Eva' },
    { id: 5, title: 'Post Cinco', author: 'Fay' },
    { id: 6, title: 'Post Seis', author: 'Gil' },
    { id: 7, title: 'Post Siete', author: 'Hu' },
    { id: 8, title: 'Post Ocho', author: 'Ivy' },
    { id: 9, title: 'Post Nueve', author: 'Joe' },
    { id: 10, title: 'Post Diez', author: 'Ken' }
];

let currentPage = 1;
let currentLimit = 3;

function initLimitDemo() {
    renderLimitSource();
    updateLimitSimulation();
}

function renderLimitSource() {
    const container = document.getElementById('limit-source-rows');
    if (!container) return;

    container.innerHTML = '';
    limitData.forEach(post => {
        container.innerHTML += `
            <div class="limit-row bg-secondary bg-opacity-10 p-1 px-2 rounded d-flex justify-content-between align-items-center w-100" id="src-post-${post.id}">
                <span class="text-white small">ID: ${post.id}</span>
                <span class="text-muted small">${post.title}</span>
            </div>
        `;
    });
}

function updateLimitSimulation() {
    // Get values
    const limitSelect = document.getElementById('limit-select');
    currentLimit = parseInt(limitSelect.value);
    const offset = (currentPage - 1) * currentLimit;

    // Bounds check
    const maxPage = Math.ceil(limitData.length / currentLimit);
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;

    const realOffset = (currentPage - 1) * currentLimit;

    // Update UI Text
    document.getElementById('page-indicator').innerText = `Página ${currentPage}`;
    document.getElementById('offset-explanation').innerText = `OFFSET ${realOffset} (Saltar ${realOffset})`;

    // Update Query Text
    const queryEl = document.getElementById('limit-query-text');
    if (realOffset === 0) {
        queryEl.innerText = `LIMIT ${currentLimit}`;
    } else {
        queryEl.innerText = `LIMIT ${currentLimit} OFFSET ${realOffset}`;
    }

    // Visual Logic: Highlight Source & Fill Result
    const allSourceRows = document.querySelectorAll('.limit-row');
    const resultContainer = document.getElementById('limit-result-view');
    resultContainer.innerHTML = '';

    allSourceRows.forEach((row, index) => {
        // Reset styles
        row.classList.remove('bg-primary', 'bg-opacity-50', 'border', 'border-primary');
        row.style.opacity = '0.3'; // Fade out by default

        // Check if in range
        if (index >= realOffset && index < (realOffset + currentLimit)) {
            // Is visible!
            row.style.opacity = '1';
            row.classList.add('bg-primary', 'bg-opacity-25', 'border', 'border-primary');

            // Clone to Result
            const clone = row.cloneNode(true);
            clone.classList.remove('bg-opacity-10'); // Make it pop more in result
            clone.classList.add('animate-fade-in');
            resultContainer.appendChild(clone);
        }
    });

    if (resultContainer.innerHTML === '') {
        resultContainer.innerHTML = '<div class="text-muted text-center pt-5">No hay más resultados.</div>';
    }
}

function nextPage() {
    const maxPage = Math.ceil(limitData.length / currentLimit);
    if (currentPage < maxPage) {
        currentPage++;
        updateLimitSimulation();
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateLimitSimulation();
    }
}

// Auto Init
if (document.getElementById('limit-animation-container')) {
    initLimitDemo();
}

/* --- DATA MANIPULATION SIMULATIONS --- */

// String Machine
function runStrFunc(func) {
    const input = "LeBron James";
    const outputEl = document.getElementById('str-output');
    const queryEl = document.getElementById('str-query-display');
    let result = "";

    outputEl.classList.remove('animate-pop');
    void outputEl.offsetWidth; // trigger reflow

    switch (func) {
        case 'UPPER':
            result = input.toUpperCase();
            queryEl.innerHTML = "SELECT <span class='text-info'>UPPER(nombre)</span> FROM Jugadores;";
            break;
        case 'LOWER':
            result = input.toLowerCase();
            queryEl.innerHTML = "SELECT <span class='text-info'>LOWER(nombre)</span> FROM Jugadores;";
            break;
        case 'LENGTH':
            result = input.length;
            queryEl.innerHTML = "SELECT <span class='text-info'>LENGTH(nombre)</span> FROM Jugadores;";
            break;
        case 'REVERSE':
            result = input.split('').reverse().join('');
            queryEl.innerHTML = "SELECT <span class='text-info'>REVERSE(nombre)</span> FROM Jugadores;";
            break;
    }

    outputEl.innerText = result;
    outputEl.classList.add('animate-pop');
}

function resetStrFunc() {
    document.getElementById('str-output').innerText = "LeBron James";
    document.getElementById('str-query-display').innerText = "SELECT nombre FROM Jugadores;";
}

// Number Machine
function runNumFunc(func) {
    const input = 15.6789;
    const outputEl = document.getElementById('num-output');
    const queryEl = document.getElementById('num-query-display');
    let result = "";

    outputEl.classList.remove('animate-pop');
    void outputEl.offsetWidth; // trigger reflow

    switch (func) {
        case 'ROUND':
            result = input.toFixed(2);
            queryEl.innerHTML = "SELECT <span class='text-success'>ROUND(precio, 2)</span> FROM Productos;";
            break;
        case 'FLOOR':
            result = Math.floor(input);
            queryEl.innerHTML = "SELECT <span class='text-success'>FLOOR(precio)</span> FROM Productos;";
            break;
        case 'CEIL':
            result = Math.ceil(input);
            queryEl.innerHTML = "SELECT <span class='text-success'>CEIL(precio)</span> FROM Productos;";
            break;
        case 'MOD':
            result = input % 2; // Remainder
            result = result.toFixed(4);
            queryEl.innerHTML = "SELECT <span class='text-success'>MOD(precio, 2)</span> FROM Productos;";
            break;
    }

    outputEl.innerText = result;
    outputEl.classList.add('animate-pop');
}

function resetNumFunc() {
    document.getElementById('num-output').innerText = "15.6789";
    document.getElementById('num-query-display').innerText = "SELECT precio FROM Productos;";
}

/* --- POLYMORPHIC SIMULATION (PLUS vs CONCAT) --- */
let polyMode = 'NUM'; // NUM or TXT

function setPolyMode(mode) {
    polyMode = mode;

    // UI Toggles
    document.getElementById('sim-mode-num').classList.toggle('active', mode === 'NUM');
    document.getElementById('sim-mode-txt').classList.toggle('active', mode === 'TXT');

    const valA = document.getElementById('poly-val-a');
    const valB = document.getElementById('poly-val-b');
    const result = document.getElementById('poly-result');
    const badge = document.getElementById('poly-badge');
    const query = document.getElementById('poly-query');
    const explanation = document.getElementById('poly-explanation');
    const txtControls = document.getElementById('poly-txt-controls');
    const operator = document.getElementById('poly-operator');

    if (mode === 'NUM') {
        valA.innerText = "100";
        valB.innerText = "50";
        result.innerText = "150";
        result.className = "bg-black border border-secondary rounded p-3 fs-4 font-monospace fw-bold text-success";

        badge.innerText = "Matemática";
        badge.className = "position-absolute top-100 start-50 translate-middle-x badge bg-success mt-2";

        query.innerHTML = "SELECT col_a <span class='text-warning'>+</span> col_b ...";
        explanation.innerText = "MariaDB suma los valores matemáticamente.";

        txtControls.classList.add('d-none');
        operator.innerText = "+";
        operator.className = "display-6 text-warning";
    } else {
        // TEXT MODE (Initial State: The Trap)
        valA.innerText = "'Hola'";
        valB.innerText = "'Mundo'";

        // In MariaDB 'String' + 'String' = 0 (usually)
        result.innerText = "0";
        result.className = "bg-black border border-secondary rounded p-3 fs-4 font-monospace fw-bold text-danger animate-shake";

        badge.innerText = "¡Error Lógico!";
        badge.className = "position-absolute top-100 start-50 translate-middle-x badge bg-danger mt-2";

        query.innerHTML = "SELECT col_a <span class='text-danger'>+</span> col_b ...";
        explanation.innerHTML = "<span class='text-danger'>¡Cuidado!</span> El operador + en MariaDB <strong>NO concatena</strong> texto. Intenta sumar matemáticamente y falla (da 0).";

        txtControls.classList.remove('d-none');
        operator.innerText = "+";
        operator.className = "display-6 text-danger";
    }
}

function useConcatFunction() {
    const result = document.getElementById('poly-result');
    const badge = document.getElementById('poly-badge');
    const query = document.getElementById('poly-query');
    const explanation = document.getElementById('poly-explanation');
    const operator = document.getElementById('poly-operator');

    // Show Correct Result
    result.innerText = "'HolaMundo'";
    result.className = "bg-black border border-secondary rounded p-3 fs-4 font-monospace fw-bold text-info animate-pop";

    badge.innerText = "Concatenación";
    badge.className = "position-absolute top-100 start-50 translate-middle-x badge bg-info mt-2";

    query.innerHTML = "SELECT <span class='text-info'>CONCAT(col_a, col_b)</span> ...";
    explanation.innerHTML = "¡Correcto! Para unir texto en SQL estándar/MariaDB usamos la función <strong>CONCAT()</strong>.";

    // Hide + operator visually or change it to imply transformation
    operator.innerText = ",";
    operator.className = "display-6 text-muted";
}

/* --- UPDATED TEXT FUNCTIONS AND DATE FUNCTIONS --- */

// Extended String Machine (Fixing logic inline if necessary or extending)
// We need to override the previous runStrFunc to include new cases
// But since JS allows re-definition, we can just replace it or ensure we handle all cases.
// Better approach: Since I appended previous one, I should rewrite it fully to include new cases.

function runStrFunc(func) {
    const input = "LeBron James";
    const outputEl = document.getElementById('str-output');
    const queryEl = document.getElementById('str-query-display');
    let result = "";

    outputEl.classList.remove('animate-pop');
    void outputEl.offsetWidth; // trigger reflow

    switch (func) {
        case 'UPPER':
            result = input.toUpperCase();
            queryEl.innerHTML = "SELECT <span class='text-info'>UPPER(nombre)</span> FROM Jugadores;";
            break;
        case 'LOWER':
            result = input.toLowerCase();
            queryEl.innerHTML = "SELECT <span class='text-info'>LOWER(nombre)</span> FROM Jugadores;";
            break;
        case 'LENGTH':
            result = input.length;
            queryEl.innerHTML = "SELECT <span class='text-info'>LENGTH(nombre)</span> FROM Jugadores;";
            break;
        case 'REVERSE':
            result = input.split('').reverse().join('');
            queryEl.innerHTML = "SELECT <span class='text-info'>REVERSE(nombre)</span> FROM Jugadores;";
            break;
        case 'LEFT':
            result = input.substring(0, 3);
            queryEl.innerHTML = "SELECT <span class='text-info'>LEFT(nombre, 3)</span> FROM Jugadores;";
            break;
        case 'RIGHT':
            result = input.substring(input.length - 3);
            queryEl.innerHTML = "SELECT <span class='text-info'>RIGHT(nombre, 3)</span> FROM Jugadores;";
            break;
        case 'SUBSTRING':
            result = input.substring(0, 3); // JS substring is (start, end), SQL SUBSTRING is (str, start, len). 
            // Correct simulation: SQL SUBSTRING('LeBron James', 1, 3) -> 'LeB'
            // JS: 'LeBron mames'.substring(0, 3) -> 'LeB'
            queryEl.innerHTML = "SELECT <span class='text-info'>SUBSTRING(nombre, 1, 3)</span> FROM Jugadores;";
            break;
        case 'REPLACE':
            result = input.replace(/e/g, 'X');
            queryEl.innerHTML = "SELECT <span class='text-info'>REPLACE(nombre, 'e', 'X')</span> FROM Jugadores;";
            break;
    }

    outputEl.innerText = result;
    outputEl.classList.add('animate-pop');
}

// Date Machine
function runDateFunc(func) {
    const inputStr = "2023-12-25 14:30:00";
    const dateObj = new Date(inputStr);
    const outputEl = document.getElementById('date-output');
    const queryEl = document.getElementById('date-query-display');
    let result = "";

    outputEl.classList.remove('animate-pop');
    void outputEl.offsetWidth; // trigger reflow

    switch (func) {
        case 'YEAR':
            result = dateObj.getFullYear();
            queryEl.innerHTML = "SELECT <span class='text-danger'>YEAR(fecha_pedido)</span> FROM Pedidos;";
            break;
        case 'MONTH':
            result = dateObj.getMonth() + 1; // JS months are 0-11
            queryEl.innerHTML = "SELECT <span class='text-danger'>MONTH(fecha_pedido)</span> FROM Pedidos;";
            break;
        case 'DAY':
            result = dateObj.getDate();
            queryEl.innerHTML = "SELECT <span class='text-danger'>DAY(fecha_pedido)</span> FROM Pedidos;";
            break;
        case 'DATE_ADD':
            // Add 1 Day
            const nextDay = new Date(dateObj);
            nextDay.setDate(dateObj.getDate() + 1);
            result = nextDay.toISOString().slice(0, 19).replace('T', ' ');
            queryEl.innerHTML = "SELECT <span class='text-danger'>DATE_ADD(fecha_pedido, INTERVAL 1 DAY)</span> ...";
            break;
        case 'NOW':
            const now = new Date();
            result = now.toISOString().slice(0, 19).replace('T', ' ');
            queryEl.innerHTML = "SELECT <span class='text-danger'>NOW()</span>;";
            break;
    }

    outputEl.innerText = result;
    outputEl.classList.add('animate-pop');
}

function resetDateFunc() {
    document.getElementById('date-output').innerText = "2023-12-25 14:30:00";
    document.getElementById('date-query-display').innerText = "SELECT fecha_pedido FROM Pedidos;";
}

/* --- SELECT & WHERE SIMULATIONS --- */

// SELECT Simulation (Projection)
function runSelectSim(mode) {
    const table = document.getElementById('select-sim-table');
    const queryEl = document.getElementById('select-query-display');
    const feedback = document.getElementById('select-feedback');

    // Reset all opacities
    table.querySelectorAll('th, td').forEach(el => {
        el.style.opacity = '1';
        el.style.backgroundColor = '';
    });

    if (mode === 'ALL') {
        queryEl.innerHTML = "SELECT * FROM Productos";
        feedback.innerText = "El asterisco (*) trae TODAS las columnas.";
    } else {
        queryEl.innerHTML = "SELECT <span class='text-info'>nombre, precio</span> FROM Productos";
        feedback.innerText = "Solo traemos las columnas solicitadas. El resto se ignoran (o no viajan).";

        // Dim irrelevant columns (id: 0, cat: 2)
        // Highlight relevant (name: 1, price: 3)
        // We can do this by index
        const rows = table.rows;
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].cells;
            // Dim ID
            cells[0].style.opacity = '0.2';
            // Dim Cat
            cells[2].style.opacity = '0.2';

            // Highlight Name & Price
            cells[1].style.backgroundColor = 'rgba(13, 202, 240, 0.1)'; // info color
            cells[3].style.backgroundColor = 'rgba(13, 202, 240, 0.1)';
        }
    }
}

// WHERE Simulation (Filtering)
function runWhereSim(mode) {
    const tableBody = document.querySelector('#where-sim-table tbody');
    const queryEl = document.getElementById('where-query-display');
    const feedback = document.getElementById('where-feedback');
    const rows = tableBody.querySelectorAll('tr');

    // Reset
    rows.forEach(row => {
        row.style.display = '';
        row.classList.remove('bg-warning', 'bg-opacity-25');
    });

    let count = 0;

    switch (mode) {
        case 'NONE':
            queryEl.innerHTML = "SELECT * FROM Productos";
            feedback.innerText = "Mostrando todos los registros.";
            count = rows.length;
            break;
        case 'PRICE':
            queryEl.innerHTML = "SELECT * FROM Productos WHERE <span class='text-warning'>precio < 3</span>";
            feedback.innerText = "Filtrando productos baratos (menos de 3.00).";
            rows.forEach(row => {
                const price = parseFloat(row.dataset.price);
                if (price < 3) {
                    row.classList.add('bg-warning', 'bg-opacity-25');
                    count++;
                } else {
                    row.style.display = 'none';
                }
            });
            break;
        case 'AND':
            queryEl.innerHTML = "SELECT * ... WHERE <span class='text-warning'>categoria='Bebida' AND precio < 2</span>";
            feedback.innerText = "AND: Deben cumplirse AMBAS condiciones (Bebida Y barato).";
            rows.forEach(row => {
                const price = parseFloat(row.dataset.price);
                const cat = row.dataset.cat;
                if (cat === 'Bebida' && price < 2) {
                    row.classList.add('bg-warning', 'bg-opacity-25');
                    count++;
                } else {
                    row.style.display = 'none';
                }
            });
            break;
        case 'OR':
            queryEl.innerHTML = "SELECT * ... WHERE <span class='text-warning'>categoria='Comida' OR precio < 2</span>";
            feedback.innerText = "OR: Solo una condición (Comida O muy barata) debe cumplirse para entrar.";
            rows.forEach(row => {
                const price = parseFloat(row.dataset.price);
                const cat = row.dataset.cat;
                if (cat === 'Comida' || price < 2) {
                    row.classList.add('bg-warning', 'bg-opacity-25');
                    count++;
                } else {
                    row.style.display = 'none';
                }
            });
            break;
    }
}

/* --- ORDER BY SIMULATION --- */
const orderByData = [
    { name: 'Café', price: 1.50 },
    { name: 'Torta', price: 3.50 },
    { name: 'Jugo', price: 2.00 },
    { name: 'Arepa', price: 5.00 }
];

function initOrderByDemo() {
    renderOrderByTable(orderByData); // Submit as is (Unordered)
}

function renderOrderByTable(data) {
    const tbody = document.querySelector('#orderby-sim-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Animate transition using View Transitions or manually
    // For simplicity, just render. The 'sort' action can trigger CSS animations on items if we had IDs.

    data.forEach(item => {
        tbody.innerHTML += `
            <tr class="animate-fade-in">
                <td>${item.name}</td>
                <td class="font-monospace text-warning">${item.price.toFixed(2)}</td>
            </tr>
        `;
    });
}

function runOrderBySim(mode) {
    const queryEl = document.getElementById('orderby-query-display');
    const feedback = document.getElementById('orderby-feedback');

    // Sort logic
    // Create a copy to sort
    let sorted = [...orderByData];

    if (mode === 'ASC') {
        sorted.sort((a, b) => a.price - b.price);
        queryEl.innerHTML = "SELECT * FROM Productos ORDER BY <span class='text-success'>precio ASC</span>";
        feedback.innerText = "Los precios van subiendo ↓ (1.50 -> 5.00)";
    } else {
        sorted.sort((a, b) => b.price - a.price);
        queryEl.innerHTML = "SELECT * FROM Productos ORDER BY <span class='text-success'>precio DESC</span>";
        feedback.innerText = "Los precios van bajando ↓ (5.00 -> 1.50)";
    }

    // Re-render
    renderOrderByTable(sorted);
}

// Auto Init
if (document.getElementById('orderby-sim-container')) {
    initOrderByDemo();
}

/* --- EXCLUSION PATTERN SIMULATION (LEFT JOIN IS NULL) --- */
const exclusionUsers = [
    { id: 1, name: 'Ana', color: 'text-info' },
    { id: 2, name: 'Bob', color: 'text-danger' }, // No match
    { id: 3, name: 'Charlie', color: 'text-success' },
    { id: 4, name: 'David', color: 'text-warning' } // No match
];

const exclusionOrders = [
    { id: 101, user_id: 1, item: 'Pizza' },
    { id: 102, user_id: 3, item: 'Sushi' },
    { id: 103, user_id: 1, item: 'Cola' }
];

function renderExclusionTables() {
    const usersContainer = document.getElementById('excl-users-rows');
    const ordersContainer = document.getElementById('excl-orders-rows');
    const resultContainer = document.getElementById('excl-result-area');

    if (!usersContainer || !ordersContainer) return;

    // Render Users
    usersContainer.innerHTML = exclusionUsers.map(u => `
        <div class="card bg-dark border-secondary p-2 w-100" id="excl-user-${u.id}">
            <div class="d-flex justify-content-between align-items-center">
                <span class="small text-muted">ID: ${u.id}</span>
                <span class="${u.color} fw-bold">${u.name}</span>
            </div>
        </div>
    `).join('');

    // Render Orders
    ordersContainer.innerHTML = exclusionOrders.map(o => `
        <div class="card bg-dark border-secondary p-2 w-100">
            <div class="d-flex justify-content-between align-items-center">
                <span class="small text-muted">User_ID: ${o.user_id}</span>
                <span class="text-white">${o.item}</span>
            </div>
        </div>
    `).join('');

    // Clear Result
    resultContainer.innerHTML = '<div class="text-muted small text-center mt-4 fst-italic">Aquí caerán los "solteros"...</div>';
}

function runExclusionSim() {
    const resultContainer = document.getElementById('excl-result-area');
    resultContainer.innerHTML = ''; // Clear initial msg

    let unmatchedCount = 0;

    exclusionUsers.forEach((user, index) => {
        setTimeout(() => {
            const userCard = document.getElementById(`excl-user-${user.id}`);
            const hasMatch = exclusionOrders.some(o => o.user_id === user.id);

            // Highlight checking
            userCard.classList.remove('bg-dark', 'border-secondary');
            userCard.classList.add('bg-secondary', 'border-light');

            setTimeout(() => {
                if (hasMatch) {
                    // Match found -> Ignored by IS NULL
                    userCard.classList.remove('bg-secondary', 'border-light');
                    userCard.classList.add('bg-success', 'bg-opacity-10', 'border-success', 'opacity-50'); // Dimmed
                } else {
                    // No match -> CAUGHT by IS NULL
                    unmatchedCount++;
                    userCard.classList.remove('bg-secondary', 'border-light');
                    userCard.classList.add('bg-warning', 'bg-opacity-25', 'border-warning');

                    // Clone to result
                    const resultCard = document.createElement('div');
                    resultCard.className = 'card bg-warning bg-opacity-10 border-warning p-2 mb-2 animate-fade-in';
                    resultCard.innerHTML = `
                        <div class="d-flex flex-column">
                            <span class="${user.color} fw-bold">${user.name}</span>
                            <small class="text-muted">Pedidos: NULL</small>
                        </div>
                    `;
                    resultContainer.appendChild(resultCard);
                }
            }, 800);

        }, index * 1200); // Stagger animations
    });
}

function resetExclusionSim() {
    renderExclusionTables();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('exclusion-animation-container')) {
        renderExclusionTables();
    }
});
