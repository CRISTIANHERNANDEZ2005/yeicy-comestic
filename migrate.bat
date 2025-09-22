set FLASK_APP=run.py
python -m flask db init
python -m flask db migrate -m "BASE DE DATOS"
python -m flask db upgrade