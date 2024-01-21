from flask import Flask, render_template, send_from_directory, session, request
import os
import uuid
from flask_socketio import join_room, leave_room, SocketIO, emit
import json
server_ip = os.getenv("SOCKETIO_IP", "0.0.0.0")
server_port = int(os.getenv("SOCKETIO_PORT", "5000"))
socketio_namespace = os.getenv("SOCKETIO_NAMESPACE", "/godot")
fossbot_simapp_route = os.getenv("FOSSBOT_APP_ROUTE", "/godot")
fossbot_simcode_route = os.getenv("FOSSBOT_APP_ROUTE", "/godotcode")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "this_is_a_secret")
socketio = SocketIO(app, cors_allowed_origins="*")

def generate_session_id():
    return str(uuid.uuid4())


#---- Simulation Serve  ----
@app.route('/<session_id>')
def index(session_id):
    session.clear()
    if session_id == None:
        session_id = "123" #generate_session_id()
    session["session_id"] = session_id
    session["user_id"] = "1"
    #user_id = "1" #session.get("user_id")
    print(f'Current session id: {session_id}') #, user_id: {user_id}')
    if server_ip== "0.0.0.0":
        final_server_ip = "localhost"
    else:
        final_server_ip = server_ip
    return render_template('index.html', session_id=session_id, ws_ip=final_server_ip, ws_port=server_port, sio_namespace=socketio_namespace)


@app.route('/test/<session_id>')
def test(session_id):
    print(f"Test route called with session_id: {session_id}")
    socketio.emit("clientIncMessage", {"func": "test"},namespace=socketio_namespace, to=session_id)
    return "Test route called"


@app.route('/index.icon.png')
def serve_icon():
    return send_from_directory('static', 'index.icon.png')

@app.route('/index.js')
def serve_js():
    return send_from_directory('static', 'index.js')

@app.route('/index.wasm')
def serve_wasm():
    return send_from_directory('static', 'index.wasm')

@app.route('/index.pck')
def serve_pck():
    return send_from_directory('static', 'index.pck')


#---- Websocket routes ----

# @socketio.on('connect', namespace=socketio_namespace)
# def connect():
#     print('Client connected')  
#     print('session_id: ', session.get("session_id"))

#---- Godot routes ----

@socketio.on('godotConnect', namespace=socketio_namespace)
def godotconnect(data):
    data = json.loads(data)
    print('Godot connected: ', data)
    session.clear()
    join_room(data['session_id'])   

@socketio.on("godotMessage", namespace=socketio_namespace)
def godotMessage(data):    
    #user_id = data["user_id"]
    room = session.get("session_id")
    print(f"Message sent From Godot (to room {room}): {data}")
    socketio.emit("clientIncMessage", data,namespace=socketio_namespace, to=room)
    
@socketio.on("godotError", namespace=socketio_namespace)
def godotError(data):
    user_id = data["user_id"]
    print(f"Error sent From Godot (to user {user_id}): {data}")
    emit("godotError", data, to=user_id)

#---- Client routes ----    
@socketio.on('clientConnect', namespace=socketio_namespace)
def clientConnect(data):
    data = json.loads(data)
    session.clear()
    session["session_id"] = data['session_id']
    session["user_id"] = data['user_id']
    print(f'current session {session.get("session_id")}') 
    session_id = session.get("session_id")
    join_room(session_id)
    print('Client connected: ',session_id)

@socketio.on("clientMessage", namespace=socketio_namespace)
def clientMessage(data):
    data = json.loads(data)
    room = session.get("session_id")
    data["user_id"] = "1"#session.get("user_id")
    data["fossbot_name"] = "fossbot"
    print(f"Room: {room} & Message sent From Client: {data}")
    socketio.emit("godotIncMessage", data,namespace=socketio_namespace, to=room)
    


    

    
# @socketio.on("pythonConnect", namespace=socketio_namespace)
# def pythonConnect(data):
#     data = json.loads(data)
#     session_id = data["session_id"]
#     session["session_id"] = session_id
#     session["user_id"] = data["user_id"]
#     session["env_user"] = False
#     join_room(session_id)
#     print("Python connected")
#     print(f"Client joined room {session_id}")
#     emit("clientMessage", data, to=session_id)

# @socketio.on('browserConnect', namespace=socketio_namespace)
# def browserConnect(data):
#     data = json.loads(data)
#     session_id = data["session_id"]
#     session["env_user"] = False
#     join_room(session_id)
#     print('browserConnect')
#     print(f"Client joined room {session_id}")

# @socketio.on("message", namespace=socketio_namespace)
# def message(data):
#     print('--------------------------------------')
#     print(f"Message sent From Client: {data}")
#     emit("message", data)

# @socketio.on("clientMessage", namespace=socketio_namespace)
# def clientMessage(data):
#     data = json.loads(data)
#     room = session.get("session_id")
#     data["user_id"] = "1"#session.get("user_id")
#     data["fossbot_name"] = "fossbot"
#     print(f"Room: {room} & Message sent From Client: {data}")
#     emit("clientMessage", data, to=room)



@socketio.on("disconnect", namespace=socketio_namespace)
def disconnect():
    session_id = session.get("session_id")
    exit_func = "exit"
    if session.get("env_user", False):
        exit_func = "exit_env"
    if "user_id" in session:
        emit("clientMessage", {"func": exit_func, "user_id": session["user_id"]}, to=session_id)
    leave_room(session_id)
    print(f"Client from room {session_id} was removed.")

if __name__ == '__main__':
    socketio.run(app=app, debug=True, host=server_ip, port=server_port)
