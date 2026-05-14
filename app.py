from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cumple_secreto_2026'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

players = {} 
current_game = {
    "view": "dados", 
    "options": ["1", "2", "3", "4", "5", "6"],
    "status": "apostando",
    "ronda": 1 # Nueva variable de ronda controlada por admin 
}

@app.route('/')
def index(): return render_template('index.html')

@app.route('/juego')
def juego(): return render_template('juego.html')

@app.route('/admin_panel_secret')
def admin(): return render_template('admin.html')

@socketio.on('join')
def handle_join(data):
    name = data['name']
    if name not in players:
        players[name] = {'puntos': 1000, 'aposto': False, 'apuesta_valor': 0, 'opcion': None}
    emit('update_data', {'puntos': players[name]['puntos'], 'game': current_game}, broadcast=False)
    emit('round_result', {'ganador': 'Actualizando...', 'players': players}, broadcast=True)

@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']
    if user in players and players[user]['puntos'] >= monto:
        players[user]['puntos'] -= monto # Se descuenta al apostar [cite: 373]
        players[user]['aposto'] = True
        players[user]['apuesta_valor'] = monto
        players[user]['opcion'] = opcion
        emit('update_puntos', {'puntos': players[user]['puntos']}, broadcast=False)

@socketio.on('admin_resolve')
def resolve(data):
    ganador = data['ganador']
    for user, info in players.items():
        if info['aposto']:
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2) # Gana: Duplica [cite: 373]
            # Si pierde, ya se descontó al inicio [cite: 374]
            players[user]['aposto'] = False
        else:
            players[user]['puntos'] -= 50 # No apuesta: -50 [cite: 374]
        
        if players[user]['puntos'] < 0: players[user]['puntos'] = 0
            
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)

@socketio.on('admin_next_round')
def next_round():
    current_game['ronda'] += 1
    current_game['status'] = 'apostando'
    emit('new_game', current_game, broadcast=True)

@socketio.on('admin_change_view')
def change_view(data):
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    emit('new_game', current_game, broadcast=True)

# 1. ELIMINAR A UN JUGADOR ESPECÍFICO 
@socketio.on('admin_remove_player')
def handle_remove_player(data):
    name = data['name']
    if name in players:
        del players[name]
        # Notificamos para que el navegador del jugador lo expulse [cite: 365]
        emit('player_kicked', {'target': name}, broadcast=True)
        # Actualizamos la lista del admin
        emit('round_result', {'ganador': f'Jugador {name} eliminado', 'players': players}, broadcast=True)

# 2. DAR DINERO A UN JUGADOR SELECCIONADO 
@socketio.on('admin_give_money_specific')
def handle_give_money(data):
    name = data['name']
    monto = int(data['monto'])
    if name in players:
        players[name]['puntos'] += monto
        emit('round_result', {'ganador': f'¡Bono para {name}!', 'players': players}, broadcast=True)

# 3. DAR DINERO AL AZAR A TODOS [cite: 327]
@socketio.on('admin_give_random')
def handle_random_money():
    for user in players:
        regalo = random.randint(50, 500)
        players[user]['puntos'] += regalo
    emit('round_result', {'ganador': '¡REPARTICIÓN SORPRESA!', 'players': players}, broadcast=True)

# 4. REINICIAR TODO EL JUEGO [cite: 322, 361]
@socketio.on('admin_reset_all')
def handle_reset_all():
    global players
    players.clear() 
    emit('game_reset_done', broadcast=True)
# Modifica la función de apuesta para avisar al admin en tiempo real
@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']
    
    # VALIDACIÓN DE APUESTA MÍNIMA
    if monto < 50:
        return # Simplemente no procesa la apuesta si es menor a 50

    if user in players and players[user]['puntos'] >= monto:
        players[user]['puntos'] -= monto
        players[user]['aposto'] = True
        players[user]['apuesta_valor'] = monto
        players[user]['opcion'] = opcion
        emit('update_puntos', {'puntos': players[user]['puntos']}, broadcast=False)

# NUEVA FUNCIÓN: Reiniciar solo el dinero
@socketio.on('admin_reset_money_only')
def handle_reset_money():
    for user in players:
        players[user]['puntos'] = 1000
        players[user]['aposto'] = False
        players[user]['apuesta_valor'] = 0
    # Avisamos a todos del nuevo saldo
    emit('round_result', {'ganador': '¡Dinero Reiniciado!', 'players': players}, broadcast=True)
if __name__ == '__main__':
    socketio.run(app, debug=True)
