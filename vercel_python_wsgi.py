# vercel_python_wsgi.py
"""
Adaptador WSGI para Despliegue en Vercel.

Este script actúa como el punto de entrada (entry point) que la plataforma Vercel
utiliza para servir la aplicación web.

Su única responsabilidad es importar la instancia principal de la aplicación Flask,
nombrada `app`, desde el script `run.py`. Vercel está configurado (a través de
`vercel.json`) para buscar automáticamente esta variable `app` en el archivo
especificado para iniciar el servidor WSGI.

Este archivo no debe contener lógica de la aplicación.
"""
from run import app
