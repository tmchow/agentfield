from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Metrics:
    duration_ms: int = 0
    duration_api_ms: int = 0
    num_turns: int = 0
    total_cost_usd: Optional[float] = None
    usage: Optional[Dict[str, Any]] = None
    session_id: str = ""


@dataclass
class RawResult:
    result: Optional[str] = None
    messages: List[Dict[str, Any]] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)
    is_error: bool = False
    error_message: Optional[str] = None


@dataclass
class HarnessResult:
    result: Optional[str] = None
    parsed: Any = None
    is_error: bool = False
    error_message: Optional[str] = None
    cost_usd: Optional[float] = None
    num_turns: int = 0
    duration_ms: int = 0
    session_id: str = ""
    messages: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def text(self) -> str:
        if self.result:
            return self.result
        return ""
