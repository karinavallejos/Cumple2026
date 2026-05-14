from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cumple_secreto_2026'
# Usamos gevent para manejar múltiples conexiones de los 45 invitados
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# --- VARIABLES GLOBALES ---
players = {} 
current_game = {
    "view": "ninguna", 
    "options": [],
    "status": "esperando", # Estado inicial para mostrar mensaje de bienvenida
    "ronda": 1
}

# --- FUNCIONES DE APOYO ---
def obtener_estado_apuestas():
    """Calcula cuántos han apostado del total actual"""
    total = len(players)
    if total == 0: return "0/0"
    # Cuenta cuántos tienen el estado 'aposto' en True
    apostaron = sum(1 for p in players.values() if p.get('aposto', False))
    return f"{apostaron}/{total}"

# --- RUTAS DE NAVEGACIÓN ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/juego')
def juego(): return render_template('juego.html')

@app.route('/admin_panel_secret')
def admin(): return render_template('admin.html')

@app.route('/ranking')
def ranking():
    """Ordena por puntos (desc) y luego por nombre (asc)"""
    jugadores_ordenados = sorted(
        players.items(), 
        key=lambda x: (-x[1]['puntos'], x[0])
    )
    return render_template('ranking.html', ranking=jugadores_ordenados)

# --- EVENTOS DE SOCKET (JUGADORES) ---

@socketio.on('join')
def handle_join(data):
    name = data.get('name')
    if not name: return

    if name not in players:
        # Inicialización estándar de puntos y estado
        players[name] = {'puntos': 1000, 'aposto': False, 'apuesta_valor': 0, 'opcion': None}
    
    # Envía datos al jugador que entra (puntos y estado del juego)
    emit('update_data', {'puntos': players[name]['puntos'], 'game': current_game}, broadcast=False)
    
    # Actualiza la lista del Admin y el contador X/Total
    emit('round_result', {'ganador': 'Actualizando...', 'players': players}, broadcast=True)
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']
    
    # 1. Validación de apuesta mínima de $50
    if monto < 50: return 

    # 2. Verificación de fondos (Evita apuestas negativas o mayores al saldo)
    if user in players and players[user]['puntos'] >= monto:
        players[user]['puntos'] -= monto # Descuento inmediato
        players[user]['aposto'] = True
        players[user]['apuesta_valor'] = monto
        players[user]['opcion'] = opcion
        
        # Notificar saldo actualizado al jugador
        emit('update_puntos', {'puntos': players[user]['puntos']}, broadcast=False)
        # Actualizar contador de apuestas para el Admin
        emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

# --- EVENTOS DE SOCKET (ADMINISTRADOR) ---

@socketio.on('admin_change_view')
def change_view(data):
    """Cambia la visual de todos los invitados (Dados, Cartas, etc.)"""
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando' # Habilita la ronda
    emit('new_game', current_game, broadcast=True)

@socketio.on('admin_resolve')
def resolve(data):
    """Paga premios y aplica multas de $50"""
    ganador = data['ganador']
    for user, info in players.items():
        if info['aposto']:
            # Si acertó, recupera su apuesta + ganancia (doble)
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
            # El estado se limpia para la próxima ronda
            players[user]['aposto'] = False
        else:
            # MULTA: Si no apostó nada, pierde $50 automáticamente
            players[user]['puntos'] -= 50
        
        # El dinero nunca puede ser menor a 0 (Evita bugs visuales)
        if players[user]['puntos'] < 0: players[user]['puntos'] = 0
            
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)

@socketio.on('admin_next_round')
def next_round():
    """Limpia el tablero y sube el número de ronda"""
    current_game['ronda'] += 1
    current_game['status'] = 'apostando'
    # Limpiamos estados de apuesta internos
    for user in players:
        players[user]['aposto'] = False
        players[user]['opcion'] = None
        
    emit('new_game', current_game, broadcast=True)
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_give_money_specific')
def handle_give_money(data):
    """Otorga un monto específico (Bono de rescate para Banca Rota)"""
    name = data['name']
    monto = int(data['monto'])
    if name in players:
        players[name]['puntos'] += monto
        emit('update_puntos', {'puntos': players[name]['puntos']}, broadcast=True)
        emit('round_result', {'ganador': f'¡Bono para {name}!', 'players': players}, broadcast=True)

@socketio.on('admin_give_random')
def handle_random_money():
    """Reparte entre $50 y $500 a todos los conectados"""
    for user in players:
        regalo = random.randint(50, 500)
        players[user]['puntos'] += regalo
    emit('round_result', {'ganador': '¡REPARTICIÓN SORPRESA!', 'players': players}, broadcast=True)

@socketio.on('admin_reset_money_only')
def handle_reset_money():
    """Devuelve a todos a $1000 sin borrar la sesión"""
    for user in players:
        players[user]['puntos'] = 1000
        players[user]['aposto'] = False
    emit('round_result', {'ganador': '¡Dinero Reiniciado!', 'players': players}, broadcast=True)
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_remove_player')
def handle_remove_player(data):
    name = data['name']
    if name in players:
        del players[name]
        emit('player_kicked', {'target': name}, broadcast=True)
        emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)
        emit('round_result', {'ganador': 'Actualizando...', 'players': players}, broadcast=True)

@socketio.on('admin_reset_all')
def handle_reset_all():
    """Borra toda la base de datos de la sesión actual"""
    global players
    players.clear() 
    emit('game_reset_done', broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)
