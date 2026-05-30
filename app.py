from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import random
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cumple_secreto_2026'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')
ROULETTE_COLORS = ['ROJO', 'NEGRO', 'VERDE', 'AZUL', 'BLANCO', 'AMARILLO']
BUZZER_TABLES = ['Elvis', 'Circus', 'Bellagio', 'All in', 'Flamingo', 'Jackpot', 'Luxor']

# --- VARIABLES GLOBALES ---
players = {}
current_game = {
    "view": "ninguna",
    "options": [],
    "status": "esperando",
    "ronda": 1
}
buzzer_game = {
    "active": False,
    "enabled": False,
    "song": 0,
    "started_at": None,
    "buzzes": [],
    "tables": {table: 0 for table in BUZZER_TABLES},
    "players": {}
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
        'conteo': obtener_estado_apuestas(),
        'buzzer': buzzer_game
    }

def emitir_estado_global():
    data = estado_global()
    socketio.emit('state_update', data)
    socketio.emit('admin_update', {'players': players, 'game': current_game})
    socketio.emit('ranking_update', {'players': data['ranking'], 'game': current_game})
    socketio.emit('actualizar_contador', {'conteo': data['conteo']})
    socketio.emit('buzzer_state', buzzer_game)

def reiniciar_ronda():
    current_game['view'] = 'ninguna'
    current_game['options'] = []
    current_game['status'] = 'esperando'
    current_game['ronda'] = 1

def emitir_chicharra():
    socketio.emit('buzzer_state', buzzer_game)
    socketio.emit('admin_buzzer_update', buzzer_game)

def resetear_chicharra():
    buzzer_game['active'] = False
    buzzer_game['enabled'] = False
    buzzer_game['song'] = 0
    buzzer_game['started_at'] = None
    buzzer_game['buzzes'] = []
    buzzer_game['tables'] = {table: 0 for table in BUZZER_TABLES}
    buzzer_game['players'] = {}

def puntos_iniciales_jugador():
    if current_game['status'] == 'esperando' and current_game['ronda'] == 1:
        return 1000

    descuento = current_game['ronda'] * 50
    return max(0, 1000 - descuento)

def preparar_siguiente_ronda():
    if current_game['status'] in ['apostando', 'girando']:
        return False

    if current_game['status'] == 'finalizada':
        current_game['ronda'] += 1

    current_game['view'] = 'ninguna'
    current_game['options'] = []
    current_game['status'] = 'preparando'

    for user in players:
        players[user]['aposto'] = False
        players[user]['opcion'] = None
        players[user]['apuesta_valor'] = 0
        players[user]['apuesta_ts'] = None

    return True

def finalizar_ronda(ganador):
    current_game['status'] = 'finalizada'
    ganador_rapido = None
    dulces_ganadores = []

    for user, info in players.items():
        if info['aposto']:
            if str(info['opcion']) == str(ganador):
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
                if current_game['view'] == 'dulces' and info.get('apuesta_ts') is not None:
                    dulces_ganadores.append({
                        'name': user,
                        'apuesta_ts': info['apuesta_ts']
                    })
        else:
            players[user]['puntos'] = max(0, players[user]['puntos'] - 50)

        players[user]['aposto'] = False
        players[user]['apuesta_valor'] = 0
        players[user]['opcion'] = None
        players[user]['apuesta_ts'] = None

    if dulces_ganadores:
        ganador_rapido = min(dulces_ganadores, key=lambda item: item['apuesta_ts'])['name']

    socketio.emit('round_result', {'ganador': ganador, 'players': players, 'ganador_rapido_dulces': ganador_rapido})
    emitir_estado_global()

def finalizar_ruleta(ganador):
    socketio.sleep(5)
    finalizar_ronda(ganador)

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

@app.route('/ruleta')
def ruleta(): return render_template('ruleta.html')

# --- EVENTOS ---
@socketio.on('join')
def handle_join(data):
    name = data.get('name')
    if not name: return
    if name not in players:
        players[name] = {'puntos': puntos_iniciales_jugador(), 'aposto': False, 'apuesta_valor': 0, 'opcion': None, 'apuesta_ts': None}

    emit('update_data', {
        'puntos': players[name]['puntos'],
        'game': current_game,
        'players': players,
        'buzzer': buzzer_game
    }, broadcast=False)
    emitir_estado_global()

@socketio.on('get_state')
def get_state():
    emit('state_update', estado_global(), broadcast=False)
    emit('buzzer_state', buzzer_game, broadcast=False)

@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']

    if current_game['status'] != 'apostando':
        return

    if user in players and players[user].get('aposto'):
        return

    if user in players and players[user]['puntos'] >= monto:
        players[user]['puntos'] -= monto
        players[user]['aposto'] = True
        players[user]['apuesta_valor'] = monto
        players[user]['opcion'] = opcion
        players[user]['apuesta_ts'] = time.time()
        emit('update_puntos', {'puntos': players[user]['puntos']}, broadcast=False)
        emitir_estado_global()

@socketio.on('admin_change_view')
def change_view(data):
    if current_game['status'] != 'preparando':
        emit('admin_error', {'message': 'Primero inicia una ronda nueva.'}, broadcast=False)
        return

    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando'
    emit('new_game', current_game, broadcast=True)
    emitir_estado_global()

@socketio.on('admin_reactivate_betting')
def reactivate_betting():
    if current_game['status'] != 'apostando' or not current_game['options']:
        emit('admin_error', {'message': 'Solo puedes reactivar la visual durante una ronda activa.'}, broadcast=False)
        return

    socketio.emit('reactivate_betting', {
        'game': current_game,
        'players': players
    })
    emitir_estado_global()

@socketio.on('admin_next_round')
def next_round():
    if not preparar_siguiente_ronda():
        emit('admin_error', {'message': 'Primero paga y finaliza la ronda actual.'}, broadcast=False)
        return

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
        players[user]['apuesta_ts'] = None
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
    resetear_chicharra()
    emit('game_reset_done', broadcast=True)
    emitir_estado_global()
    emitir_chicharra()
# --- EVENTO ADMIN: CAMBIAR VISUAL ---
@socketio.on('admin_start_round')
def admin_start_round(data):
    if not preparar_siguiente_ronda():
        emit('admin_error', {'message': 'Primero paga y finaliza la ronda actual.'}, broadcast=False)
        return

    emitir_estado_global()

@socketio.on('admin_resolve')
def resolve(data):
    if current_game['status'] != 'apostando':
        emit('admin_error', {'message': 'Inicia una ronda y elige una visual antes de pagar.'}, broadcast=False)
        return

    if current_game['view'] == 'especial':
        emit('admin_error', {'message': 'Para colores usa el boton ACTIVAR RULETA.'}, broadcast=False)
        return

    ganador = data['ganador']
    finalizar_ronda(ganador)

@socketio.on('admin_spin_roulette')
def spin_roulette():
    if current_game['status'] != 'apostando' or current_game['view'] != 'especial':
        emit('admin_error', {'message': 'La ruleta solo se puede activar en una ronda de colores.'}, broadcast=False)
        return

    opciones = current_game['options'] or ROULETTE_COLORS
    ganador = random.choice(opciones)
    current_game['status'] = 'girando'
    socketio.emit('roulette_spin', {
        'ganador': ganador,
        'colors': opciones,
        'duration': 4500
    })
    emitir_estado_global()
    socketio.start_background_task(finalizar_ruleta, ganador)

@socketio.on('admin_activate_buzzer')
def admin_activate_buzzer():
    buzzer_game['active'] = True
    buzzer_game['enabled'] = False
    buzzer_game['started_at'] = None
    buzzer_game['buzzes'] = []
    emitir_chicharra()

@socketio.on('admin_deactivate_buzzer')
def admin_deactivate_buzzer():
    buzzer_game['active'] = False
    buzzer_game['enabled'] = False
    buzzer_game['started_at'] = None
    buzzer_game['buzzes'] = []
    emitir_chicharra()

@socketio.on('player_join_buzzer')
def player_join_buzzer(data):
    name = data.get('name')
    table = data.get('table')
    if not name or table not in BUZZER_TABLES:
        emit('buzzer_error', {'message': 'Selecciona tu nombre y mesa.'}, broadcast=False)
        return

    buzzer_game['players'][name] = {'table': table}
    emit('buzzer_joined', {'name': name, 'table': table}, broadcast=False)
    emitir_chicharra()

@socketio.on('admin_start_song')
def admin_start_song():
    if not buzzer_game['active']:
        emit('admin_error', {'message': 'Primero activa el panel de chicharra.'}, broadcast=False)
        return

    buzzer_game['song'] += 1
    buzzer_game['enabled'] = True
    buzzer_game['started_at'] = time.time()
    buzzer_game['buzzes'] = []
    emitir_chicharra()

@socketio.on('player_buzz')
def player_buzz(data):
    name = data.get('name')
    table = data.get('table') or buzzer_game['players'].get(name, {}).get('table')
    if not buzzer_game['active'] or not buzzer_game['enabled'] or not buzzer_game['started_at']:
        return
    if not name or table not in BUZZER_TABLES:
        emit('buzzer_error', {'message': 'Selecciona tu nombre y mesa antes de tocar.'}, broadcast=False)
        return
    if any(item['name'] == name for item in buzzer_game['buzzes']):
        return

    buzzer_game['players'][name] = {'table': table}
    buzzer_game['buzzes'].append({
        'name': name,
        'table': table,
        'elapsed': round(time.time() - buzzer_game['started_at'], 3)
    })
    emitir_chicharra()

@socketio.on('admin_award_buzzer_point')
def admin_award_buzzer_point(data):
    table = data.get('table')
    delta = int(data.get('delta', 1))
    if table not in BUZZER_TABLES:
        return

    buzzer_game['tables'][table] += delta
    buzzer_game['enabled'] = False
    buzzer_game['started_at'] = None
    emitir_chicharra()

@socketio.on('admin_close_song')
def admin_close_song():
    buzzer_game['enabled'] = False
    buzzer_game['started_at'] = None
    emitir_chicharra()

@socketio.on('admin_adjust_table_score')
def admin_adjust_table_score(data):
    table = data.get('table')
    delta = int(data.get('delta', 0))
    if table not in BUZZER_TABLES:
        return

    buzzer_game['tables'][table] += delta
    emitir_chicharra()

# Agrega esto para que el admin siempre tenga la lista al dia
@socketio.on('admin_get_players')
def get_players():
    emit('admin_update', {'players': players, 'game': current_game}, broadcast=False)
    emit('state_update', estado_global(), broadcast=False)
    emit('admin_buzzer_update', buzzer_game, broadcast=False)
@socketio.on('admin_refund_bets')
def refund_bets():
    for name, info in players.items():
        if info['aposto']:
            players[name]['puntos'] += info['apuesta_valor']
            players[name]['aposto'] = False
            players[name]['apuesta_valor'] = 0
            players[name]['opcion'] = None
            players[name]['apuesta_ts'] = None
    emitir_estado_global()
if __name__ == '__main__':
    socketio.run(app, debug=True)
