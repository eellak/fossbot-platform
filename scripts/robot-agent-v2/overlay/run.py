from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from multiprocessing import freeze_support
from flask_babel import Babel
from blockly_server.extensions import db
from blockly_server.config import Config
import webbrowser
import blockly_server.app.control_utils.utils as utils
import os
import socket
import subprocess


def _socketio_allowed_origins():
    configured = os.getenv('SOCKETIO_ALLOWED_ORIGINS', '').strip()
    if configured == '*':
        return '*'

    origins = [
        origin.strip()
        for origin in configured.split(',')
        if origin.strip()
    ]
    return origins or None


def _network_addresses():
    try:
        output = subprocess.check_output(
            ['hostname', '-I'],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return [
            address
            for address in output.split()
            if address and not address.startswith('127.')
        ]
    except Exception:
        return []


def create_app():
    # Initialize Flask app
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
    print(template_dir)
    # Create the Flask app with the specified directories
    app = Flask(__name__) #, template_folder=template_dir, static_folder=static_dir)

    app.config.from_object(Config)

    @app.get('/api/fossbot/discovery')
    def fossbot_discovery():
        """Small CORS-readable identity endpoint used by browser LAN scans."""
        hostname = socket.gethostname()
        return jsonify({
            'service': 'fossbot-agent',
            'protocolVersion': '1.0',
            'agentVersion': '2.6.0',
            'hostname': hostname,
            'localName': f'{hostname}.local',
            'port': Config.PORT,
            'addresses': _network_addresses(),
            'capabilities': [
                'programs', 'interactive', 'rc', 'telemetry', 'oled-menu', 'camera',
                'object-detection',
                *(
                    ['depth-estimation']
                    if (
                        os.path.isfile('/usr/share/imx500-models/fossbot_fastdepth.rpk')
                        and os.path.isfile('/usr/local/lib/fossbot/fastdepth-camera.py')
                    )
                    else []
                ),
                'aruco',
                'road-detection',
            ],
        })

    # Initialize Flask extensions
    # Chrome's Local Network Access / Private Network Access preflight requires
    # this header before an HTTPS-hosted platform may read the robot's LAN
    # discovery response.
    CORS(app, allow_private_network=True)
    socketio = SocketIO(
        app,
        cors_allowed_origins=_socketio_allowed_origins(),
        # Hardware, camera and program workers use real OS threads/processes.
        # Eventlet cannot safely emit binary camera frames from those threads.
        async_mode='threading',
    )
    #db = SQLAlchemy(app)
    db.init_app(app)

    babel = Babel(app, locale_selector=utils.get_locale)

    # Import routes
    from blockly_server.app.routing.routes import routes_bp
    app.register_blueprint(routes_bp, url_prefix='')

    # Import socketio events
    from blockly_server.app.socketio_routing.socketio_events import register_socketio_events
    register_socketio_events(socketio)

    # Initialize db, files and folders
    utils.initialize_app()

    with app.app_context():
        db.create_all()

    if not Config.DOCKER:
        if Config.AUTOSTART_BROWSER:
            webbrowser.open_new(f"http://{Config.BROWSER_HOST}:{Config.PORT}")

    return app, socketio


def main():
    freeze_support()
    app, socketio = create_app()
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        allow_unsafe_werkzeug=True,
    )


if __name__ == '__main__':
    main()
