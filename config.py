# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_POOL_RECYCLE = 299
    SQLALCHEMY_POOL_TIMEOUT = 20
    SQLALCHEMY_POOL_PRE_PING = True
    DEBUG = False
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_ACCESS_COOKIE_NAME = "admin_jwt"
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_ACCESS_CSRF_HEADER_NAME = ""
    JWT_ACCESS_CSRF_FIELD_NAME = ""
    JWT_IDENTITY_CLAIM = 'user_id'
    ADMIN_JWT_EXPIRATION_MINUTES = 1440

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = True

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_ECHO = False

config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}