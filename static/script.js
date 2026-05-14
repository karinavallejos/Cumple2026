// Inicializamos la conexión con el servidor
const socket = io();

// Variables de estado local
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;
let listaGlobalJugadores = {}; // Para alimentar el ranking modal

// Al conectar, informamos al servidor quién es este jugador
socket.on('connect', () => {
    if (!miNombre) {
        window.location.href = "/"; // Si no hay nombre, al login
    }
    socket.emit('join', { name: miNombre });
});

/**
 * Muestra el mensaje de quiebra definitiva
 */
function mostrarBancaRota() {
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');
    
    if (controles) controles.style.display = 'none';
    if (msgArea) {
        msgArea.style.display = 'block';
        msgArea.innerHTML = `
            <h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">¡BANCA ROTA! 💀</h1>
            <p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero. <br>Espera a un bono del host para volver al juego.</p>
        `;
    }
}

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

function seleccionarOpcion(val, elemento) {
    opcionElegida = val;
    document.querySelectorAll('.opcion-btn').forEach(b => b.classList.remove('selected'));
    elemento.classList.add('selected');
}

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
 * ENVÍO DE APUESTA: Bloquea controles y muestra espera
 */
function confirmarApuesta() {
    // Si ya está en 0 y no ha apostado, es quiebra
    if (currentPuntos <= 0 && opcionElegida === null) {
        mostrarBancaRota();
        return;
    }

    let finalMonto = montoElegido;
    const manual = document.getElementById('monto-manual').value;
    if (manual > 0) finalMonto = parseInt(manual);

    if (finalMonto < 50) { alert("La apuesta mínima es de $50."); return; }
    if (!opcionElegida) { alert("Elige una opción primero."); return; }

    if (confirm(`¿Apostar $${finalMonto} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { name: miNombre, monto: finalMonto, opcion: opcionElegida });
        
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = `
            <h2 style="color: gold;">⌛ APUESTA ENVIADA</h2>
            <p>Espera a que el host entregue los resultados...</p>
        `;
        msg.style.display = 'block';
    }
}

// --- ESCUCHADORES (SOCKETS) ---

// 1. Carga inicial y Bienvenida
socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    listaGlobalJugadores = data.players || {}; 
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');

    if (currentPuntos <= 0) {
        mostrarBancaRota();
    } else if (data.game.status === "esperando") {
        controles.style.display = 'none';
        msgArea.style.display = 'block';
        msgArea.innerHTML = `
            <h2 style="color: gold; font-size: 2rem;">¡BIENVENIDO! 🎰</h2>
            <p style="font-size: 1.1rem;">Espera a que el host inicie las apuestas... <br><b>¡Mucha suerte!</b></p>
        `;
    } else {
        controles.style.display = 'block';
        msgArea.style.display = 'none';
        renderizarBotones(data.game.options);
    }
});

// 2. Resultados de la Ronda
socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msgArea = document.getElementById('mensaje-espera');
    listaGlobalJugadores = data.players; // Actualizar ranking

    if (ganador === "Esperando..." || ganador === "Actualizando..." || ganador === "REINICIO DE DINERO") return;

    msgArea.style.display = 'block';
    document.getElementById('controles-juego').style.display = 'none';

    if (opcionElegida !== null) {
        if (String(opcionElegida) === String(ganador)) {
            msgArea.innerHTML = "<h1 style='color: lime; font-size: 3rem;'>¡GANASTE! 🎉</h1>";
        } else {
            msgArea.innerHTML = "<h1 style='color: red; font-size: 2.5rem;'>MÁS SUERTE PARA LA PRÓXIMA 💀</h1>";
        }
    } else {
        msgArea.innerHTML = "<h1 style='color: #ffa500;'>PIERDE $50 POR NO APOSTAR 💸</h1>";
    }

    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }

    // Tras 4 segundos, verificar si quedó en quiebra o vuelve a esperar
    setTimeout(() => {
        if (currentPuntos <= 0) {
            mostrarBancaRota();
        } else {
            msgArea.innerHTML = `
                <h2 style="color: gold;">RONDA TERMINADA</h2>
                <p>Espera a que el host inicie la siguiente... 🍀</p>
            `;
            opcionElegida = null;
            montoElegido = 0;
        }
    }, 4000);
});

// 3. Sincronización de puntos (Regalos o Apuestas)
socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    
    // Si recibe dinero y estaba en Banca Rota, lo rescatamos
    if (currentPuntos > 0) {
        const msgText = document.getElementById('mensaje-espera').innerText;
        if (msgText.includes("BANCA ROTA")) {
            document.getElementById('mensaje-espera').style.display = 'none';
            document.getElementById('controles-juego').style.display = 'block';
        }
    }
});

// 4. Nueva Ronda / Cambio de Visual
socket.on('new_game', (game) => {
    if (currentPuntos <= 0) {
        mostrarBancaRota();
        return;
    }
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    renderizarBotones(game.options);
    document.querySelectorAll('.selected, .selected-money').forEach(el => el.classList.remove('selected', 'selected-money'));
});

// 5. Gestión de expulsión y reinicio
socket.on('game_reset_done', () => { 
    localStorage.removeItem('casino_name'); 
    window.location.href = "/"; 
});

socket.on('player_kicked', (data) => { 
    if (miNombre === data.target) { 
        localStorage.removeItem('casino_name'); 
        window.location.href = "/"; 
    } 
});
