// Inicializamos la conexiÃ³n con el servidor
const socket = io();

// Variables de estado local
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;
let listaGlobalJugadores = {};

// Al conectar
socket.on('connect', () => {
    if (!miNombre) window.location.href = "/";
    socket.emit('join', { name: miNombre });
});

function mostrarBancaRota() {
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');
    if (controles) controles.style.display = 'none';
    if (msgArea) {
        msgArea.style.display = 'flex';
        msgArea.style.flexDirection = 'column';
        msgArea.style.justifyContent = 'center';
        msgArea.style.alignItems = 'center';
        msgArea.style.height = '60vh';
        msgArea.innerHTML = `
            <h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">Â¡BANCA ROTA! ðŸ’€</h1>
            <p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero. <br>Espera a un bono del host.</p>
        `;
    }
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

    if (game && game.status === "apostando") {
        document.getElementById('mensaje-espera').style.display = 'none';
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
        btn.onclick = () => seleccionarOpcion(op, btn);
        contenedor.appendChild(btn);
    });
    opcionElegida = null; 
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
    if (currentPuntos <= 0 && opcionElegida === null) { mostrarBancaRota(); return; }
    let finalMonto = montoElegido;
    if (finalMonto <= 0) { alert("Selecciona un monto."); return; }
    if (finalMonto > currentPuntos) { alert("Â¡No tienes suficiente dinero!"); return; }
    if (!opcionElegida) { alert("Elige una opciÃ³n primero."); return; }

    if (confirm(`Â¿Confirmar apuesta de $${finalMonto} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { name: miNombre, monto: finalMonto, opcion: opcionElegida });
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.style.display = 'flex';
        msg.innerHTML = "âŒ› APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
    }
}

// --- ESCUCHADORES DE SOCKETS ---

socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    listaGlobalJugadores = data.players || {}; 
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    
    if (currentPuntos <= 0) {
        mostrarBancaRota();
    } else if (data.game.status === "esperando") {
        document.getElementById('controles-juego').style.display = 'none';
        const msgArea = document.getElementById('mensaje-espera');
        msgArea.style.display = 'flex';
        msgArea.innerHTML = "<h2>Â¡BIENVENIDO! ðŸŽ°</h2><p>Espera a que el host inicie las apuestas...</p>";
    }
});

socket.on('state_update', (data) => {
    listaGlobalJugadores = data.players || {};

    if (data.game) {
        document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    }

    if (actualizarMisPuntos(listaGlobalJugadores)) {
        if (currentPuntos <= 0) {
            mostrarBancaRota();
        } else {
            mostrarControlesSiPuedeJugar(data.game);
        }
    }
});

socket.on('money_reset_done', (data) => {
    listaGlobalJugadores = data.players || {};
    currentPuntos = listaGlobalJugadores[miNombre] ? listaGlobalJugadores[miNombre].puntos : 1000;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    document.getElementById('controles-juego').style.display = 'none';

    const msgArea = document.getElementById('mensaje-espera');
    msgArea.style.display = 'flex';
    msgArea.innerHTML = "<h2>Dinero reiniciado a $1000</h2><p>Espera a que el host inicie la ronda 1.</p>";
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
    // Si el servidor envÃ­a mensajes de sistema, no mostramos el resultado de apuesta
    if (["REINICIO DE DINERO", "Actualizando...", "Â¡Dinero Reiniciado!"].includes(data.ganador)) {
        if (data.players[miNombre]) {
            currentPuntos = data.players[miNombre].puntos;
            document.getElementById('display-puntos').innerText = "$" + currentPuntos;
        }
        return;
    }

    listaGlobalJugadores = data.players;
    actualizarMisPuntos(data.players);

    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }

    const msgArea = document.getElementById('mensaje-espera');
    
    document.getElementById('controles-juego').style.display = 'none'; 
    msgArea.style.display = 'flex'; 
    msgArea.style.flexDirection = 'column';
    msgArea.style.justifyContent = 'center';
    msgArea.style.alignItems = 'center';
    msgArea.style.height = '60vh';

    let resultadoHTML = (opcionElegida !== null && String(opcionElegida) === String(data.ganador)) 
        ? "<h1 style='color: lime; font-size: 2.5rem;'>Â¡GANASTE! ðŸŽ‰</h1>" 
        : (opcionElegida !== null ? "<h1 style='color: red; font-size: 2.5rem;'>MÃS SUERTE... ðŸ’€</h1>" : "<h1 style='color: #ffa500; font-size: 2rem;'>PIERDE $50 POR NO APOSTAR ðŸ’¸</h1>");

    msgArea.innerHTML = `
        <div style="text-align: center;">
            ${resultadoHTML}
            <div style="margin-top: 30px; border-top: 2px solid gold; padding-top: 20px;">
                <h2 style="color: gold; font-size: 1.5rem;">RONDA TERMINADA</h2>
                <p style="color: white; font-size: 1.2rem;">Espera a que el host inicie la siguiente... ðŸ€</p>
            </div>
        </div>
    `;

    actualizarMisPuntos(data.players);
});

socket.on('new_game', (game) => {
    if (currentPuntos <= 0) {
        document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
        mostrarBancaRota();
        return;
    }

    document.getElementById('mensaje-espera').style.display = 'none';
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    
    renderizarBotones(game.options);
    opcionElegida = null;
    montoElegido = 0;
});

socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;

    if (currentPuntos <= 0) {
        mostrarBancaRota();
    }
});
