// Inicializamos la conexión con el servidor
const socket = io();

// Variables de estado local
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;

// Al conectar, informamos al servidor quién es este jugador
socket.on('connect', () => {
    if (!miNombre) {
        window.location.href = "/"; 
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Genera los botones de juego dinámicamente
 */
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

/**
 * Maneja la selección visual
 */
function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
}

/**
 * Captura el monto de apuesta
 */
function seleccionarPlata(monto, elemento) {
    if (monto === 'ALL') {
        montoElegido = currentPuntos;
    } else if (monto !== "") {
        montoElegido = parseInt(monto);
    }

    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
    if (elemento && elemento.classList.contains('apuesta-btn')) {
        elemento.classList.add('selected-money');
        document.getElementById('monto-manual').value = ""; 
    }
}

/**
 * ENVÍO FINAL CON VERIFICACIÓN DE BANCA ROTA
 */
function confirmarApuesta() {
    // 1. Verificar si el jugador está en 0
    if (currentPuntos <= 0) {
        alert("¡Estás en la quiebra! No puedes apostar.");
        mostrarBancaRota();
        return;
    }

    let finalMonto = montoElegido;
    const manual = document.getElementById('monto-manual').value;
    if (manual > 0) finalMonto = parseInt(manual);

    if (finalMonto < 50) {
        alert("La apuesta mínima es de $50.");
        return;
    }

    if (!opcionElegida) {
        alert("Elige una opción primero.");
        return;
    }

    if (confirm(`¿Estás seguro de apostar $${finalMonto} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { 
            name: miNombre, 
            monto: finalMonto, 
            opcion: opcionElegida 
        });

        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = "⌛ APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
        msg.style.display = 'block';
    }
}

/**
 * Función visual para el estado de quiebra
 */
function mostrarBancaRota() {
    document.getElementById('controles-juego').style.display = 'none';
    const msgArea = document.getElementById('mensaje-espera');
    msgArea.style.display = 'block';
    msgArea.innerHTML = "<h1 style='color: #ff4444; font-size: 3.5rem;'>¡BANCA ROTA! 💀</h1><p>Has perdido todo tu dinero. Espera a un bono del host o un reinicio.</p>";
}

// --- ESCUCHADORES (SOCKETS) ---

socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    
    // Si entra y ya tiene 0 puntos, bloqueamos de inmediato
    if (currentPuntos <= 0) {
        mostrarBancaRota();
    } else if (data.game.status === "esperando") {
        document.getElementById('controles-juego').style.display = 'none';
        const msgArea = document.getElementById('mensaje-espera');
        msgArea.style.display = 'block';
        msgArea.innerHTML = "<h2 style='color: gold;'>¡BIENVENIDO! 🎰</h2><p>Espera a que el host inicie las apuestas... <br><b>¡Mucha suerte!</b></p>";
    } else {
        document.getElementById('controles-juego').style.display = 'block';
        document.getElementById('mensaje-espera').style.display = 'none';
        renderizarBotones(data.game.options);
    }
});

socket.on('new_game', (game) => {
    // Si al iniciar nueva ronda el jugador tiene 0, no lo dejamos jugar
    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }
    
    renderizarBotones(game.options);
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    
    document.querySelectorAll('.selected, .selected-money').forEach(el => el.classList.remove('selected', 'selected-money'));
    document.getElementById('monto-manual').value = "";
    opcionElegida = null;
    montoElegido = 0;
});

socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msgArea = document.getElementById('mensaje-espera');
    
    if (ganador === "Esperando..." || ganador === "Actualizando..." || ganador === "REINICIO DE DINERO") {
        return;
    }

    msgArea.style.display = 'block';
    document.getElementById('controles-juego').style.display = 'none';

    if (opcionElegida !== null) {
        if (String(opcionElegida) === String(ganador)) {
            msgArea.innerHTML = "<h1 style='color: lime;'>¡GANASTE! 🎉</h1>";
        } else {
            msgArea.innerHTML = "<h1 style='color: red;'>MÁS SUERTE PARA LA PRÓXIMA 💀</h1>";
        }
    } else {
        msgArea.innerHTML = "<h1 style='color: #ffa500;'>PIERDE $50 POR NO APOSTAR 💸</h1>";
    }

    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }

    // Verificamos si después de esta ronda se quedó en 0
    setTimeout(() => {
        if (currentPuntos <= 0) {
            mostrarBancaRota();
        } else {
            msgArea.innerHTML = "<h2 style='color: gold;'>RONDA TERMINADA</h2><p>Espera a que el host inicie la siguiente... 🍀</p>";
        }
    }, 4000);
});

socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    // Si un regalo del admin le quita el 0, desbloqueamos la pantalla
    if (currentPuntos > 0 && document.getElementById('mensaje-espera').innerText.includes("BANCA ROTA")) {
        document.getElementById('mensaje-espera').style.display = 'none';
        document.getElementById('controles-juego').style.display = 'block';
    }
});

socket.on('game_reset_done', () => {
    localStorage.removeItem('casino_name');
    window.location.href = "/";
});

socket.on('player_kicked', (data) => {
    if (miNombre === data.target) {
        localStorage.removeItem('casino_name');
        alert("Has sido eliminado por el administrador.");
        window.location.href = "/";
    }
});
