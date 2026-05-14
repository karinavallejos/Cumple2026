// Inicializamos la conexión con el servidor
const socket = io();

// Recuperamos el nombre guardado en el navegador
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionSeleccionada = null;

// Al conectar, informamos al servidor quién es este jugador [cite: 36]
socket.on('connect', () => {
    if (!miNombre) {
        window.location.href = "/"; // Si no hay nombre, lo manda al login
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Genera los botones de juego dinámicamente (Dados, Cartas, etc.)
 * @param {Array} opciones - Lista de opciones enviada por el admin [cite: 58, 59]
 */
function renderizarBotones(opciones) {
    const contenedor = document.getElementById('contenedor-opciones');
    if (!contenedor) return;
    
    contenedor.innerHTML = ''; // Limpiamos los botones anteriores
    
    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.className = 'opcion-btn';
        btn.innerText = op;
        // Al hacer clic, se selecciona esta opción
        btn.onclick = () => seleccionarOpcion(op, btn);
        contenedor.appendChild(btn);
    });
    
    // Reiniciamos la selección para la nueva ronda
    opcionSeleccionada = null;
    const instruccion = document.getElementById('instruccion');
    if (instruccion) instruccion.innerText = "¡Nueva ronda! Elige una opción:";
}

/**
 * Maneja la selección visual del botón [cite: 60]
 */
function seleccionarOpcion(val, elemento) {
    opcionSeleccionada = val;
    // Quitamos la clase 'selected' de todos los botones para que solo brille uno
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    // Añadimos el borde amarillo al seleccionado
    elemento.classList.add('selected');
}

/**
 * Envía la apuesta al servidor
 * @param {number|string} monto - Cantidad de dinero o 'ALL' para All-in 
 */
function apostar(monto) {
    if (!opcionSeleccionada) {
        alert("¡Primero debes elegir un número o pinta!");
        return;
    }

    let finalMonto;
    if (monto === 'ALL') {
        finalMonto = currentPuntos;
    } else {
        finalMonto = parseInt(monto);
    }

    // Validación básica antes de enviar [cite: 44]
    if (finalMonto > currentPuntos) {
        alert("No tienes suficiente dinero para esa apuesta.");
        return;
    }

    if (finalMonto <= 0) {
        alert("Debes apostar una cantidad mayor a 0.");
        return;
    }

    // Enviamos la apuesta al servidor [cite: 36]
    socket.emit('place_bet', { 
        name: miNombre, 
        monto: finalMonto, 
        opcion: opcionSeleccionada 
    });

    alert(`Apuesta confirmada: $${finalMonto} al ${opcionSeleccionada}`);
}

// --- ESCUCHADORES DE EVENTOS (SOCKETS) ---

// 1. Actualización inicial y de puntos cuando apuestas
socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    const display = document.getElementById('display-puntos');
    if (display) display.innerText = "$" + data.puntos;
});

// 2. Cuando el admin cambia la visual (ej. de Dados a Cartas) [cite: 54]
socket.on('new_game', (game) => {
    renderizarBotones(game.options);
});

// 3. Cuando el servidor descuenta puntos tras una apuesta confirmada
socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    const display = document.getElementById('display-puntos');
    if (display) display.innerText = "$" + data.puntos;
});

// 4. Cuando termina la ronda y el admin da los resultados [cite: 34]
socket.on('round_result', (data) => {
    // Buscamos nuestros puntos en la lista global enviada
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }
    alert("El resultado fue: " + data.ganador);
});
// Cuando el admin reinicia, borramos la memoria del celular y los mandamos al inicio
socket.on('game_reset_done', () => {
    localStorage.removeItem('casino_name'); // Olvida el nombre [cite: 311, 325]
    alert("El juego se ha reiniciado. Por favor, ingresa de nuevo.");
    window.location.href = "/"; // Los manda al login [cite: 48, 328]
});
