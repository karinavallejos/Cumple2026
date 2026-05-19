
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Casino Vegas - Juego</title>
    <link rel="stylesheet" href="/static/style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
    <style>
        .header-vegas img { width: 170px; max-width: 45vw; margin-bottom: 2px; }
        #ronda-display { color: gold; font-weight: bold; font-size: 0.85rem; margin-bottom: 2px; text-transform: uppercase; }
        .puntos-header { display: inline-block; margin: 0 auto; padding: 5px 45px; border: 3px solid gold; border-radius: 50px; background: rgba(255, 215, 0, 0.05); box-shadow: 0 0 20px 5px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2); }
        #display-puntos { font-size: 2.6rem; color: white; font-weight: bold; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 2px 2px 5px black; }
        .grid-apuestas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%; max-width: 340px; margin: 15px auto; justify-items: center; }
        .circulo-btn { width: 72px; height: 72px; border-radius: 50%; border: 2px solid gold; background: #222; color: white; font-weight: bold; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .circulo-btn.selected-money { background: gold; color: black; box-shadow: 0 0 15px gold; transform: scale(1.05); }
        .all-in { background: #ff4444 !important; border-color: white !important; color: white !important; }
        .btn-confirmar { width: 100%; max-width: 320px; height: 55px; background: #00ff00; color: black; font-weight: bold; font-size: 1.3rem; border-radius: 30px; border: none; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,255,0,0.4); cursor: pointer; }
        #modal-ranking { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); backdrop-filter: blur(5px); }
        .modal-content { background-color: #111; margin: 10% auto; padding: 20px; border: 2px solid gold; width: 85%; max-width: 400px; border-radius: 20px; text-align: center; box-shadow: 0 0 30px gold; }
        .tabla-ranking { width: 100%; margin-top: 15px; border-collapse: collapse; }
        .tabla-ranking th { color: gold; border-bottom: 1px solid gold; padding: 10px; }
        .tabla-ranking td { padding: 8px; border-bottom: 1px solid #222; }
    </style>
</head>
<body style="background-color: black; color: white; margin: 0; display: flex; flex-direction: column; min-height: 100vh; text-align: center; font-family: sans-serif;">

    <div style="padding: 5px 0 10px 0; background: #111; border-bottom: 2px solid #333;">
        <div class="header-vegas">
            <img src="/static/logo-vegas.svg" alt="Las Vegas">
        </div>
        <div id="ronda-display">RONDA 1</div>
        <div class="puntos-header">
            <span id="display-puntos">$1000</span>
        </div>
    </div>

    <div style="flex: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div id="mensaje-espera" style="display: none;"></div>

        <div id="controles-juego" style="width: 100%;">
            <h3 style="color: gold; text-transform: uppercase; margin-bottom: 10px; font-size: 1rem;">Elige tu opción</h3>
            <div id="contenedor-opciones" class="grid-opciones"></div>

            <hr style="border: 0.5px solid #333; width: 100%; margin: 15px 0;">

            <h3 style="color: gold; text-transform: uppercase; margin-bottom: 10px; font-size: 1rem;">Monto de Apuesta</h3>
            
            <div class="grid-apuestas">
                <button class="circulo-btn apuesta-btn" onclick="seleccionarPlata(50, this)">$50</button>
                <button class="circulo-btn apuesta-btn" onclick="seleccionarPlata(100, this)">$100</button>
                <button class="circulo-btn apuesta-btn" onclick="seleccionarPlata(200, this)">$200</button>
                <button class="circulo-btn apuesta-btn" onclick="seleccionarPlata(300, this)">$300</button>
                <button class="circulo-btn apuesta-btn" onclick="seleccionarPlata(500, this)">$500</button>
                <button class="circulo-btn apuesta-btn all-in" onclick="seleccionarPlata('ALL', this)">ALL IN</button>
            </div>

            <button onclick="confirmarApuesta()" class="btn-confirmar">APOSTAR AHORA 🎰</button>
        </div>
    </div>

    <div style="padding: 12px; background: #0a0a0a; border-top: 1px solid #333;">
        <div onclick="abrirRanking()" style="cursor: pointer; color: gold; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🏆</span> VER TABLA DE POSICIONES
        </div>
    </div>

    <div id="modal-ranking">
        <div class="modal-content">
            <h2 style="color: gold; text-shadow: 0 0 10px gold;">🏆 RANKING</h2>
            <div style="max-height: 300px; overflow-y: auto;">
                <table class="tabla-ranking">
                    <thead>
                        <tr><th>#</th><th style="text-align: left;">JUGADOR</th><th style="text-align: right;">PUNTOS</th></tr>
                    </thead>
                    <tbody id="tabla-body-ranking"></tbody>
                </table>
            </div>
            <button onclick="cerrarRanking()" style="margin-top: 20px; width: 100%; padding: 12px; background: gold; color: black; font-weight: bold; border-radius: 10px; border: none; cursor: pointer;">VOLVER AL JUEGO</button>
        </div>
    </div>

    <script src="/static/script.js"></script>
    <script>
        function abrirRanking() {
            const body = document.getElementById('tabla-body-ranking');
            body.innerHTML = ""; 
            if (typeof listaGlobalJugadores !== 'undefined') {
                const ordenados = Object.entries(listaGlobalJugadores).sort((a, b) => b[1].puntos - a[1].puntos);
                ordenados.forEach((jugador, index) => {
                    body.innerHTML += `<tr><td style="color: gold;">${index + 1}</td><td style="text-align: left;">${jugador[0]}</td><td style="text-align: right; color: #00ff00; font-weight: bold;">$${jugador[1].puntos}</td></tr>`;
                });
            }
            document.getElementById('modal-ranking').style.display = 'block';
        }
        function cerrarRanking() { document.getElementById('modal-ranking').style.display = 'none'; }
    </script>
</body>
</html>

```

### 2. `script.js` (Completo)

Copia todo este contenido y reemplaza el archivo actual.

```javascript
const socket = io();
let miNombre = localStorage.getItem('casino_name');
let currentPuntos = 1000;
let opcionElegida = null;
let montoElegido = 0;
let listaGlobalJugadores = {};

socket.on('connect', () => {
    if (!miNombre) { window.location.href = "/"; }
    socket.emit('join', { name: miNombre });
});

function mostrarBancaRota() {
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');
    if (controles) controles.style.display = 'none';
    if (msgArea) {
        msgArea.style.display = 'block';
        msgArea.innerHTML = `<h1 style="color: #ff4444; font-size: 3rem; text-shadow: 0 0 15px red;">¡BANCA ROTA! 💀</h1><p style="color: white; font-size: 1.2rem;">Has perdido todo tu dinero.</p>`;
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
    if (monto === 'ALL') {
        montoElegido = currentPuntos;
    } else {
        montoElegido = parseInt(monto);
    }
    document.querySelectorAll('.apuesta-btn').forEach(b => b.classList.remove('selected-money'));
    if (elemento) elemento.classList.add('selected-money');
}

function confirmarApuesta() {
    if (currentPuntos <= 0 && opcionElegida === null) { mostrarBancaRota(); return; }
    if (montoElegido <= 0) { alert("Elige un monto de apuesta."); return; }
    if (!opcionElegida) { alert("Elige una opción primero."); return; }
    if (montoElegido > currentPuntos) { alert("¡No tienes suficiente dinero!"); return; }

    if (confirm(`¿Apostar $${montoElegido} al ${opcionElegida}?`)) {
        socket.emit('place_bet', { name: miNombre, monto: montoElegido, opcion: opcionElegida });
        document.getElementById('controles-juego').style.display = 'none';
        const msg = document.getElementById('mensaje-espera');
        msg.innerHTML = `<h2 style="color: gold;">⌛ APUESTA ENVIADA</h2><p>Espera a que el host entregue los resultados...</p>`;
        msg.style.display = 'block';
    }
}

socket.on('update_data', (data) => {
    currentPuntos = data.puntos;
    listaGlobalJugadores = data.players || {}; 
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    document.getElementById('ronda-display').innerText = "RONDA " + data.game.ronda;
    const msgArea = document.getElementById('mensaje-espera');
    const controles = document.getElementById('controles-juego');
    if (currentPuntos <= 0) { mostrarBancaRota(); } else {
        controles.style.display = 'block';
        msgArea.style.display = 'none';
        renderizarBotones(data.game.options);
    }
});

socket.on('round_result', (data) => {
    const ganador = data.ganador;
    const msgArea = document.getElementById('mensaje-espera');
    listaGlobalJugadores = data.players;
    if (ganador === "Esperando..." || ganador === "Actualizando..." || ganador === "REINICIO DE DINERO") return;
    msgArea.style.display = 'block';
    document.getElementById('controles-juego').style.display = 'none';
    msgArea.innerHTML = (opcionElegida !== null && String(opcionElegida) === String(ganador)) 
        ? "<h1 style='color: lime; font-size: 3rem;'>¡GANASTE! 🎉</h1>" 
        : "<h1 style='color: red; font-size: 2.5rem;'>MÁS SUERTE PARA LA PRÓXIMA 💀</h1>";
    if (data.players[miNombre]) { currentPuntos = data.players[miNombre].puntos; document.getElementById('display-puntos').innerText = "$" + currentPuntos; }
    setTimeout(() => {
        if (currentPuntos <= 0) { mostrarBancaRota(); } else {
            msgArea.innerHTML = `<h2 style="color: gold;">RONDA TERMINADA</h2><p>Espera al host... 🍀</p>`;
            opcionElegida = null; montoElegido = 0;
        }
    }, 4000);
});

socket.on('update_puntos', (data) => {
    currentPuntos = data.puntos;
    document.getElementById('display-puntos').innerText = "$" + currentPuntos;
    if (currentPuntos > 0) {
        document.getElementById('mensaje-espera').style.display = 'none';
        document.getElementById('controles-juego').style.display = 'block';
    }
});

socket.on('new_game', (game) => {
    if (currentPuntos <= 0) { mostrarBancaRota(); return; }
    document.getElementById('ronda-display').innerText = "RONDA " + game.ronda;
    document.getElementById('controles-juego').style.display = 'block';
    document.getElementById('mensaje-espera').style.display = 'none';
    renderizarBotones(game.options);
});

socket.on('game_reset_done', () => { localStorage.removeItem('casino_name'); window.location.href = "/"; });
socket.on('player_kicked', (data) => { if (miNombre === data.target) { localStorage.removeItem('casino_name'); window.location.href = "/"; } });
