set FLASK_APP=run.py
python -m flask db init
python -m flask db migrate -m "base de datos"
python -m flask db upgrade