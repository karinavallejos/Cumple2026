// Inicializamos la conexión con el servidor
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
        msgArea.style.display = 'block';
        msgArea.innerHTML = `
            <h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">¡BANCA ROTA! 💀</h1>
            <p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero. <br>Espera a un bono del host.</p>
        `;
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
    if (finalMonto > currentPuntos) { alert("¡No tienes suficiente dinero!"); return; }
    if (!opcionElegida) { alert("Elige una opción primero."); return; }

    if (confirm(`¿Confirmar apuesta de $${finalMonto} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { name: miNombre, monto: finalMonto, opcion: opcionElegida });
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = "⌛ APUESTA ENVIADA... <br> ESPERANDO AL ADMIN";
        msg.style.display = 'block';
    }
}

// --- ESCUCHADORES ---

// 1. Carga inicial (Actualizado)
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
        msgArea.style.display = 'flex'; // Usamos flex para centrar
        msgArea.innerHTML = "<h2>¡BIENVENIDO! 🎰</h2><p>Espera a que el host inicie las apuestas...</p>";
    } else {
        // Si el juego está activo, ocultamos el mensaje y mostramos controles
        document.getElementById('mensaje-espera').style.display = 'none';
        document.getElementById('controles-juego').style.display = 'block';
    }
});

// 2. Resultado de ronda (Actualizado)
socket.on('round_result', (data) => {
    listaGlobalJugadores = data.players;
    const msgArea = document.getElementById('mensaje-espera');
    
    if (data.ganador === "Esperando..." || data.ganador === "Actualizando...") return;

    // 1. Ocultar botones y mostrar mensaje centrado
    document.getElementById('controles-juego').style.display = 'none'; 
    msgArea.style.display = 'flex'; // Usamos flex para centrar contenido

    // 2. Definir resultado
    let resultadoHTML = (opcionElegida !== null && String(opcionElegida) === String(data.ganador)) 
        ? "<h1 style='color: lime;'>¡GANASTE! 🎉</h1>" 
        : (opcionElegida !== null ? "<h1 style='color: red;'>MÁS SUERTE... 💀</h1>" : "<h1 style='color: #ffa500;'>PIERDE $50 POR NO APOSTAR 💸</h1>");

    // 3. Añadir el mensaje de espera permanente
    msgArea.innerHTML = `
        <div style="width: 100%;">
            ${resultadoHTML}
            <div style="margin-top: 20px; border-top: 1px solid #444; padding-top: 15px;">
                <h2 style="color: gold; font-size: 1.4rem;">RONDA TERMINADA</h2>
                <p>Espera a que el host inicie la siguiente... 🍀</p>
            </div>
        </div>
    `;

    // 4. Actualizar saldo
    if (data.players[miNombre]) {
        currentPuntos = data.players[miNombre].puntos;
        document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    }
});

// ESTE ES EL ÚNICO NEW_GAME QUE DEBE EXISTIR
socket.on('new_game', (game) => {
    if (currentPuntos <= 0) { mostrarBancaRota(); return; }
    
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    
    renderizarBotones(game.options);
    opcionElegida = null;
    montoElegido = 0;
});

socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    if (currentPuntos > 0 && document.getElementById('mensaje-espera').innerHTML.includes("BANCA ROTA")) {
        document.getElementById('mensaje-espera').style.display = 'none';
        document.getElementById('controles-juego').style.display = 'block';
    }
});
