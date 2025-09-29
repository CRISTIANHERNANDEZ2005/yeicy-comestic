"""
Punto de Entrada Principal de la Aplicación (Entry Point).

Este script es el responsable de iniciar la aplicación Flask. Su función principal
es:
1. Determinar el entorno de ejecución (desarrollo o producción) a través de la
   variable de entorno `FLASK_ENV`. Por defecto, asume 'production' para
   mayor seguridad.
2. Utilizar la fábrica de aplicaciones `create_app` para construir una instancia
   de la aplicación con la configuración correspondiente al entorno detectado.
3. Si el script se ejecuta directamente (por ejemplo, `python run.py`), inicia
   el servidor de desarrollo de Flask. El modo de depuración (`debug=True`)
   se activa automáticamente solo si `FLASK_ENV` está configurado como
   'development'.

Este archivo no debe ser modificado para añadir lógica de la aplicación. Su único
propósito es ser el punto de arranque.
"""
import os
from app import create_app
from config import config_by_name

# Lee la variable de entorno FLASK_ENV para determinar la configuración a cargar.
# Si no se especifica, se utiliza 'production' como valor predeterminado seguro.
flask_env = os.getenv('FLASK_ENV', 'production')
# Crea la instancia de la aplicación Flask utilizando la fábrica de aplicaciones
# y la clase de configuración correspondiente al entorno.
app = create_app(config_by_name[flask_env])

# Este bloque se ejecuta solo cuando el script es llamado directamente.
# Es el método estándar para ejecutar la aplicación en un entorno de desarrollo local.
if __name__ == '__main__':
    # El modo de depuración se habilita únicamente si el entorno es 'development'.
    # Esto activa el recargado automático y el depurador interactivo.
    debug_mode = flask_env == 'development'
    app.run(debug=debug_mode)
