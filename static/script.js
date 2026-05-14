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
        window.location.href = "/"; // Si no hay nombre, al login
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Genera los botones de juego dinámicamente (Dados, Cartas, etc.)
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
 * Maneja el borde amarillo de selección de números o pintas
 */
function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
}

/**
 * Captura el monto de los botones amarillos o del input manual
 */
function seleccionarPlata(monto, elemento) {
    if (monto === 'ALL') {
        montoElegido = currentPuntos;
    } else if (monto !== "") {
        montoElegido = parseInt(monto);
    }

    // Feedback visual para los botones amarillos
    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
    if (elemento && elemento.classList.contains('apuesta-btn')) {
        elemento.classList.add('selected-money');
        document.getElementById('monto-manual').value = ""; 
    }
}

/**
 * ENVÍO FINAL: Se ejecuta al presionar el botón VERDE
 */
function confirmarApuesta() {
    let finalMonto = montoElegido;
    const manual = document.getElementById('monto-manual').value;
    if (manual > 0) finalMonto = parseInt(manual);

    // REGLA: Apuesta mínima de 50
    if (finalMonto < 50) {
        alert("La apuesta mínima es de $50.");
        return;
    }

    if (!opcionElegida) {
        alert("Elige una opción (Número o Pinta) primero.");
        return;
    }

    // Confirmación antes de bloquear pantalla
    if (confirm(`¿Estás seguro de apostar $${finalMonto} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { 
            name: miNombre, 
            monto: finalMonto, 
            opcion: opcionElegida 
        });

        // BLOQUEO DE PANTALLA: Pending
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = "⌛ APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
        msg.style.display = 'block';
    }
}

// --- ESCUCHADORES (SOCKETS) ---

// 1. Actualización inicial (Maneja el mensaje de BIENVENIDA)
socket.on('update_data', (data) => {
    currentPuntos = data.puntos; // Corregido de current_puntos a currentPuntos
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');

    if (data.game.status === "esperando") {
        controles.style.display = 'none';
        msgArea.style.display = 'block';
        msgArea.innerHTML = "<h2 style='color: gold;'>¡BIENVENIDO! 🎰</h2><p>Espera a que el host inicie las apuestas... <br><b>¡Mucha suerte!</b></p>";
    } else {
        controles.style.display = 'block';
        msgArea.style.display = 'none';
        renderizarBotones(data.game.options);
    }
});

// 2. Cambio de juego o nueva ronda habilitada
socket.on('new_game', (game) => {
    renderizarBotones(game.options);
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    
    // Reset visual
    document.querySelectorAll('.selected, .selected-money').forEach(el => el.classList.remove('selected', 'selected-money'));
    document.getElementById('monto-manual').value = "";
    opcionElegida = null;
    montoElegido = 0;
});

// 3. Resultado de la ronda (GANASTE / PERDISTE / PENALIZACIÓN)
socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msgArea = document.getElementById('mensaje-espera');
    
    // Si es un mensaje interno, no mostrar penalización
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

    // Sincronizar dinero real
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }

    // Regresar a estado de espera tras 4 segundos
    setTimeout(() => {
        msgArea.innerHTML = "<h2 style='color: gold;'>RONDA TERMINADA</h2><p>Espera a que el host inicie la siguiente... 🍀</p>";
    }, 4000);
});

// 4. Sincronización tras apuesta confirmada
socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + data.puntos;
});

// 5. Reinicio y expulsión
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
