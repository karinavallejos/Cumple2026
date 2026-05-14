from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template, request, session, redirect, url_for
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'cumple_secreto_2026'
socketio = SocketIO(app, cors_allowed_origins="*")

# Base de datos en memoria (para 3 horas está perfecto)
players = {} # {nombre: {puntos: 1000, aposto: False, apuesta_valor: 0, opcion: None}}
current_game = {
    "view": "dados", # dados, cartas, colores, random
    "options": ["1", "2", "3", "4", "5", "6"],
    "status": "apostando" # apostando, cerrado
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/juego')
def juego():
    if 'user' not in session: return redirect(url_for('index'))
    return render_template('juego.html', user=session['user'])

@app.route('/admin_panel_secret')
def admin():
    return render_template('admin.html')

# LÓGICA DE SOCKETS
@socketio.on('join')
def handle_join(data):
    name = data['name']
    session['user'] = name
    if name not in players:
        players[name] = {'puntos': 1000, 'aposto': False, 'apuesta_valor': 0, 'opcion': None}
    emit('update_data', {'puntos': players[name]['puntos'], 'game': current_game}, broadcast=False)

@socketio.on('place_bet')
def handle_bet(data):
    user = data['name']
    monto = int(data['monto'])
    opcion = data['opcion']

    if players[user]['puntos'] >= monto and current_game['status'] == 'apostando':
        players[user]['puntos'] -= monto
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
                players[user]['puntos'] += (info['apuesta_valor'] * 2)
            # Si perdió, ya se le restó al apostar
            players[user]['aposto'] = False
        else:
            # Penalización por no apostar
            players[user]['puntos'] -= 50
        
        if players[user]['puntos'] < 0: players[user]['puntos'] = 0
            
    emit('round_result', {'ganador': ganador, 'players': players}, broadcast=True)

@socketio.on('admin_change_view')
def change_view(data):
    current_game['view'] = data['view']
    current_game['options'] = data['options']
    current_game['status'] = 'apostando'
    emit('new_game', current_game, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)
