import socketio

# create a Socket.IO server
sio = socketio.Server()

# event handler for new connections
@sio.event
def connect(sid, environ):
    print('New connection:', sid)

# event handler for messages
@sio.event
def message(sid, data):
    print('Message from', sid, ':', data)
    sio.emit('reply', 'Hello Client!')

# event handler for disconnections
@sio.event
def disconnect(sid):
    print('Disconnected:', sid)

# wrap with a WSGI application
app = socketio.WSGIApp(sio)

# run the server
if __name__ == '__main__':
    from gevent.pywsgi import WSGIServer
    http_server = WSGIServer(('', 5000), app)
    http_server.serve_forever()