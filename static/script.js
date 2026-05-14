// Inicializamos la conexión con el servidor
const socket = io();

// Variables de estado local
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;

// Al conectar, informamos al servidor quién es este jugador [cite: 36, 65, 416]
socket.on('connect', () => {
    if (!miNombre) {
        window.location.href = "/"; // Si no hay nombre, al login [cite: 48, 416]
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Genera los botones de juego dinámicamente (Dados, Cartas, etc.) [cite: 58, 59, 417]
 */
function renderizarBotones(opciones) {
    const contenedor = document.getElementById('contenedor-opciones');
    if (!contenedor) return;
    
    contenedor.innerHTML = ''; 
    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.className = 'opcion-btn';
        btn.innerText = op;
        // Al hacer clic, se marca visualmente [cite: 60, 400, 418]
        btn.onclick = () => seleccionarOpcion(op, btn);
        contenedor.appendChild(btn);
    });
    
    opcionElegida = null; // Reiniciar selección para nueva ronda [cite: 419]
}

/**
 * Maneja el borde amarillo de selección de números o pintas [cite: 60, 400, 421]
 */
function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    // Quitamos la clase 'selected' de todos los botones [cite: 400, 422]
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    // Añadimos el borde amarillo al seleccionado [cite: 35, 400, 423]
    elemento.classList.add('selected');
}

/**
 * Captura el monto de los botones amarillos o del input manual [cite: 403, 404, 511, 512]
 */
function seleccionarPlata(monto, elemento) {
    // Si el monto viene de los botones predefinidos
    if (monto === 'ALL') {
        montoElegido = currentPuntos;
        alert("¡Has seleccionado TODO TU DINERO!");
    } else if (monto !== "") {
        montoElegido = parseInt(monto);
    }

    // Feedback visual para los botones amarillos [cite: 511]
    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
    if (elemento && elemento.classList.contains('apuesta-btn')) {
        elemento.classList.add('selected-money');
        // Limpiamos el input manual si se usa un botón para no confundir
        document.getElementById('monto-manual').value = "";
    }
}

/**
 * ENVÍO FINAL: Se ejecuta al presionar el botón VERDE [cite: 316, 402, 408, 441, 513]
 */
function confirmarApuesta() {
    // Revisamos si hay algo escrito en el cuadro manual por si se escribió después de elegir un botón
    const montoManual = document.getElementById('monto-manual').value;
    if (montoManual > 0) {
        montoElegido = parseInt(montoManual);
    }

    // Validaciones de seguridad [cite: 44, 67, 427, 428]
    if (opcionElegida === null) {
        alert("Primero elige un número o pinta."); return;
    }
    if (montoElegido <= 0) {
        alert("Elige o escribe un monto para apostar."); return;
    }
    if (montoElegido > currentPuntos) {
        alert("No tienes dinero suficiente."); return;
    }

    // Preguntar si está seguro antes de procesar 
    if (confirm(`¿Estás seguro de apostar $${montoElegido} al ${opcionElegida}?`)) {
        // Enviamos al servidor [cite: 36, 373, 429]
        socket.emit('place_bet', { 
            name: miNombre, 
            monto: montoElegido, 
            opcion: opcionElegida 
        });

        // BLOQUEO DE PANTALLA: Ocultamos controles y mostramos estado "Pending" [cite: 402, 408, 442, 514]
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = "⌛ APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
        msg.style.display = 'block';
    }
}

// --- ESCUCHADORES (SOCKETS) ---

// 1. Actualización de saldo inicial y ronda [cite: 34, 66, 430, 510]
socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
});

// 2. Cambio de juego o nueva ronda habilitada [cite: 54, 149, 431, 508]
socket.on('new_game', (game) => {
    renderizarBotones(game.options);
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    // Asegurar que los controles vuelvan a verse cuando el admin inicie nueva ronda [cite: 431]
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    // Limpiar selecciones visuales previas
    document.querySelectorAll('.selected, .selected-money').forEach(el => el.classList.remove('selected', 'selected-money'));
    document.getElementById('monto-manual').value = "";
    opcionElegida = null;
    montoElegido = 0;
});

socket.on('round_result', (data) => {
    // Si el admin reseteó el dinero, el jugador verá sus $1000 de nuevo
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }
    // ... (resto de tu lógica de GANASTE/PERDISTE)
});

// 3. Resultado de la ronda (GANASTE / PERDISTE) [cite: 66, 149, 411, 433, 436]
socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msg = document.getElementById('mensaje-espera');
    
    // Si el jugador realizó una apuesta en esta ronda
    if (opcionElegida !== null) {
        msg.style.display = 'block';
        if (String(opcionElegida) === String(ganador)) {
            msg.innerHTML = "<h1 style='color: #00ff00; font-size: 3rem;'>¡GANASTE! 🎉</h1>";
        } else {
            msg.innerHTML = "<h1 style='color: #ff4444; font-size: 2.5rem;'>MÁS SUERTE PARA LA PRÓXIMA 💀</h1>";
        }
    }

    // Actualizamos saldo con los datos oficiales del servidor [cite: 34, 149, 433]
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }
});

// 4. Sincronización de puntos tras confirmar apuesta [cite: 432]
socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + data.puntos;
});

// 5. Reinicio y expulsión [cite: 307, 335, 365, 394, 434, 435]
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
