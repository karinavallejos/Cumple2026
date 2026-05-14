// Inicializamos la conexión con el servidor
const socket = io();

// Variables de estado local
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;

// Al conectar, informamos al servidor quién es este jugador [cite: 36, 65]
socket.on('connect', () => {
    if (!miNombre) {
        window.location.href = "/"; // Si no hay nombre, al login [cite: 48]
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Genera los botones de juego dinámicamente (Dados, Cartas, etc.) [cite: 58, 59]
 */
function renderizarBotones(opciones) {
    const contenedor = document.getElementById('contenedor-opciones');
    if (!contenedor) return;
    
    contenedor.innerHTML = ''; 
    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.className = 'opcion-btn';
        btn.innerText = op;
        // Al hacer clic, se marca visualmente [cite: 60, 400]
        btn.onclick = () => seleccionarOpcion(op, btn);
        contenedor.appendChild(btn);
    });
    
    opcionElegida = null; // Reiniciar selección para nueva ronda
}

/**
 * Maneja el borde amarillo de selección [cite: 60, 400]
 */
function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    // Quitamos la clase 'selected' de todos los botones [cite: 400]
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    // Añadimos el borde amarillo al seleccionado [cite: 35, 400]
    elemento.classList.add('selected');
}

/**
 * Captura el monto de los botones amarillos o del input manual [cite: 403, 404]
 */
function prepararMonto(monto) {
    if (monto === 'ALL') {
        montoElegido = currentPuntos;
        alert("¡Has seleccionado TODO TU DINERO!");
    } else {
        montoElegido = parseInt(monto);
    }
    // Si eligen un botón, limpiamos el input manual para no confundir
    document.getElementById('monto-manual').value = "";
}

/**
 * ENVÍO FINAL: Se ejecuta al presionar el botón VERDE [cite: 316, 402, 408]
 */
function confirmarApuesta() {
    // Revisamos si hay algo escrito en el cuadro manual [cite: 404, 407]
    const montoManual = document.getElementById('monto-manual').value;
    if (montoManual > 0) {
        montoElegido = parseInt(montoManual);
    }

    // Validaciones [cite: 44, 67]
    if (opcionElegida === null) {
        alert("Primero elige un número o pinta."); return;
    }
    if (montoElegido <= 0) {
        alert("Elige o escribe un monto para apostar."); return;
    }
    if (montoElegido > currentPuntos) {
        alert("No tienes dinero suficiente."); return;
    }

    // Enviamos al servidor [cite: 36, 373]
    socket.emit('place_bet', { 
        name: miNombre, 
        monto: montoElegido, 
        opcion: opcionElegida 
    });

    // BLOQUEO DE PANTALLA: Ocultamos controles y mostramos espera [cite: 402, 408]
    document.getElementById('controles-juego').style.display = 'none';
    const msg = document.getElementById('mensaje-espera');
    msg.innerHTML = "⏳ APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
    msg.style.display = 'block';
}

// --- ESCUCHADORES (SOCKETS) ---

// 1. Actualización de saldo inicial [cite: 34, 66]
socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
});

// 2. Cambio de juego (Dados/Cartas) [cite: 54, 149]
socket.on('new_game', (game) => {
    renderizarBotones(game.options);
    // Asegurar que los controles vuelvan a verse si el admin cambia de juego
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
});

// 3. Resultado de la ronda (GANASTE / PERDISTE) [cite: 66, 149, 411]
socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msg = document.getElementById('mensaje-espera');
    
    // Si el jugador apostó en esta ronda
    if (opcionElegida !== null) {
        msg.style.display = 'block';
        if (String(opcionElegida) === String(ganador)) {
            msg.innerHTML = "<h1 style='color: #00ff00; font-size: 3rem;'>¡GANASTE! 🎉</h1>";
        } else {
            msg.innerHTML = "<h1 style='color: #ff4444; font-size: 2.5rem;'>MÁS SUERTE PARA LA PRÓXIMA 💀</h1>";
        }
    }

    // Actualizamos saldo [cite: 34, 149]
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }

    // Después de 4 segundos, devolvemos los botones para la siguiente ronda 
    setTimeout(() => {
        document.getElementById('controles-juego').style.display = 'block';
        msg.style.display = 'none';
        document.getElementById('monto-manual').value = "";
        opcionElegida = null;
        montoElegido = 0;
    }, 4000);
});

// 4. Reinicio y expulsión [cite: 307, 335, 365, 394]
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
