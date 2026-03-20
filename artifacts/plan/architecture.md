## Architecture Document

### Summary
This document outlines the technical architecture for integrating `CursorProvider` into the Python SDK harness system. This integration involves creating a new provider module, updating configuration, extending the provider factory, and adding dedicated tests. The design prioritizes consistency with existing provider implementations, leveraging shared utilities for CLI execution, JSONL parsing, and cost estimation.

### Components

- **CursorProvider**:
  - Responsibility: Execute the `cursor` CLI subprocess, parse its JSONL output, extract results, and calculate metrics.
  - Touches Files: `sdk/python/agentfield/harness/providers/cursor.py`
  - Depends On: `agentfield.harness._cli`, `agentfield.harness._result`, `agentfield.types`

- **HarnessConfig**:
  - Responsibility: Define configuration for the harness system, including the path to the `cursor` binary.
  - Touches Files: `sdk/python/agentfield/types.py`
  - Depends On: None

- **Provider Factory (`_factory.py`)**:
  - Responsibility: Instantiate the correct provider based on the `HarnessConfig`, including `CursorProvider`.
  - Touches Files: `sdk/python/agentfield/harness/providers/_factory.py`
  - Depends On: `CursorProvider`

- **Provider `__init__.py`**:
  - Responsibility: Expose `CursorProvider` for easy import within the `agentfield.harness.providers` package.
  - Touches Files: `sdk/python/agentfield/harness/providers/__init__.py`
  - Depends On: `CursorProvider`

- **Test for CursorProvider**:
  - Responsibility: Verify the correct behavior of `CursorProvider`, including command construction, error handling, and cost estimation.
  - Touches Files: `sdk/python/tests/harness/test_cursor.py`
  - Depends On: `CursorProvider`

### Interfaces

#### `class CursorProvider` in `sdk/python/agentfield/harness/providers/cursor.py`

```python
class CursorProvider:
    def __init__(self, bin_path: str = "cursor"):
        """
        Initializes the CursorProvider.

        Args:
            bin_path: The path to the cursor CLI binary.
        """
        ...

    async def execute(self, prompt: str, options: dict[str, object]) -> RawResult:
        """
        Executes the cursor CLI subprocess with the given prompt and options.

        Args:
            prompt: The prompt string to pass to the cursor CLI.
            options: A dictionary of options, potentially including:
                     - 'cwd': The current working directory for the subprocess.
                     - 'permission_mode': 'auto' for full automation.
                     - 'model': The model to use for cost estimation.
                     - 'env': Environment variables for the subprocess.
                     - 'resume_session_id': For resuming a session.

        Returns:
            A RawResult object containing the execution outcome.
        """
        ...
```

#### `HarnessConfig` in `sdk/python/agentfield/types.py`

```python
class HarnessConfig(BaseModel):
    ...
    cursor_bin: str = Field(default="cursor", description="Path to cursor binary.")
    ...
```

#### `build_provider` function in `sdk/python/agentfield/harness/providers/_factory.py`

```python
def build_provider(config: "HarnessConfig") -> "HarnessProvider":
    ...
    if provider_name == "cursor":
        from agentfield.harness.providers.cursor import CursorProvider
        return CursorProvider(bin_path=getattr(config, "cursor_bin", "cursor"))
    ...
```

### Decisions

- **Decision: Mirror `CodexProvider` for `CursorProvider` implementation.**
  - Rationale: The `CodexProvider` provides a well-established pattern for interacting with CLI tools that output JSONL. This minimizes divergence and reuses existing logic for subprocess execution, JSONL parsing, and error handling, reducing development time and potential bugs.
  - Alternatives Considered:
    - Creating a new generic `CliProvider` base class: Rejected because `CodexProvider` is already quite close to a generic CLI provider and the specific `cursor` CLI arguments (like `resume_session_id`) necessitate some customization beyond a truly generic solution.
    - Implementing a custom JSONL parser: Rejected because `agentfield.harness._cli.parse_jsonl` already exists and is tested.

- **Decision: Add `cursor_bin` to `HarnessConfig` in `sdk/python/agentfield/types.py`.**
  - Rationale: This allows users to configure the path to the `cursor` binary, similar to `codex_bin` and `gemini_bin`, providing flexibility for different environments and installations.
  - Alternatives Considered: Hardcoding the `cursor` binary path: Rejected as it reduces configurability and makes local development/testing more difficult.

- **Decision: Map `cwd`, `permission_mode`, `model`, `env`, `resume_session_id` to `cursor` CLI arguments.**
  - Rationale: These options are standard across harness providers and are essential for controlling the execution environment and context of the `cursor` CLI. `resume_session_id` is a specific requirement for `cursor` to enable session resumption.
  - Alternatives Considered: Not mapping all options: Rejected as it would limit the functionality and consistency of `CursorProvider` compared to other providers.

### File Changes Overview

The implementation will involve modifications to the following files:

1.  `sdk/python/agentfield/harness/providers/cursor.py`: New file containing the `CursorProvider` class.
2.  `sdk/python/agentfield/types.py`: Addition of `cursor_bin` field to `HarnessConfig`.
3.  `sdk/python/agentfield/harness/providers/_factory.py`: Modification to `build_provider` to include `CursorProvider`.
4.  `sdk/python/agentfield/harness/providers/__init__.py`: Addition of `CursorProvider` to `__all__`.
5.  `sdk/python/tests/harness/test_cursor.py`: New file containing unit tests for `CursorProvider`.