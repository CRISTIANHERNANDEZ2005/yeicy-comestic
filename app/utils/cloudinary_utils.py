"""
Módulo de Utilidades para Cloudinary.

Este archivo centraliza la lógica de interacción con el servicio de Cloudinary,
promoviendo la reutilización de código y la aplicación de mejores prácticas
en la gestión de activos digitales.
"""
import cloudinary.uploader
import hashlib
import uuid

def upload_image_and_get_url(image_file):
    """
    Sube una imagen a Cloudinary aplicando una estrategia de deduplicación profesional.

    Esta función calcula el hash MD5 del contenido de la imagen y lo utiliza como
    parte del `public_id`. Al establecer `overwrite=False`, se evita que Cloudinary
    almacene duplicados de la misma imagen. Si la imagen ya existe, Cloudinary
    simplemente devuelve la URL del recurso existente.

    Además, aplica transformaciones "eager" para generar versiones optimizadas
    y de alta calidad de la imagen en el momento de la subida.

    Args:
        image_file (FileStorage): El objeto de archivo de imagen proveniente de Flask.

    Returns:
        str: La URL segura de la imagen optimizada en Cloudinary.

    Raises:
        Exception: Si la subida a Cloudinary falla o no devuelve una URL.
    """
    # Calcular el hash MD5 del contenido del archivo para la deduplicación.
    md5_hash = hashlib.md5(image_file.read()).hexdigest()
    image_file.seek(0)  # Resetear el puntero del archivo después de leerlo.

    # MEJORA PROFESIONAL: El public_id es únicamente el hash del contenido.
    # Esto garantiza una deduplicación 100% basada en el contenido, sin importar el nombre del producto.

    upload_options = {
        'folder': "yeicy-cosmetic/products",
        'public_id': md5_hash,
        'overwrite': False,  # ¡Clave para la deduplicación!
        'eager': [
            {'width': 1000, 'height': 1000, 'crop': 'limit'},
            {'quality': 'auto:best'},
            {'fetch_format': 'auto'},
            {'dpr': 'auto'},
            {'effect': 'sharpen:100'}
        ]
    }
    upload_result = cloudinary.uploader.upload(image_file, **upload_options)

    # Si la imagen ya existía, 'eager' podría no estar en la respuesta principal.
    # La URL se construye a partir del public_id y las transformaciones.
    if 'eager' in upload_result and upload_result['eager']:
        return upload_result['eager'][0].get('secure_url')

    # Si 'eager' no está, es probable que la imagen ya existiera.
    # Construimos la URL manualmente para asegurar la consistencia.
    return cloudinary.CloudinaryImage(md5_hash).build_url(
        transformation=[
            {'width': 1000, 'height': 1000, 'crop': 'limit'},
            {'quality': 'auto:best'},
            {'fetch_format': 'auto'},
            {'dpr': 'auto'},
            {'effect': 'sharpen:100'}
        ]
    )


def upload_avatar_and_get_url(image_file, user_id):
    """
    Sube un avatar de usuario a Cloudinary aplicando optimizaciones específicas para avatares.

    Esta función está específicamente diseñada para avatares de usuario, aplicando
    transformaciones optimizadas para fotos de perfil como recorte circular,
    mejoras faciales y múltiples tamaños para diferentes contextos de uso.

    Args:
        image_file (FileStorage): El objeto de archivo de imagen proveniente de Flask.
        user_id (int): ID único del usuario para generar un public_id único.

    Returns:
        str: La URL segura del avatar optimizado en Cloudinary.

    Raises:
        Exception: Si la subida a Cloudinary falla o no devuelve una URL.
    """
    # Generar un public_id único basado en el user_id y un UUID para evitar conflictos
    unique_id = f"user_{user_id}_{uuid.uuid4().hex[:8]}"

    upload_options = {
        'folder': "yeicy-cosmetic/avatars",
        'public_id': unique_id,
        'overwrite': True,  # Permitir sobrescribir avatares anteriores del mismo usuario
        'eager': [
            # Avatar grande para perfil (400x400)
            {
                'width': 400,
                'height': 400,
                'crop': 'fill',
                'gravity': 'face',
                'quality': 'auto:best',
                'fetch_format': 'auto',
                'dpr': 'auto'
            },
            # Avatar mediano para navbar (80x80)
            {
                'width': 80,
                'height': 80,
                'crop': 'fill',
                'gravity': 'face',
                'quality': 'auto:good',
                'fetch_format': 'auto',
                'dpr': 'auto'
            },
            # Avatar pequeño para comentarios/reseñas (40x40)
            {
                'width': 40,
                'height': 40,
                'crop': 'fill',
                'gravity': 'face',
                'quality': 'auto:good',
                'fetch_format': 'auto',
                'dpr': 'auto'
            }
        ],
        'tags': ['avatar', f'user_{user_id}']  # Tags para fácil gestión
    }

    upload_result = cloudinary.uploader.upload(image_file, **upload_options)

    # Retornar la URL del avatar en tamaño grande (400x400) por defecto
    if 'eager' in upload_result and upload_result['eager']:
        return upload_result['eager'][0].get('secure_url')

    # Fallback: construir URL manualmente
    return cloudinary.CloudinaryImage(unique_id).build_url(
        folder="yeicy-cosmetic/avatars",
        transformation=[
            {'width': 400, 'height': 400, 'crop': 'fill'},
            {'gravity': 'face'},
            {'quality': 'auto:best'},
            {'fetch_format': 'auto'},
            {'dpr': 'auto'}
        ]
    )


def get_avatar_url(public_id, size='large'):
    """
    Genera URLs de avatar en diferentes tamaños basado en el public_id almacenado.

    Args:
        public_id (str): El public_id del avatar en Cloudinary.
        size (str): Tamaño deseado ('large', 'medium', 'small').

    Returns:
        str: URL del avatar en el tamaño especificado.
    """
    size_configs = {
        'large': {'width': 400, 'height': 400},   # Para perfil
        'medium': {'width': 80, 'height': 80},    # Para navbar
        'small': {'width': 40, 'height': 40}      # Para comentarios
    }

    config = size_configs.get(size, size_configs['large'])

    return cloudinary.CloudinaryImage(public_id).build_url(
        folder="yeicy-cosmetic/avatars",
        transformation=[
            {'width': config['width'], 'height': config['height'], 'crop': 'fill'},
            {'gravity': 'face'},
            {'quality': 'auto:best'},
            {'fetch_format': 'auto'},
            {'dpr': 'auto'}
        ]
    )


def delete_avatar(public_id):
    """
    Elimina un avatar de Cloudinary.

    Args:
        public_id (str): El public_id del avatar a eliminar.

    Returns:
        bool: True si se eliminó correctamente, False en caso contrario.
    """
    try:
        result = cloudinary.uploader.destroy(f"yeicy-cosmetic/avatars/{public_id}")
        return result.get('result') == 'ok'
    except Exception:
        return False
