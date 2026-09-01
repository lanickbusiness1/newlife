from typing import Literal
from pydantic_settings import BaseSettings,SettingsConfigDict
SystemMode=Literal['ONLINE','DEGRADED','OFFLINE_EDGE']
class Settings(BaseSettings):
    model_config=SettingsConfigDict(env_prefix='AFRIA_INDUSTRIAL_',extra='ignore')
    database_path:str='./data/industrial.db'
    system_mode:SystemMode='ONLINE'
    api_keys:str=''
    mutation_rate_limit:int=10
    mutation_rate_window_seconds:int=60
    cors_origins:str=''
    bind_host:str='127.0.0.1'
