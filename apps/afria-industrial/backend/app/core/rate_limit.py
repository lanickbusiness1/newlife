from __future__ import annotations
import time
from dataclasses import dataclass
from threading import Lock
@dataclass
class _Window:
    started_at:float
    count:int=0
class FixedWindowRateLimiter:
    def __init__(self,max_requests:int,window_seconds:int,clock=time.monotonic)->None:
        if max_requests<=0 or window_seconds<=0: raise ValueError('rate limit values must be > 0')
        self.max_requests=max_requests; self.window_seconds=window_seconds; self.clock=clock; self._windows={}; self._lock=Lock()
    def allow(self,key:str)->bool:
        now=self.clock()
        with self._lock:
            window=self._windows.get(key)
            if window is None or now-window.started_at>=self.window_seconds:
                self._windows[key]=_Window(now,1); return True
            if window.count>=self.max_requests: return False
            window.count+=1; return True
