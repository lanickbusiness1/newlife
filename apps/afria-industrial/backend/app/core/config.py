from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

SystemMode = Literal['ONLINE', 'DEGRADED', 'OFFLINE_EDGE']


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix='AFRIA_INDUSTRIAL_', extra='ignore')

    database_path: str = './data/industrial.db'
    system_mode: SystemMode = 'ONLINE'
