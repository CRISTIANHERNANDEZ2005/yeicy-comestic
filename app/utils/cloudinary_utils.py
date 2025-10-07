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