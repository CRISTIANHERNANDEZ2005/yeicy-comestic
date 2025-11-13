"""
Módulo de Autenticación y Gestión de Usuarios (Cliente).

Este blueprint gestiona todas las operaciones relacionadas con la autenticación del cliente:
- Registro de nuevos usuarios.
- Inicio y cierre de sesión.
- Recuperación de contraseña en múltiples pasos.
- Gestión del perfil de usuario.
- Mantenimiento de la sesión a través de un middleware que utiliza JWT.

Adopta un enfoque híbrido, utilizando tanto sesiones de Flask-Login para la autenticación
en el servidor como tokens JWT para la comunicación con APIs y la persistencia en el cliente.
"""

# --- Importaciones de Flask y Librerías Estándar ---
import re
from datetime import datetime, timezone
from urllib.parse import quote

from flask import (
    Blueprint,
    current_app,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

# --- Importaciones de Extensiones y Terceros ---
from flask_login import current_user, login_user, logout_user

from app.extensions import bcrypt, db, login_manager

# --- Importaciones Locales de la Aplicación ---
from app.models.domains.user_models import Usuarios
from app.models.serializers import usuario_to_dict
from app.utils.jwt_utils import jwt_required

auth_bp = Blueprint("auth", __name__)


@auth_bp.before_app_request
def restore_session_from_jwt():
    """
    Middleware para restaurar la sesión del usuario desde un token JWT.

    Se ejecuta antes de cada petición. Si no hay un usuario en la sesión de Flask,
    intenta decodificar un token JWT presente en las cookies. Si el token es válido,
    puebla la sesión con los datos del usuario, permitiendo una experiencia de
    usuario persistente entre visitas.
    """
    # Si ya hay un usuario en el contexto global 'g', no es necesario hacer nada más aquí.
    if hasattr(g, "user") and g.user:
        return

    user_id_from_session = session.get("user", {}).get("id")
    if user_id_from_session and not (hasattr(g, "user") and g.user):
        g.user = Usuarios.query.get(user_id_from_session)
    # Evita restaurar la sesión si el usuario acaba de cerrarla explícitamente.
    if request.endpoint == "auth.logout" and request.method == "POST":
        return
    # Busca el token JWT en la cookie 'token'.
    cookie_token = request.cookies.get("token")
    if not cookie_token or cookie_token.strip() == "":
        return
    token = cookie_token
    if not token:
        auth_header = request.headers.get("Authorization", None)
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        return  # No hay token, no se puede restaurar.

    # Verifica la validez del token y obtiene el objeto de usuario.
    usuario = Usuarios.verificar_jwt(token)
    if usuario:
        # Si el token es válido, se puebla la sesión de Flask con los datos del usuario.
        g.user = usuario
        session["user"] = {
            "id": usuario.id,
            "numero": usuario.numero,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
        }
        # Se elimina la actualización de 'last_seen' de aquí.
        # Esta función solo debe restaurar la sesión en 'g.user'.
        # La actualización de 'last_seen' ahora es responsabilidad exclusiva del login
        # y del endpoint de 'heartbeat' del cliente para reflejar actividad real.
        session.modified = True


@auth_bp.route("/me", methods=["GET"])
def me():
    """
    Endpoint de API para obtener los datos del usuario autenticado.

    Utilizado por el frontend para verificar si un token JWT es válido y obtener
    la información del usuario asociado, por ejemplo, al cargar la página.

    Returns:
        JSON: Un objeto con los datos del usuario si el token es válido.
        JSON: Un objeto de error si el token no se proporciona, es inválido o ha expirado.
    """
    from flask import current_app as app

    # Busca el token JWT, priorizando la cookie.
    token = request.cookies.get("token")
    # Si no está en la cookie, busca en el encabezado de autorización.
    if not token:
        auth_header = request.headers.get("Authorization", None)
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        return jsonify({"error": "Token no proporcionado"}), 401
    try:
        # Verifica el token y obtiene el usuario.
        usuario = Usuarios.verificar_jwt(token)
        if not usuario:
            return jsonify({"error": "Token inválido o expirado"}), 401

        #  Verificar si la cuenta está activa.
        if not usuario.is_active:
            app.logger.warning(
                f"Acceso denegado para usuario inactivo ID: {usuario.id} a través del endpoint /me."
            )
            return jsonify(
                {"error": "Tu cuenta ha sido desactivada.", "code": "ACCOUNT_INACTIVE"}
            ), 403

        # Devuelve los datos públicos del usuario.
        return jsonify(
            {
                "usuario": {
                    "id": usuario.id,
                    "numero": usuario.numero,
                    "nombre": usuario.nombre,
                    "apellido": usuario.apellido,
                }
            }
        ), 200
    except Exception as e:
        app.logger.error(f"Error al verificar token: {str(e)}", exc_info=True)
        return jsonify({"error": "Token inválido"}), 401


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Endpoint de API para el registro de un nuevo usuario.

    Valida los datos de entrada, verifica que el número de teléfono no esté ya
    registrado y, si todo es correcto, crea el nuevo usuario en la base de datos.
    Genera un token JWT y lo devuelve junto con los datos del nuevo usuario.

    Request Body (JSON):
        - numero (str): Número de teléfono de 10 dígitos.
        - nombre (str): Nombre del usuario.
        - apellido (str): Apellido del usuario.
        - contraseña (str): Contraseña (mínimo 8 caracteres).

    Returns:
        JSON: Token JWT y datos del usuario en caso de éxito (201).
        JSON: Objeto de error en caso de datos faltantes (400), número ya registrado (409) o error del servidor (500).
    """
    from flask import current_app as app

    data = request.get_json()
    app.logger.info(f"Intento de registro: {data.get('numero', 'N/A')}")
    required_fields = ["numero", "nombre", "apellido", "contraseña"]
    if not all(field in data for field in required_fields):
        app.logger.warning("Registro fallido: faltan campos requeridos")
        return jsonify({"error": "Faltan campos requeridos"}), 400
    if len(data["numero"]) != 10 or not data["numero"].isdigit():
        app.logger.warning("Registro fallido: número inválido")
        return jsonify({"error": "El número debe tener 10 dígitos numéricos"}), 400
    if Usuarios.query.filter_by(numero=data["numero"]).first():
        app.logger.warning(f"Registro fallido: número ya registrado {data['numero']}")
        return jsonify({"error": "El número ya está registrado"}), 409
    try:
        # Crea la instancia del usuario. La validación de la contraseña
        # y el hasheo ocurren dentro del constructor del modelo `Usuarios`.
        usuario = Usuarios(
            numero=data["numero"],
            nombre=data["nombre"],
            apellido=data["apellido"],
            contraseña=data["contraseña"],
        )
        db.session.add(usuario)
        db.session.commit()

        app.logger.info(
            f"Registro exitoso: usuario {usuario.numero} (ID: {usuario.id})"
        )
        #  No iniciar sesión automáticamente.
        # Devolver solo un mensaje de éxito para que el frontend redirija al login.
        return jsonify(
            {
                "success": True,
                "message": "Usuario registrado exitosamente. Por favor, inicia sesión.",
            }
        ), 201
    except ValueError as e:
        # Captura errores de validación desde los Value Objects del modelo.
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error en registro: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/login", methods=["GET"])
def login_page():
    """
    Renderiza la página o modal de inicio de sesión.

    Si el usuario ya está autenticado, lo redirige a la página principal o a la
    URL de 'next' si fue especificada.
    """
    next_url = request.args.get("next", "")
    if current_user.is_authenticated:
        return redirect(next_url if next_url else url_for("products.index"))
    return render_template("cliente/ui/auth_modals.html", next=next_url)


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Endpoint de API para el inicio de sesión del usuario.

    Verifica las credenciales (número y contraseña). Si son correctas, inicia la
    sesión del usuario con Flask-Login, puebla la sesión de Flask y genera un
    token JWT para el cliente.

    Request Body (JSON):
        - numero (str): Número de teléfono del usuario.
        - contraseña (str): Contraseña del usuario.

    Returns:
        JSON: Token JWT, datos del usuario y URL de redirección en caso de éxito (200).
        JSON: Objeto de error en caso de credenciales inválidas (401) o datos faltantes (400).
    """
    from flask import current_app as app

    data = request.get_json()
    app.logger.info(f"Intento de inicio de sesión: {data.get('numero', 'N/A')}")

    if not data.get("numero") or not data.get("contraseña"):
        return jsonify({"error": "Faltan campos requeridos"}), 400
    # Busca al usuario por su número de teléfono.
    usuario = Usuarios.query.filter_by(numero=data["numero"]).first()

    if not usuario:
        app.logger.warning(
            f"Inicio de sesión fallido: número no registrado {data['numero']}"
        )
        return jsonify({"error": "Credenciales inválidas"}), 401

    # Verificar si la cuenta del usuario está activa ANTES de verificar la contraseña.
    if not usuario.is_active:
        app.logger.warning(
            f"Inicio de sesión fallido: cuenta inactiva para el número: {data['numero']}"
        )
        return jsonify(
            {"error": "Tu cuenta se encuentra inactiva. Por favor, contacta a soporte."}
        ), 403

    # Verifica la contraseña hasheada.
    #  Usar el método encapsulado del modelo para verificar la contraseña.
    if not usuario.verificar_contraseña(data["contraseña"]):
        app.logger.warning(
            f"Inicio de sesión fallido: contraseña incorrecta para el número: {data['numero']}"
        )
        return jsonify({"error": "Credenciales inválidas"}), 401

    # Inicia la sesión del usuario con Flask-Login, gestionando la cookie de sesión.
    login_user(usuario, remember=True)

    # Actualizar la última vez que se vio al usuario al iniciar sesión.
    usuario.last_seen = datetime.now(timezone.utc)
    db.session.commit()

    # Almacena datos adicionales en la sesión para un acceso rápido.
    session["user"] = {
        "id": usuario.id,
        "numero": usuario.numero,
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
    }
    session.modified = True

    # Genera un nuevo token JWT para el cliente.
    token = usuario.generar_jwt()
    app.logger.info(
        f"Inicio de sesión exitoso para el usuario: {usuario.numero} (ID: {usuario.id})"
    )

    return jsonify(
        {
            "success": True,
            "token": token,
            "usuario": {
                "id": usuario.id,
                "numero": usuario.numero,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
            },
            "redirect": request.args.get("next") or url_for("products.index"),
        }
    ), 200


# --- INICIO: FUNCIONALIDAD DE OLVIDÉ MI CONTRASEÑA ---


@auth_bp.route("/request-reset", methods=["POST"])
def request_reset():
    """
    Paso 1 del reseteo de contraseña: Solicitar código de recuperación.

    El usuario proporciona su número de teléfono y nombre. Si coinciden con un
    usuario activo, se genera un código de recuperación de 6 dígitos.

    Request Body (JSON):
        - numero (str): Número de teléfono del usuario.
        - nombre (str): Nombre del usuario para verificación.

    Returns:
        JSON: Objeto con el código de recuperación en caso de éxito (200).
        JSON: Objeto de error si los datos son incorrectos o el usuario no se encuentra (400, 401).
    """
    try:
        data = request.get_json()
        numero = data.get("numero", "").strip()
        nombre = data.get("nombre", "").strip()
        current_app.logger.info(
            f"Solicitud de reseteo de contraseña para el número: {numero} y nombre: {nombre[:3]}..."
        )

        if not numero or not nombre:
            current_app.logger.warning(
                "Solicitud de reseteo fallida: faltan campos (número o nombre)."
            )
            return jsonify(
                {"error": "El número de teléfono y el nombre son requeridos."}
            ), 400

        # Busca al usuario por número y nombre (insensible a mayúsculas).
        usuario = Usuarios.query.filter(
            Usuarios.numero == numero, Usuarios.nombre.ilike(nombre)
        ).first()

        # Si el usuario no existe, se devuelve un mensaje genérico por seguridad.
        if not usuario:
            current_app.logger.warning(
                f"Solicitud de reseteo fallida: combinación de número/nombre no encontrada para el número {numero}."
            )
            return jsonify(
                {"error": "Credenciales incorrectas. Verifica tu número y nombre."}
            ), 401

        # Si el usuario existe, verificar si su cuenta está activa.
        if not usuario.is_active:
            current_app.logger.warning(
                f"Solicitud de reseteo fallida: cuenta inactiva para el número: {numero}"
            )
            return jsonify(
                {
                    "error": "Tu cuenta se encuentra inactiva. Por favor, contacta a soporte."
                }
            ), 403

        # Genera y guarda un código de 6 dígitos con una expiración de 10 minutos.
        codigo = usuario.generar_codigo_recuperacion()
        current_app.logger.info(
            f"Código de recuperación generado para el usuario {usuario.id}"
        )

        # Devolvemos el código directamente al frontend
        return jsonify({"success": True, "codigo": codigo}), 200

    except Exception as e:
        current_app.logger.error(
            f"Error inesperado en request_reset: {str(e)}", exc_info=True
        )
        db.session.rollback()
        return jsonify(
            {
                "success": False,
                "error": "Ocurrió un error inesperado al procesar tu solicitud. Por favor, intenta de nuevo.",
            }
        ), 500


@auth_bp.route("/verify-reset-code", methods=["POST"])
def verify_reset_code():
    """
    Paso 2 del reseteo de contraseña: Verificar el código de recuperación.

    Verifica que el código de 6 dígitos proporcionado sea válido y no haya expirado.
    Si es correcto, genera un segundo token, más largo y seguro, para autorizar
    el cambio de contraseña final.

    Returns:
        JSON: Objeto con el `reset_token` seguro para el siguiente paso (200).
        JSON: Objeto de error si el código es inválido o ha expirado (401).
    """
    current_app.logger.info("Intento de verificación de código de reseteo.")
    data = request.get_json()
    codigo = data.get("codigo")

    if not codigo:
        current_app.logger.warning(
            "Verificación de código fallida: no se proporcionó código."
        )
        return jsonify({"error": "El código es requerido."}), 400

    # El método `verificar_reset_token` busca un usuario con ese token y comprueba la expiración.
    usuario = Usuarios.verificar_reset_token(codigo)

    if not usuario:
        current_app.logger.warning(
            f"Verificación de código fallida: código inválido o expirado '{codigo}'."
        )
        return jsonify(
            {
                "error": "El código es inválido o ha expirado. Por favor, solicita uno nuevo."
            }
        ), 401

    # El código numérico es válido. Ahora se genera un token criptográficamente seguro
    # para el paso final. Esto previene que alguien pueda reintentar adivinar el código numérico.
    final_token = usuario.generar_token_seguro_reseteo()

    # Se elimina la clave duplicada 'message'.
    return jsonify(
        {
            "success": True,
            "message": "Código verificado. Ahora puedes crear tu nueva contraseña.",
            "reset_token": final_token,
        }
    ), 200


@auth_bp.route("/reset-password/<token>", methods=["POST"])
def reset_password_api(token):
    """
    Paso 3 del reseteo de contraseña (API): Establecer la nueva contraseña.

    Este endpoint requiere el token seguro generado en el paso 2. Valida la nueva
    contraseña, la actualiza en la base de datos e invalida el token de reseteo.
    """
    usuario = Usuarios.verificar_reset_token(token)
    if not usuario:
        return jsonify(
            {
                "error": "El token para restablecer la contraseña es inválido o ha expirado."
            }
        ), 404

    data = request.get_json()
    nueva_contraseña = data.get("contraseña")
    confirm_contraseña = data.get("confirm_contraseña")

    # Valida la fortaleza de la nueva contraseña usando una expresión regular.
    password_pattern = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$"
    if not nueva_contraseña or not re.match(password_pattern, nueva_contraseña):
        return jsonify(
            {
                "error": "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número."
            }
        ), 400

    # Valida que ambas contraseñas coincidan en el backend como una capa extra de seguridad.
    if nueva_contraseña != confirm_contraseña:
        return jsonify(
            {
                "error": "Las contraseñas no coinciden. Por favor, verifica.",
                "field": "confirm_contraseña",
            }
        ), 400

    #  Asignar la contraseña en texto plano.
    # El setter del modelo se encargará del hasheo de forma segura.
    usuario.contraseña = nueva_contraseña
    # Invalida el token de reseteo para que no pueda ser reutilizado.
    usuario.reset_token = None
    usuario.reset_token_expiration = None
    # Se eliminan las referencias a `reset_code` que no existen en el modelo.
    db.session.commit()

    current_app.logger.info(
        f"Contraseña restablecida exitosamente para el usuario {usuario.id}."
    )
    return jsonify(
        {
            "success": True,
            "message": "¡Contraseña actualizada con éxito! Redirigiendo para iniciar sesión.",
        }
    ), 200


# --- FIN: FUNCIONALIDAD DE OLVIDÉ MI CONTRASEÑA ---


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    Endpoint de API para cerrar la sesión del usuario.

    Limpia la sesión de Flask-Login, los datos de la sesión personalizada de Flask
    y elimina la cookie del token JWT del navegador.
    """
    from flask import current_app as app
    from flask import make_response

    try:
        # MEJORA PROFESIONAL: Marcar al usuario como desconectado ANTES de cerrar la sesión.
        # Esto asegura que el timestamp 'last_seen' se actualice correctamente.
        user_id = session.get("user", {}).get("id")
        if user_id:
            usuario = Usuarios.query.get(user_id)
            if usuario:
                # Guardar la hora exacta de la desconexión.
                usuario.last_seen = datetime.now(timezone.utc)
                db.session.commit()
                app.logger.info(
                    f"Usuario {usuario.id} marcado como desconectado en logout."
                )

        # Cierra la sesión gestionada por Flask-Login.
        logout_user()

        # Limpia los datos personalizados de la sesión, incluyendo el carrito de anónimo.
        session.pop("user", None)
        session.pop("cart_id", None)
        session.modified = True

        # Crea una respuesta y le indica al navegador que elimine la cookie del token.
        response = make_response(jsonify({"success": True}))
        response.delete_cookie("token")

        app.logger.info("Sesión cerrada exitosamente")
        return response
    except Exception as e:
        app.logger.error(f"Error al cerrar sesión: {str(e)}", exc_info=True)
        return jsonify({"error": "Error al cerrar sesión"}), 500


def perfil(usuario, pedidos_realizados=0, total_compras=0):
    """
    Función de vista para renderizar la página de perfil del usuario.

    Detecta si el dispositivo es móvil para renderizar una plantilla optimizada.
    Actualmente, ambas vistas (móvil y escritorio) usan la misma plantilla.
    """
    user_agent = request.headers.get("User-Agent", "").lower()
    es_movil = (
        "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent
    )

    template_vars = {
        "usuario": usuario,
        "pedidos_realizados": pedidos_realizados,
        "total_compras": total_compras,
    }

    if es_movil:
        return render_template(
            "cliente/componentes/perfil_usuario.html", **template_vars
        )
    else:
        # TODO: Crear una plantilla de perfil para escritorio
        return render_template(
            "cliente/componentes/perfil_usuario.html", **template_vars
        )


@auth_bp.route("/update_profile", methods=["PUT"])
@jwt_required
def update_profile(usuario):
    """
    Endpoint de API para actualizar los datos del perfil de un usuario.

    Permite actualizar nombre, apellido, número y contraseña. Realiza validaciones
    de formato y unicidad para el número de teléfono.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.
    """
    from flask import current_app as app

    data = request.get_json()

    # Se utiliza directamente el objeto 'usuario' proporcionado por el decorador,
    # eliminando la necesidad de una consulta redundante a la base de datos.
    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    user_id = usuario.id

    # Actualiza los campos si se proporcionan en el cuerpo de la solicitud.
    if "nombre" in data:
        if not data["nombre"] or not all(
            c.isalpha() or c.isspace() for c in data["nombre"]
        ):
            return jsonify(
                {
                    "error": "El nombre solo debe contener letras y espacios",
                    "field": "modalNombre",
                }
            ), 400
        usuario.nombre = data["nombre"]

    if "apellido" in data:
        if not data["apellido"] or not all(
            c.isalpha() or c.isspace() for c in data["apellido"]
        ):
            return jsonify(
                {
                    "error": "El apellido solo debe contener letras y espacios",
                    "field": "modalApellido",
                }
            ), 400
        usuario.apellido = data["apellido"]

    if "numero" in data:
        if (
            not data["numero"]
            or not data["numero"].isdigit()
            or len(data["numero"]) != 10
        ):
            return jsonify(
                {
                    "error": "El número debe tener 10 dígitos numéricos",
                    "field": "modalTelefono",
                }
            ), 400
        if Usuarios.query.filter(
            Usuarios.numero == data["numero"], Usuarios.id != user_id
        ).first():
            return jsonify(
                {
                    "error": "El número de teléfono ya está en uso",
                    "field": "modalTelefono",
                }
            ), 409
        usuario.numero = data["numero"]
    if (
        "contraseña" in data and data["contraseña"]
    ):  # Only update if password is provided and not empty
        # Validación de fortaleza de la contraseña.
        if (
            len(data["contraseña"]) < 8
            or not any(c.islower() for c in data["contraseña"])
            or not any(c.isupper() for c in data["contraseña"])
            or not any(c.isdigit() for c in data["contraseña"])
        ):
            return jsonify(
                {
                    "error": "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número",
                    "field": "modalPassword",
                }
            ), 400
        #  Asignar la contraseña en texto plano.
        # El setter del modelo se encargará del hasheo.
        usuario.contraseña = data["contraseña"]

    try:
        db.session.commit()
        app.logger.info(f"Perfil actualizado para el usuario ID: {user_id}")
        return jsonify(
            {
                "success": True,
                "usuario": {
                    "id": usuario.id,
                    "numero": usuario.numero,
                    "nombre": usuario.nombre,
                    "apellido": usuario.apellido,
                },
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(
            f"Error al actualizar perfil para el usuario ID: {user_id}: {str(e)}",
            exc_info=True,
        )
        return jsonify({"error": "Error al actualizar el perfil"}), 500


@auth_bp.route("/heartbeat", methods=["POST"])
@jwt_required
def client_heartbeat(usuario):
    """
    Endpoint para que el frontend del cliente reporte actividad.
    Actualiza el 'last_seen' del usuario para mantenerlo 'En línea'.
    """
    try:
        # El decorador @jwt_required ya nos da el objeto 'usuario'
        usuario.last_seen = datetime.now(timezone.utc)
        db.session.commit()
        return jsonify({"success": True}), 200
    except Exception as e:
        current_app.logger.error(
            f"Error en el heartbeat del cliente {usuario.id}: {str(e)}"
        )
        # No devolvemos un 500 para no generar alertas innecesarias en el frontend por un fallo menor.
        return jsonify({"success": False}), 200


@auth_bp.route("/upload_avatar", methods=["POST"])
@jwt_required
def upload_avatar(usuario):
    """
    Endpoint para subir un nuevo avatar de usuario.

    Permite a los usuarios cargar una imagen de avatar que se almacenará en Cloudinary.
    La imagen se optimiza automáticamente en múltiples tamaños para diferentes contextos.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.

    Returns:
        JSON: Respuesta con el estado de la operación y URL del avatar.
    """
    try:
        # Verificar que se haya enviado un archivo
        if "avatar" not in request.files:
            return jsonify({"error": "No se ha seleccionado ninguna imagen"}), 400

        file = request.files["avatar"]

        # Verificar que el archivo no esté vacío
        if file.filename == "":
            return jsonify({"error": "No se ha seleccionado ninguna imagen"}), 400

        # Verificar el tipo de archivo
        allowed_extensions = {"png", "jpg", "jpeg", "gif", "webp"}
        if not (
            "." in file.filename
            and file.filename.rsplit(".", 1)[1].lower() in allowed_extensions
        ):
            return jsonify(
                {
                    "error": "Tipo de archivo no permitido. Use PNG, JPG, JPEG, GIF o WEBP"
                }
            ), 400

        # Verificar el tamaño del archivo (máximo 5MB)
        file.seek(0, 2)  # Ir al final del archivo
        file_size = file.tell()
        file.seek(0)  # Volver al principio

        if file_size > 5 * 1024 * 1024:  # 5MB en bytes
            return jsonify({"error": "El archivo es demasiado grande. Máximo 5MB"}), 400

        # Importar funciones de Cloudinary
        from app.utils.cloudinary_utils import delete_avatar, upload_avatar_and_get_url

        # Eliminar avatar anterior si existe
        if usuario.avatar_public_id:
            delete_avatar(usuario.avatar_public_id)

        # Subir nuevo avatar
        avatar_url = upload_avatar_and_get_url(file, usuario.id)

        # Extraer public_id de la URL para almacenarlo
        # El public_id está en el formato: user_{id}_{uuid}
        import re

        public_id_match = re.search(r"yeicy-cosmetic/avatars/([^/]+)", avatar_url)
        public_id = public_id_match.group(1) if public_id_match else None

        # Actualizar la base de datos
        usuario.avatar_url = avatar_url
        usuario.avatar_public_id = public_id
        db.session.commit()

        current_app.logger.info(f"Avatar actualizado para usuario ID: {usuario.id}")

        return jsonify(
            {
                "success": True,
                "message": "Avatar actualizado exitosamente",
                "avatar_url": avatar_url,
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"Error al subir avatar para usuario ID: {usuario.id}: {str(e)}",
            exc_info=True,
        )
        return jsonify(
            {"error": "Error al procesar la imagen. Intente nuevamente"}
        ), 500


@auth_bp.route("/delete_avatar", methods=["DELETE"])
@jwt_required
def delete_avatar_endpoint(usuario):
    """
    Endpoint para eliminar el avatar de usuario.

    Elimina tanto la imagen de Cloudinary como las referencias en la base de datos.

    Args:
        usuario (Usuarios): El objeto de usuario inyectado por el decorador `@jwt_required`.

    Returns:
        JSON: Respuesta con el estado de la operación.
    """
    try:
        # Verificar que el usuario tenga un avatar
        if not usuario.avatar_url or not usuario.avatar_public_id:
            return jsonify({"error": "No hay avatar para eliminar"}), 400

        # Importar función de Cloudinary
        from app.utils.cloudinary_utils import delete_avatar

        # Eliminar imagen de Cloudinary
        deleted = delete_avatar(usuario.avatar_public_id)

        if not deleted:
            current_app.logger.warning(
                f"No se pudo eliminar la imagen de Cloudinary para usuario ID: {usuario.id}"
            )

        # Limpiar referencias en la base de datos
        usuario.avatar_url = None
        usuario.avatar_public_id = None
        db.session.commit()

        current_app.logger.info(f"Avatar eliminado para usuario ID: {usuario.id}")

        return jsonify(
            {"success": True, "message": "Avatar eliminado exitosamente"}
        ), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"Error al eliminar avatar para usuario ID: {usuario.id}: {str(e)}",
            exc_info=True,
        )
        return jsonify(
            {"error": "Error al eliminar el avatar. Intente nuevamente"}
        ), 500
