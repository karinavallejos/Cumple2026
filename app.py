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
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

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
        emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_change_view')
def change_view(data):
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando' 
    emit('new_game', current_game, broadcast=True)

@socketio.on('admin_resolve')
def resolve(data):
    ganador = data['ganador']
    for user, info in players.items():
        if info['aposto']:
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
            players[user]['aposto'] = False
        else:
            players[user]['puntos'] -= 50
        
        if players[user]['puntos'] < 0: players[user]['puntos'] = 0
            
    # ESTO ES NECESARIO PARA QUE EL JUGADOR VEA EL RESULTADO
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)

@socketio.on('admin_next_round')
def next_round():
    current_game['ronda'] += 1
    current_game['status'] = 'apostando'
    for user in players:
        players[user]['aposto'] = False
        players[user]['opcion'] = None
    emit('new_game', current_game, broadcast=True)
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_give_money_specific')
def handle_give_money(data):
    name = data['name']
    monto = int(data['monto'])
    if name in players:
        players[name]['puntos'] += monto
        emit('update_puntos', {'puntos': players[name]['puntos']}, broadcast=True)

@socketio.on('admin_give_random')
def handle_random_money():
    for user in players:
        regalo = random.randint(50, 500)
        players[user]['puntos'] += regalo
    emit('update_puntos', {'puntos': 0}, broadcast=True) # Actualizar globalmente

@socketio.on('admin_reset_money_only')
def handle_reset_money():
    for user in players:
        players[user]['puntos'] = 1000
        players[user]['aposto'] = False
    emit('update_puntos', {'puntos': 1000}, broadcast=True)
    emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_remove_player')
def handle_remove_player(data):
    name = data['name']
    if name in players:
        del players[name]
        emit('player_kicked', {'target': name}, broadcast=True)
        emit('actualizar_contador', {'conteo': obtener_estado_apuestas()}, broadcast=True)

@socketio.on('admin_reset_all')
def handle_reset_all():
    global players
    players.clear() 
    emit('game_reset_done', broadcast=True)
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
    emit('admin_update', {'players': players}, broadcast=False) # Admin recibe lista

@socketio.on('admin_resolve')
def resolve(data):
    ganador = data['ganador']
    for user, info in players.items():
        if info['aposto']:
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
        else:
            players[user]['puntos'] = max(0, players[user]['puntos'] - 50)
        
        players[user]['aposto'] = False # Limpiar estado
            
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)
    emit('admin_update', {'players': players}, broadcast=True) # Admin ve dinero en tiempo real

# Agrega esto para que el admin siempre tenga la lista al día
@socketio.on('admin_get_players')
def get_players():
    emit('admin_update', {'players': players}, broadcast=False)
if __name__ == '__main__':
    socketio.run(app, debug=True)
