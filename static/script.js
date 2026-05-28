const socket = io();

let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;
let listaGlobalJugadores = {};
let apuestaEnviada = false;

const colorStyles = {
    ROJO: { background: "#d71920", color: "#d71920", border: "#ffb3b3" },
    NEGRO: { background: "#050505", color: "#050505", border: "#ffffff" },
    VERDE: { background: "#00a651", color: "#00a651", border: "#c7ffd8" },
    AZUL: { background: "#0077ff", color: "#0077ff", border: "#cce3ff" },
    BLANCO: { background: "#ffffff", color: "#ffffff", border: "#999999" },
    AMARILLO: { background: "#ffd400", color: "#ffd400", border: "#fff2a0" }
};

socket.on('connect', () => {
    if (!miNombre) window.location.href = "/";
    socket.emit('join', { name: miNombre });
});

function setMensaje(html) {
    const msgArea = document.getElementById('mensaje-espera');
    if (!msgArea) return;

    msgArea.style.display = 'flex';
    msgArea.style.flexDirection = 'column';
    msgArea.style.justifyContent = 'center';
    msgArea.style.alignItems = 'center';
    msgArea.style.height = '60vh';
    msgArea.innerHTML = html;
}

function ocultarControles() {
    const controles = document.getElementById('controles-juego');
    if (controles) controles.style.display = 'none';
}

function mostrarBancaRota() {
    ocultarControles();
    setMensaje(`
        <h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">Banca Rota! :c</h1>
        <p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero, podrias volver a jugar si te ganas un bono del Host.</p>
    `);
}

function mostrarEsperaHost() {
    ocultarControles();
    setMensaje("<h2>Bienvenido!</h2><p>Espera a que el Host inicie las apuestas.</p>");
}

function mostrarEsperaResultado() {
    ocultarControles();
    setMensaje("<h2>Buena suerte!</h2><p>Espera a que el Host de el resultado de la ronda.</p>");
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
    montoElegido = 0;
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
    wheel.classList.remove('spinning');
    void wheel.offsetWidth;
    wheel.classList.add('spinning');

    setTimeout(() => {
        resultado.innerText = 'Color ganador: ' + data.ganador;
    }, data.duration || 4500);
}

function ocultarRuleta() {
    const modal = document.getElementById('modal-ruleta');
    const wheel = document.getElementById('ruleta-wheel');
    if (modal) modal.style.display = 'none';
    if (wheel) wheel.classList.remove('spinning');
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

            .ruleta-wheel.spinning {
                animation: spinRoulette 4.5s cubic-bezier(.12,.72,.2,1) forwards;
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

            @keyframes spinRoulette {
                from { transform: rotate(0deg); }
                to { transform: rotate(1840deg); }
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
