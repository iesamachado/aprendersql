document.addEventListener('DOMContentLoaded', function () {
    // Sidebar Toggle
    var el = document.getElementById("wrapper");
    var toggleButton = document.getElementById("menu-toggle");

    toggleButton.onclick = function () {
        el.classList.toggle("sb-sidenav-toggled");
        document.body.classList.toggle("sb-sidenav-toggled");
    };

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
