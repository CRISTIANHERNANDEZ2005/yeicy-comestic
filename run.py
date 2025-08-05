# run.py
import os
from app import create_app
from config import config_by_name

flask_env = os.getenv('FLASK_ENV', 'production')
app = create_app(config_by_name[flask_env])

if __name__ == '__main__':
    # Solo activar debug si estamos en desarrollo
    debug_mode = flask_env == 'development'
    app.run(debug=debug_mode)