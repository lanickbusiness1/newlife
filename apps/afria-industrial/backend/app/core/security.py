from __future__ import annotations
import hmac
from dataclasses import dataclass
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from app.core.config import Settings
from app.core.rate_limit import FixedWindowRateLimiter
ROLE_LEVEL={'viewer':10,'operator':20,'engineer':30,'admin':40}
_api_key_header=APIKeyHeader(name='X-API-Key',auto_error=False)
@dataclass(frozen=True)
class Principal:
    key_id:str
    role:str
def _parse_api_keys(raw:str)->list[tuple[str,str,str]]:
    records=[]
    if not raw.strip(): return records
    for item in raw.split(','):
        parts=item.strip().split(':',2)
        if len(parts)!=3 or parts[1] not in ROLE_LEVEL or not all(parts): raise ValueError('invalid AFRIA_INDUSTRIAL_API_KEYS entry')
        records.append((parts[0],parts[1],parts[2]))
    return records
def authenticate(secret:str|None,settings:Settings)->Principal:
    if not secret: raise HTTPException(status_code=401,detail='API key required')
    for key_id,role,expected_secret in _parse_api_keys(settings.api_keys):
        if hmac.compare_digest(secret.encode(),expected_secret.encode()): return Principal(key_id,role)
    raise HTTPException(status_code=401,detail='invalid API key')
def require_role(settings:Settings,*roles:str,limiter:FixedWindowRateLimiter|None=None):
    if not roles: raise ValueError('at least one role is required')
    required_level=min(ROLE_LEVEL[role] for role in roles)
    def dependency(request:Request,secret:str|None=Depends(_api_key_header))->Principal:
        principal=authenticate(secret,settings)
        if ROLE_LEVEL[principal.role]<required_level: raise HTTPException(status_code=403,detail='insufficient role')
        if limiter is not None and not limiter.allow(f'{principal.key_id}:{request.method}:{request.url.path}'): raise HTTPException(status_code=429,detail='mutation rate limit exceeded')
        return principal
    return dependency
