import os
import sys
from getpass import getpass

# Añadir el directorio raíz del proyecto al sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
sys.path.insert(0, project_root)

from app import create_app
from app.extensions import db
from app.models.domains.user_models import Admins

app = create_app()

def create_admin():
    """Crea un nuevo usuario administrador en la base de datos."""
    with app.app_context():
        print("--- Creación de un nuevo administrador ---")

        # Validar y obtener cédula
        while True:
            cedula = input("Cédula: ").strip()
            if not cedula:
                print("Error: La cédula no puede estar vacía.")
                continue
            if Admins.query.filter_by(cedula=cedula).first():
                print(f"Error: Ya existe un administrador con la cédula {cedula}.")
                continue
            break

        # Validar y obtener nombre
        while True:
            nombre = input("Nombre: ").strip()
            if not nombre:
                print("Error: El nombre no puede estar vacío.")
                continue
            break

        # Validar y obtener apellido
        while True:
            apellido = input("Apellido: ").strip()
            if not apellido:
                print("Error: El apellido no puede estar vacío.")
                continue
            break

        # Validar y obtener número de teléfono
        while True:
            numero_telefono = input("Número de Teléfono (10 dígitos): ").strip()
            if not numero_telefono.isdigit() or len(numero_telefono) != 10:
                print("Error: El número de teléfono debe contener exactamente 10 dígitos numéricos.")
                continue
            if Admins.query.filter_by(numero_telefono=numero_telefono).first():
                print(f"Error: Ya existe un administrador con el número de teléfono {numero_telefono}.")
                continue
            break

        # Validar y obtener contraseña
        while True:
            contraseña = getpass("Contraseña (mínimo 6 caracteres): ")
            if len(contraseña) < 6:
                print("Error: La contraseña debe tener al menos 6 caracteres.")
                continue
            
            confirm_contraseña = getpass("Confirmar Contraseña: ")
            if contraseña != confirm_contraseña:
                print("Error: Las contraseñas no coinciden.")
                continue
            break

        try:
            # Crear instancia del administrador
            nuevo_admin = Admins(
                cedula=cedula,
                nombre=nombre,
                apellido=apellido,
                numero_telefono=numero_telefono,
                contraseña=contraseña
            )
            
            # Añadir a la base de datos
            db.session.add(nuevo_admin)
            db.session.commit()
            
            print("\n✅ ¡Administrador creado exitosamente!")
            print(f"  - Cédula: {cedula}")
            print(f"  - Nombre: {nombre} {apellido}")

        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error al crear el administrador: {e}")

if __name__ == '__main__':
    create_admin()
