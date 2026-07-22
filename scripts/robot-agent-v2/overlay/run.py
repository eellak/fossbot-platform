from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from multiprocessing import freeze_support
from flask_babel import Babel
from blockly_server.extensions import db
from blockly_server.config import Config
import webbrowser
import blockly_server.app.control_utils.utils as utils
import os


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


def create_app():
    # Initialize Flask app
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
    print(template_dir)
    # Create the Flask app with the specified directories
    app = Flask(__name__) #, template_folder=template_dir, static_folder=static_dir)

    app.config.from_object(Config)

    # Initialize Flask extensions
    CORS(app)
    socketio = SocketIO(
        app,
        cors_allowed_origins=_socketio_allowed_origins(),
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
