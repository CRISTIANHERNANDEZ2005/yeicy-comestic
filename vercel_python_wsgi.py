# vercel_python_wsgi.py
"""
Adaptador WSGI para Vercel: expone 'app' para que Vercel pueda servir la aplicación Flask.
"""
from run import app

# Vercel buscará la variable 'app' en este archivo
