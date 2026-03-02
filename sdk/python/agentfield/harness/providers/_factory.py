from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agentfield.harness.providers._base import HarnessProvider
    from agentfield.types import HarnessConfig

SUPPORTED_PROVIDERS = {"claude-code", "codex", "gemini", "opencode"}


def build_provider(config: "HarnessConfig") -> "HarnessProvider":
    provider_name = config.provider
    if provider_name not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unknown harness provider: {provider_name!r}. Supported providers: "
            f"{', '.join(sorted(SUPPORTED_PROVIDERS))}"
        )
    raise NotImplementedError(
        f"Provider {provider_name!r} is not yet implemented. Install the corresponding provider package."
    )
