from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cumple_secreto_2026'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# --- VARIABLES GLOBALES ---
players = {} 
current_game = {
    "view": "ninguna", 
    "options": [],
    "status": "esperando", 
    "ronda": 1
}

# --- FUNCIONES DE APOYO ---
def obtener_estado_apuestas():
    total = len(players)
    if total == 0: return "0/0"
    apostaron = sum(1 for p in players.values() if p.get('aposto', False))
    return f"{apostaron}/{total}"

def ordenar_jugadores():
    return dict(sorted(players.items(), key=lambda item: (-item[1]['puntos'], item[0])))

def estado_global():
    return {
        'players': players,
        'ranking': ordenar_jugadores(),
        'game': current_game,
        'conteo': obtener_estado_apuestas()
    }

def emitir_estado_global():
    data = estado_global()
    socketio.emit('state_update', data)
    socketio.emit('admin_update', {'players': players, 'game': current_game})
    socketio.emit('ranking_update', {'players': data['ranking'], 'game': current_game})
    socketio.emit('actualizar_contador', {'conteo': data['conteo']})

def reiniciar_ronda():
    current_game['view'] = 'ninguna'
    current_game['options'] = []
    current_game['status'] = 'esperando'
    current_game['ronda'] = 1

# --- RUTAS ---
@app.route('/')
def index(): return render_template('index.html')

@app.route('/juego')
def juego(): return render_template('juego.html')

@app.route('/admin_panel_secret')
def admin(): return render_template('admin.html')

@app.route('/ranking')
def ranking():
    jugadores_ordenados = sorted(players.items(), key=lambda x: (-x[1]['puntos'], x[0]))
    return render_template('ranking.html', ranking=jugadores_ordenados)

# --- EVENTOS ---
@socketio.on('join')
def handle_join(data):
    name = data.get('name')
    if not name: return
    if name not in players:
        players[name] = {'puntos': 1000, 'aposto': False, 'apuesta_valor': 0, 'opcion': None}
    
    emit('update_data', {
        'puntos': players[name]['puntos'], 
        'game': current_game,
        'players': players
    }, broadcast=False)
    emitir_estado_global()

@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']
    
    if user in players and players[user]['puntos'] >= monto:
        players[user]['puntos'] -= monto
        players[user]['aposto'] = True
        players[user]['apuesta_valor'] = monto
        players[user]['opcion'] = opcion
        emit('update_puntos', {'puntos': players[user]['puntos']}, broadcast=False)
        emitir_estado_global()

@socketio.on('admin_change_view')
def change_view(data):
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando'
    emit('new_game', current_game, broadcast=True)
    emitir_estado_global()

@socketio.on('admin_next_round')
def next_round():
    current_game['ronda'] += 1
    current_game['status'] = 'apostando'
    for user in players:
        players[user]['aposto'] = False
        players[user]['opcion'] = None
        players[user]['apuesta_valor'] = 0
    emit('new_game', current_game, broadcast=True)
    emitir_estado_global()

@socketio.on('admin_give_money_specific')
def handle_give_money(data):
    name = data['name']
    monto = int(data['monto'])
    if name in players:
        players[name]['puntos'] += monto
        emitir_estado_global()

@socketio.on('admin_give_random')
def handle_random_money():
    for user in players:
        regalo = random.randint(50, 500)
        players[user]['puntos'] += regalo
    emitir_estado_global()

@socketio.on('admin_reset_money_only')
def handle_reset_money():
    for user in players:
        players[user]['puntos'] = 1000
        players[user]['aposto'] = False
        players[user]['apuesta_valor'] = 0
        players[user]['opcion'] = None
    reiniciar_ronda()
    emit('money_reset_done', {'players': players, 'game': current_game}, broadcast=True)
    emitir_estado_global()

@socketio.on('admin_remove_player')
def handle_remove_player(data):
    name = data['name']
    if name in players:
        del players[name]
        emit('player_kicked', {'target': name}, broadcast=True)
        emitir_estado_global()

@socketio.on('admin_reset_all')
def handle_reset_all():
    global players
    players.clear()
    reiniciar_ronda()
    emit('game_reset_done', broadcast=True)
    emitir_estado_global()
# --- EVENTO ADMIN: CAMBIAR VISUAL ---
@socketio.on('admin_start_round')
def admin_start_round(data):
    # Esto es lo que inicia una ronda: pide visual y opciones
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando'
    current_game['ronda'] += 1
    
    # Limpiamos apuestas anteriores al iniciar nueva ronda
    for name in players:
        players[name]['aposto'] = False
        players[name]['apuesta_valor'] = 0
        players[name]['opcion'] = None
        
    emit('new_game', current_game, broadcast=True)
    emitir_estado_global()

@socketio.on('admin_resolve')
def resolve(data):
    ganador = data['ganador']
    current_game['status'] = 'finalizada'

    for user, info in players.items():
        if info['aposto']:
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
        else:
            players[user]['puntos'] = max(0, players[user]['puntos'] - 50)
        
        players[user]['aposto'] = False # Limpiar estado
            
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)
    emitir_estado_global()

# Agrega esto para que el admin siempre tenga la lista al dÃ­a
@socketio.on('admin_get_players')
def get_players():
    emit('admin_update', {'players': players, 'game': current_game}, broadcast=False)
    emit('state_update', estado_global(), broadcast=False)
@socketio.on('admin_refund_bets')
def refund_bets():
    for name, info in players.items():
        if info['aposto']:
            players[name]['puntos'] += info['apuesta_valor']
            players[name]['aposto'] = False
            players[name]['apuesta_valor'] = 0
            players[name]['opcion'] = None
    emitir_estado_global()
if __name__ == '__main__':
    socketio.run(app, debug=True)
