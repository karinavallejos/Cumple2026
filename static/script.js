const socket = io();

let miNombre = localStorage.getItem('casino_name');
let miMesa = localStorage.getItem('casino_table');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;
let listaGlobalJugadores = {};
let apuestaEnviada = false;
let buzzerState = null;
let yaToqueChicharra = false;

const playerNames = [
    'Admin', 'Alexander', 'Ali', 'Angela', 'Arturo', 'Belen', 'Benny', 'Carla C.', 'Carla P.', 'Cata',
    'Coni', 'Cote', 'Cristian', 'Damian', 'Daniela', 'David', 'Dayanne', 'Diego', 'Eduardo', 'Francisco',
    'George', 'Heriberto', 'Ignacio', 'Ines', 'Isidora', 'Javi', 'Jorge', 'Karina', 'Katty', 'Loreto A.',
    'Loreto M.', 'Macarena', 'Manuel', 'Marianela', 'Matias F.', 'Matias B.', 'Maxi P.', 'Max C.',
    'Michelle', 'Mike', 'Pame', 'Paulina', 'Paulina G.', 'Peyo', 'Pedro V.', 'Pipe', 'Poly', 'Tamara',
    'Tati', 'Tito G.', 'Tito S.'
];

const buzzerTables = ['Elvis', 'Circus', 'Bellagio', 'All in', 'Flamingo', 'Jackpot', 'Luxor'];

const colorStyles = {
    ROJO: { background: "#d71920", color: "#d71920", border: "#ffb3b3" },
    NEGRO: { background: "#050505", color: "#050505", border: "#ffffff" },
    VERDE: { background: "#00a651", color: "#00a651", border: "#c7ffd8" },
    AZUL: { background: "#0077ff", color: "#0077ff", border: "#cce3ff" },
    BLANCO: { background: "#ffffff", color: "#ffffff", border: "#999999" },
    AMARILLO: { background: "#ffd400", color: "#ffd400", border: "#fff2a0" }
};

const rouletteColorCenters = {
    ROJO: 30,
    NEGRO: 90,
    VERDE: 150,
    AZUL: 210,
    BLANCO: 270,
    AMARILLO: 330
};

socket.on('connect', () => {
    prepararSelectoresChicharra();
    if (miNombre) {
        socket.emit('join', { name: miNombre });
    } else {
        socket.emit('get_state');
    }
});

function setMensaje(html) {
    const msgArea = document.getElementById('mensaje-espera');
    if (!msgArea) return;

    msgArea.style.display = 'flex';
    msgArea.style.flexDirection = 'column';
    msgArea.style.justifyContent = 'center';
    msgArea.style.alignItems = 'center';
    msgArea.style.minHeight = '30vh';
    msgArea.style.height = 'auto';
    msgArea.innerHTML = html;
}

function ocultarControles() {
    const controles = document.getElementById('controles-juego');
    if (controles) controles.style.display = 'none';
}

function mostrarBancaRota() {
    ocultarControles();
    setMensaje(`
        <h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">Banca Rota! 💀 :c</h1>
        <p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero, podrias volver a jugar si te ganas un bono del Host.</p>
    `);
}

function mostrarEsperaHost() {
    ocultarControles();
    setMensaje("<h2>Bienvenido! 🎰</h2><p>Espera a que el Host inicie las apuestas.</p>");
}

function mostrarEsperaResultado() {
    ocultarControles();
    setMensaje("<h2>Buena suerte! 🍀</h2><p>Espera a que el Host de el resultado de la ronda.</p>");
}

function actualizarMisPuntos(players) {
    if (!players || !players[miNombre]) return false;

    currentPuntos = players[miNombre].puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    return true;
}

function mostrarControlesSiPuedeJugar(game) {
    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }

    if (apuestaEnviada) {
        mostrarEsperaResultado();
        return;
    }

    if (game && game.status === "apostando") {
        const msgArea = document.getElementById('mensaje-espera');
        if (msgArea) msgArea.style.display = 'none';
        document.getElementById('controles-juego').style.display = 'block';
    }
}

function renderizarBotones(opciones) {
    const contenedor = document.getElementById('contenedor-opciones');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.className = 'opcion-btn';
        btn.innerText = op;
        aplicarEstiloColor(btn, op);
        btn.onclick = () => seleccionarOpcion(op, btn);
        contenedor.appendChild(btn);
    });

    opcionElegida = null;
}

function aplicarEstiloColor(btn, color) {
    const estilo = colorStyles[color];
    if (!estilo) return;

    btn.classList.add('color-option');
    btn.style.background = estilo.background;
    btn.style.color = estilo.color;
    btn.style.borderColor = estilo.border;
    btn.style.width = '100%';
    btn.style.height = '74px';
    btn.style.padding = '0';
    btn.style.boxSizing = 'border-box';
    btn.style.textShadow = 'none';
    btn.style.overflow = 'hidden';
}

function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
}

function seleccionarPlata(monto, elemento) {
    if (monto === 'ALL') montoElegido = currentPuntos;
    else if (monto !== "") montoElegido = parseInt(monto);

    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
    if (elemento && elemento.classList.contains('apuesta-btn')) {
        elemento.classList.add('selected-money');
    }
}

function reiniciarSeleccionApuesta() {
    montoElegido = 0;
    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
}

function confirmarApuesta() {
    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }

    const finalMonto = montoElegido;
    if (finalMonto <= 0) { alert("Selecciona un monto."); return; }
    if (finalMonto > currentPuntos) { alert("No tienes suficiente dinero!"); return; }
    if (!opcionElegida) { alert("Elige una opcion primero."); return; }

    if (confirm(`Confirmar apuesta de $${finalMonto} al ${opcionElegida}?`)) {
        apuestaEnviada = true;
        socket.emit('place_bet', { name: miNombre, monto: finalMonto, opcion: opcionElegida });
        mostrarEsperaResultado();
    }
}

socket.on('update_data', (data) => {
    if (data.buzzer && data.buzzer.active) {
        mostrarChicharra(data.buzzer);
        return;
    }

    currentPuntos = data.puntos;
    listaGlobalJugadores = data.players || {};
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;

    if (currentPuntos <= 0) {
        mostrarBancaRota();
    } else if (data.game.status === "apostando") {
        mostrarControlesSiPuedeJugar(data.game);
    } else {
        mostrarEsperaHost();
    }
});

socket.on('state_update', (data) => {
    if (data.buzzer && data.buzzer.active) {
        mostrarChicharra(data.buzzer);
        return;
    }

    ocultarChicharra();
    if (!miNombre) {
        window.location.href = "/";
        return;
    }

    listaGlobalJugadores = data.players || {};

    if (data.game) {
        document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    }

    if (!actualizarMisPuntos(listaGlobalJugadores)) return;

    if (apuestaEnviada) {
        mostrarEsperaResultado();
    } else if (currentPuntos <= 0) {
        mostrarBancaRota();
    } else if (data.game && data.game.status === "apostando") {
        mostrarControlesSiPuedeJugar(data.game);
    } else if (data.game && data.game.status !== "finalizada") {
        mostrarEsperaHost();
    }
});

socket.on('money_reset_done', (data) => {
    apuestaEnviada = false;
    listaGlobalJugadores = data.players || {};
    currentPuntos = listaGlobalJugadores[miNombre] ? listaGlobalJugadores[miNombre].puntos : 1000;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    mostrarEsperaHost();
});

socket.on('game_reset_done', () => {
    localStorage.removeItem('casino_table');
    localStorage.removeItem('casino_name');
    window.location.href = "/";
});

socket.on('player_kicked', (data) => {
    if (data.target === miNombre) {
        localStorage.removeItem('casino_name');
        window.location.href = "/";
    }
});

socket.on('round_result', (data) => {
    ocultarRuleta();
    listaGlobalJugadores = data.players || {};
    actualizarMisPuntos(listaGlobalJugadores);
    apuestaEnviada = false;

    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }

    ocultarControles();

    const gano = opcionElegida !== null && String(opcionElegida) === String(data.ganador);
    const resultadoHTML = gano
        ? "<h1 style='color: lime; font-size: 2.5rem;'>Ganaste!</h1>"
        : (opcionElegida !== null
            ? "<h1 style='color: red; font-size: 2.5rem;'>Perdiste!</h1>"
            : "<h1 style='color: #ffa500; font-size: 2rem;'>Pierdes $50 por no apostar</h1>");

    setMensaje(`
        <div style="text-align: center;">
            ${resultadoHTML}
            <div style="margin-top: 30px; border-top: 2px solid gold; padding-top: 20px;">
                <h2 style="color: gold; font-size: 1.5rem;">Ronda terminada</h2>
                <p style="color: white; font-size: 1.2rem;">Espera a que el Host inicie la siguiente ronda.</p>
            </div>
        </div>
    `);
});

socket.on('roulette_spin', (data) => {
    mostrarRuleta(data);
});

socket.on('buzzer_state', (data) => {
    if (data && data.active) {
        mostrarChicharra(data);
    } else {
        ocultarChicharra();
        if (!miNombre) window.location.href = "/";
    }
});

socket.on('buzzer_joined', (data) => {
    miNombre = data.name;
    miMesa = data.table;
    localStorage.setItem('casino_name', miNombre);
    localStorage.setItem('casino_table', miMesa);
    mostrarChicharra(buzzerState);
});

socket.on('buzzer_error', (data) => {
    alert(data.message || 'Revisa tu nombre y mesa.');
});

socket.on('new_game', (game) => {
    apuestaEnviada = false;
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;

    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }

    const msgArea = document.getElementById('mensaje-espera');
    if (msgArea) msgArea.style.display = 'none';
    document.getElementById('controles-juego').style.display = 'block';

    renderizarBotones(game.options);
    opcionElegida = null;
    reiniciarSeleccionApuesta();
});

socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;

    if (apuestaEnviada) {
        mostrarEsperaResultado();
    } else if (currentPuntos <= 0) {
        mostrarBancaRota();
    }
});

function mostrarRuleta(data) {
    ocultarControles();
    asegurarModalRuleta();
    const modal = document.getElementById('modal-ruleta');
    const wheel = document.getElementById('ruleta-wheel');
    const resultado = document.getElementById('ruleta-resultado');
    if (!modal || !wheel || !resultado) return;

    modal.style.display = 'flex';
    resultado.innerText = 'Girando...';
    animarRuleta(wheel, data.ganador, data.duration || 4500);

    setTimeout(() => {
        resultado.innerText = 'Color ganador: ' + data.ganador;
    }, data.duration || 4500);
}

function ocultarRuleta() {
    const modal = document.getElementById('modal-ruleta');
    const wheel = document.getElementById('ruleta-wheel');
    if (modal) modal.style.display = 'none';
    if (wheel) {
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(0deg)';
    }
}

function animarRuleta(wheel, ganador, duration) {
    const center = rouletteColorCenters[ganador] || rouletteColorCenters.AMARILLO;
    const finalRotation = 1800 + ((360 - center) % 360);

    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';
    void wheel.offsetWidth;
    wheel.style.transition = `transform ${duration}ms cubic-bezier(.12,.72,.2,1)`;
    wheel.style.transform = `rotate(${finalRotation}deg)`;
}

function asegurarModalRuleta() {
    if (!document.getElementById('ruleta-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'ruleta-modal-styles';
        styles.textContent = `
            #modal-ruleta {
                display: none;
                position: fixed;
                z-index: 2000;
                inset: 0;
                background: rgba(0,0,0,0.94);
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 18px;
                text-align: center;
            }

            #modal-ruleta h1 {
                color: gold;
                margin: 0;
                letter-spacing: 0;
            }

            .ruleta-wheel {
                width: min(78vw, 360px);
                height: min(78vw, 360px);
                border-radius: 50%;
                border: 8px solid gold;
                box-shadow: 0 0 35px rgba(255, 215, 0, 0.75);
                background: conic-gradient(#d71920 0deg 60deg, #050505 60deg 120deg, #00a651 120deg 180deg, #0077ff 180deg 240deg, #ffffff 240deg 300deg, #ffd400 300deg 360deg);
            }

            .ruleta-pointer {
                width: 0;
                height: 0;
                border-left: 18px solid transparent;
                border-right: 18px solid transparent;
                border-top: 34px solid gold;
                filter: drop-shadow(0 0 8px gold);
            }

            #ruleta-resultado {
                min-height: 36px;
                color: white;
                font-size: 1.5rem;
                font-weight: bold;
                text-transform: uppercase;
            }

        `;
        document.head.appendChild(styles);
    }

    if (!document.getElementById('modal-ruleta')) {
        const modal = document.createElement('div');
        modal.id = 'modal-ruleta';
        modal.innerHTML = `
            <h1>RULETA DE COLORES</h1>
            <div class="ruleta-pointer"></div>
            <div id="ruleta-wheel" class="ruleta-wheel"></div>
            <div id="ruleta-resultado">Girando...</div>
        `;
        document.body.appendChild(modal);
    }
}

function prepararSelectoresChicharra() {
    const nombreSelect = document.getElementById('chicharra-nombre');
    const mesaSelect = document.getElementById('chicharra-mesa');
    if (!nombreSelect || !mesaSelect || nombreSelect.dataset.ready === '1') return;

    nombreSelect.innerHTML = '<option value="">Selecciona tu nombre...</option>';
    playerNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        nombreSelect.appendChild(opt);
    });

    mesaSelect.innerHTML = '<option value="">Selecciona tu mesa...</option>';
    buzzerTables.forEach(table => {
        const opt = document.createElement('option');
        opt.value = table;
        opt.innerText = table;
        mesaSelect.appendChild(opt);
    });

    if (miNombre) nombreSelect.value = miNombre;
    if (miMesa) mesaSelect.value = miMesa;
    nombreSelect.dataset.ready = '1';
}

function mostrarChicharra(data) {
    if (!data) return;
    buzzerState = data;
    prepararSelectoresChicharra();

    ['casino-header', 'casino-main', 'casino-footer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const panel = document.getElementById('chicharra-panel');
    if (panel) panel.style.display = 'block';

    const registro = document.getElementById('chicharra-registro');
    const juego = document.getElementById('chicharra-juego');
    const mesaRegistrada = miNombre && miMesa;

    if (registro) registro.style.display = mesaRegistrada ? 'none' : 'block';
    if (juego) juego.style.display = mesaRegistrada ? 'block' : 'none';

    if (!mesaRegistrada) return;

    const yaEstoy = (data.buzzes || []).some(item => item.name === miNombre);
    yaToqueChicharra = yaEstoy;

    document.getElementById('chicharra-cancion').innerText = `Cancion ${data.song || 0}`;
    document.getElementById('chicharra-mesa-actual').innerText = `${miNombre} - Mesa ${miMesa}`;
    const btn = document.getElementById('btn-chicharra');
    btn.disabled = !data.enabled || yaEstoy;
    btn.innerText = yaEstoy ? 'LISTO' : 'CHICHARRA';
    document.getElementById('chicharra-estado').innerText = data.enabled
        ? (yaEstoy ? 'Tu turno quedo registrado.' : 'Chicharra habilitada')
        : 'Espera a que el Host habilite la siguiente cancion.';

    renderizarOrdenChicharra(data);
    renderizarPuntosMesas(data);
}

function ocultarChicharra() {
    const panel = document.getElementById('chicharra-panel');
    if (panel) panel.style.display = 'none';

    ['casino-header', 'casino-main', 'casino-footer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
}

function registrarChicharra() {
    const nombre = document.getElementById('chicharra-nombre').value;
    const mesa = document.getElementById('chicharra-mesa').value;
    if (!nombre || !mesa) {
        alert('Selecciona tu nombre y mesa.');
        return;
    }

    miNombre = nombre;
    miMesa = mesa;
    localStorage.setItem('casino_name', miNombre);
    localStorage.setItem('casino_table', miMesa);
    socket.emit('join', { name: miNombre });
    socket.emit('player_join_buzzer', { name: miNombre, table: miMesa });
}

function tocarChicharra() {
    if (!miNombre || !miMesa || yaToqueChicharra) return;
    yaToqueChicharra = true;
    socket.emit('player_buzz', { name: miNombre, table: miMesa });
}

function renderizarOrdenChicharra(data) {
    const contenedor = document.getElementById('chicharra-orden');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    const primeros = (data.buzzes || []).slice(0, 15);
    if (primeros.length === 0) {
        contenedor.innerHTML = '<div><span>Sin respuestas todavia</span><span></span></div>';
        return;
    }

    primeros.forEach((item, index) => {
        const row = document.createElement('div');
        row.innerHTML = `<span>${index + 1}. ${item.name} - ${item.table}</span><span>${item.elapsed}s</span>`;
        contenedor.appendChild(row);
    });
}

function renderizarPuntosMesas(data) {
    const contenedor = document.getElementById('puntos-mesas');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    buzzerTables.forEach(table => {
        const row = document.createElement('div');
        row.innerHTML = `<span>${table}</span><strong>${(data.tables || {})[table] || 0}</strong>`;
        contenedor.appendChild(row);
    });
}

function togglePuntosMesas() {
    const panel = document.getElementById('puntos-mesas');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
