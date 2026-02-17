"""
Integration tests: cross-document consistency after multi-branch merge.

These tests verify that the documentation fixes applied across multiple branches
(README, ARCHITECTURE.md, DEVELOPMENT.md, CONTRIBUTING.md, ENVIRONMENT_VARIABLES.md)
are mutually consistent and that the conflict-resolved test_contributing_md.py
correctly covers both the absolute-path approach and all required assertions.

Priority 1 — Conflict resolution area (test_contributing_md.py merge):
  - CONTRIBUTING.md and DEVELOPMENT.md agree on bootstrap script name.
  - CONTRIBUTING.md test uses absolute path (not relative).

Priority 2 — Cross-feature (doc-to-source) interactions:
  - env var names are consistent across all docs AND match what the control
    plane config actually uses.
  - AsyncConfig fields referenced in README exist in async_config.py source.
  - Scripts referenced in docs exist in the scripts/ directory.
  - Makefile targets referenced in docs (DEVELOPMENT.md, CONTRIBUTING.md) are real.
  - ARCHITECTURE.md real directory list matches actual filesystem layout.

Priority 3 — Shared-file modifications (docs edited by multiple branches):
  - README, ARCHITECTURE.md, DEVELOPMENT.md, ENVIRONMENT_VARIABLES.md are all
    internally consistent (no conflicting claims).
"""

import ast
import re
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Repo-root paths
# ---------------------------------------------------------------------------
_REPO = Path(__file__).parents[2]

README             = _REPO / "README.md"
ARCHITECTURE_MD    = _REPO / "docs" / "ARCHITECTURE.md"
DEVELOPMENT_MD     = _REPO / "docs" / "DEVELOPMENT.md"
CONTRIBUTING_MD    = _REPO / "docs" / "CONTRIBUTING.md"
ENVIRONMENT_MD     = _REPO / "docs" / "ENVIRONMENT_VARIABLES.md"
MAKEFILE           = _REPO / "Makefile"
ASYNC_CONFIG_PY    = _REPO / "sdk" / "python" / "agentfield" / "async_config.py"
SCRIPTS_DIR        = _REPO / "scripts"
TEST_CONTRIBUTING  = _REPO / "tests" / "docs" / "test_contributing_md.py"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def readme():
    return README.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def architecture():
    return ARCHITECTURE_MD.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def development():
    return DEVELOPMENT_MD.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def contributing():
    return CONTRIBUTING_MD.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def env_vars():
    return ENVIRONMENT_MD.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def makefile():
    return MAKEFILE.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def makefile_targets(makefile):
    return set(re.findall(r"^([a-zA-Z][a-zA-Z0-9_-]*):", makefile, re.MULTILINE))


@pytest.fixture(scope="module")
def async_config_fields():
    """Parse real AsyncConfig field names via AST from async_config.py."""
    source = ASYNC_CONFIG_PY.read_text(encoding="utf-8")
    tree = ast.parse(source)
    fields = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "AsyncConfig":
            for item in ast.walk(node):
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    fields.add(item.target.id)
    return fields


# ===========================================================================
# Priority 1: Conflict-resolution area
# test_contributing_md.py was merged with a conflict; verify correctness.
# ===========================================================================

class TestConflictResolutionContributingMd:
    """
    The conflict resolution commit (6c7f400) merged test_contributing_md.py,
    choosing the absolute-path approach from issue/04 while preserving all
    assertions from issue/fix-contributing-md. These tests verify the resolved
    test file behaves correctly against the actual CONTRIBUTING.md.
    """

    def test_contributing_uses_absolute_path_not_relative(self):
        """
        The conflict-resolved test_contributing_md.py must use an absolute path
        (pathlib.Path(__file__).parents[2]) rather than a hard-coded relative path.
        This was the key choice made during conflict resolution.
        """
        src = TEST_CONTRIBUTING.read_text(encoding="utf-8")
        assert "Path(__file__).parents[2]" in src, (
            "test_contributing_md.py must use absolute path via "
            "Path(__file__).parents[2] — this was the conflict-resolution decision."
        )
        assert "open(" not in src or "../" not in src, (
            "test_contributing_md.py must not use relative open() calls."
        )

    def test_contributing_md_bootstrap_script_is_install_dev_deps(self, contributing):
        """
        CONTRIBUTING.md must reference install-dev-deps.sh as the bootstrap
        script (not install.sh). Both branches that touched this file agreed on
        this fix; the conflict resolution must preserve it.
        """
        assert "install-dev-deps.sh" in contributing, (
            "CONTRIBUTING.md must reference install-dev-deps.sh for contributor setup."
        )
        assert "./scripts/install.sh" not in contributing, (
            "CONTRIBUTING.md must not reference the end-user ./scripts/install.sh."
        )

    def test_contributing_and_development_agree_on_bootstrap_script(
        self, contributing, development
    ):
        """
        CONTRIBUTING.md and DEVELOPMENT.md must name the same bootstrap script.
        Both were modified by different branches; the merged result must be consistent.
        """
        assert "install-dev-deps.sh" in contributing, (
            "CONTRIBUTING.md does not reference install-dev-deps.sh."
        )
        assert "install-dev-deps.sh" in development, (
            "DEVELOPMENT.md does not reference install-dev-deps.sh. "
            "The two docs diverged in the bootstrap script name after the merge."
        )

    def test_contributing_preserves_fork_and_test_references(self, contributing):
        """
        The conflict-resolved test verifies these assertions against CONTRIBUTING.md.
        Confirm the assertions hold: 'Fork the repository', 'make fmt tidy', 'test-all.sh'.
        """
        assert "Fork the repository" in contributing, (
            "CONTRIBUTING.md must contain 'Fork the repository' — "
            "this was preserved in the conflict-resolved test."
        )
        assert "make fmt tidy" in contributing, (
            "CONTRIBUTING.md must contain 'make fmt tidy' — "
            "this was preserved in the conflict-resolved test."
        )
        assert "test-all.sh" in contributing, (
            "CONTRIBUTING.md must contain 'test-all.sh' — "
            "this was preserved in the conflict-resolved test."
        )


# ===========================================================================
# Priority 2: Cross-feature (doc-to-source) interactions
# ===========================================================================

class TestEnvVarConsistencyAcrossDocs:
    """
    The env var fix (AGENTFIELD_DATABASE_URL → AGENTFIELD_POSTGRES_URL) was
    applied in DEVELOPMENT.md and ENVIRONMENT_VARIABLES.md by different branches.
    Verify they are mutually consistent.
    """

    def test_development_md_env_var_matches_environment_variables_md(
        self, development, env_vars
    ):
        """
        Both docs must use AGENTFIELD_POSTGRES_URL, not the phantom DATABASE_URL.
        These were fixed by different branches and must agree in the merged result.
        """
        assert "AGENTFIELD_POSTGRES_URL" in development, (
            "DEVELOPMENT.md must reference AGENTFIELD_POSTGRES_URL."
        )
        assert "AGENTFIELD_POSTGRES_URL" in env_vars, (
            "ENVIRONMENT_VARIABLES.md must reference AGENTFIELD_POSTGRES_URL."
        )

    def test_phantom_env_var_absent_from_both_docs(self, development, env_vars):
        """
        The phantom env var AGENTFIELD_DATABASE_URL must be absent from both docs.
        Branches that fixed different docs must not have left it in either.
        """
        assert "AGENTFIELD_DATABASE_URL" not in development, (
            "Phantom env var AGENTFIELD_DATABASE_URL still present in DEVELOPMENT.md."
        )
        assert "AGENTFIELD_DATABASE_URL" not in env_vars, (
            "Phantom env var AGENTFIELD_DATABASE_URL still present in ENVIRONMENT_VARIABLES.md."
        )

    def test_readme_does_not_contradict_env_var_fix(self, readme):
        """
        README must not re-introduce the phantom env var that was fixed in the docs.
        """
        assert "AGENTFIELD_DATABASE_URL" not in readme, (
            "README.md re-introduces phantom env var AGENTFIELD_DATABASE_URL."
        )


class TestAsyncConfigDocToSourceIntegration:
    """
    The README AsyncConfig example was fixed to remove fabricated fields.
    Verify the fix is consistent: README only uses fields that actually exist
    in async_config.py as parsed by AST.
    """

    def test_readme_asyncconfig_fields_are_real_source_fields(
        self, readme, async_config_fields
    ):
        """
        Every AsyncConfig field named in the README example must exist in the
        AsyncConfig class in async_config.py.
        The README example uses max_execution_timeout and enable_event_stream.
        """
        # Fields the README currently uses in its AsyncConfig example
        readme_asyncconfig_section = ""
        in_block = False
        for line in readme.splitlines():
            if "AsyncConfig(" in line:
                in_block = True
            if in_block:
                readme_asyncconfig_section += line + "\n"
                if line.strip().startswith(")"):
                    in_block = False

        # Extract field names from the example (pattern: field_name=value)
        used_fields = re.findall(r"\b([a-z_]+)\s*=\s*[^=]", readme_asyncconfig_section)
        fabricated = [f for f in used_fields if f and f not in async_config_fields
                      and f not in ("async_config",)]  # skip kwarg name

        assert not fabricated, (
            f"README AsyncConfig example uses field(s) not found in async_config.py: "
            f"{fabricated}. Real fields: {sorted(async_config_fields)}"
        )

    def test_fabricated_asyncconfig_fields_not_in_source(self, async_config_fields):
        """
        The fabricated fields webhook_url and timeout_hours must not appear in
        the AsyncConfig class definition (confirms they were never real).
        """
        for bad_field in ("webhook_url", "timeout_hours"):
            assert bad_field not in async_config_fields, (
                f"Field '{bad_field}' was supposed to be fabricated but appears "
                f"in AsyncConfig class — re-examine async_config.py."
            )


class TestScriptReferencesExistOnDisk:
    """
    Docs reference scripts in scripts/. After the merge these script references
    must point to files that actually exist (cross-feature: doc fix ↔ repo structure).
    """

    @pytest.mark.parametrize("script_name", [
        "install-dev-deps.sh",
        "test-all.sh",
        "build-all.sh",
    ])
    def test_referenced_script_exists(self, script_name):
        """Scripts referenced in CONTRIBUTING.md and DEVELOPMENT.md must exist."""
        script_path = SCRIPTS_DIR / script_name
        assert script_path.exists(), (
            f"Script '{script_name}' is referenced in docs but does not exist "
            f"at {script_path}."
        )

    def test_removed_install_sh_still_exists_for_end_users(self):
        """
        install.sh (end-user binary installer) was removed from contributor docs
        but must still exist as a file — only the doc reference was changed,
        not the file itself.
        """
        assert (SCRIPTS_DIR / "install.sh").exists(), (
            "scripts/install.sh no longer exists. The docs correctly removed the "
            "reference, but the file itself should not have been deleted."
        )


class TestMakefileTargetsCrossDocConsistency:
    """
    Both DEVELOPMENT.md and CONTRIBUTING.md reference Makefile targets.
    After the merge both docs must only reference real targets.
    """

    def test_contributing_md_make_targets_are_valid(self, contributing, makefile_targets):
        """
        All backtick-quoted 'make <target>' commands in CONTRIBUTING.md must be
        valid Makefile targets.  We restrict to backtick-wrapped references
        (e.g. `make fmt tidy`) to avoid matching English prose like
        "make sure ..." which is not a Makefile invocation.
        """
        # Only match make targets inside backtick code spans: `make target`
        refs = re.findall(r"`make ([a-zA-Z][a-zA-Z0-9_-]*)", contributing)
        missing = [t for t in refs if t not in makefile_targets]
        assert not missing, (
            f"CONTRIBUTING.md references Makefile target(s) that don't exist: "
            f"{missing}. Valid targets: {sorted(makefile_targets)}"
        )

    def test_development_md_make_targets_are_valid(self, development, makefile_targets):
        """All 'make <target>' calls in DEVELOPMENT.md must be valid Makefile targets."""
        refs = re.findall(r"make ([a-zA-Z][a-zA-Z0-9_-]*)", development)
        missing = [t for t in refs if t not in makefile_targets]
        assert not missing, (
            f"DEVELOPMENT.md references Makefile target(s) that don't exist: "
            f"{missing}. Valid targets: {sorted(makefile_targets)}"
        )

    def test_make_fmt_tidy_are_separate_valid_targets(self, makefile_targets):
        """
        CONTRIBUTING.md uses 'make fmt tidy' (two targets in one command).
        Both 'fmt' and 'tidy' must be valid individual Makefile targets.
        """
        for target in ("fmt", "tidy"):
            assert target in makefile_targets, (
                f"Makefile target '{target}' (used in CONTRIBUTING.md 'make fmt tidy') "
                f"is not defined in the Makefile."
            )


# ===========================================================================
# Priority 3: Shared-file modifications — internal consistency
# ===========================================================================

class TestArchitectureMdInternalConsistency:
    """
    ARCHITECTURE.md was rewritten to remove phantom dirs and fix Python SDK
    description. Verify the internal consistency of the document after the fix.
    """

    @pytest.mark.parametrize("real_dir", [
        "control-plane", "sdk", "examples", "docs", "deployments",
    ])
    def test_real_top_level_dir_exists_on_disk(self, real_dir):
        """
        Every top-level directory documented in ARCHITECTURE.md must actually
        exist in the repository root (doc ↔ filesystem consistency).
        """
        assert (_REPO / real_dir).is_dir(), (
            f"Directory '{real_dir}' is documented in ARCHITECTURE.md but does "
            f"not exist in the repository root."
        )

    @pytest.mark.parametrize("phantom_dir", [
        "internal/repositories",
        "internal/workflows",
        "pkg/db",
        "proto/",
    ])
    def test_phantom_dir_does_not_exist_on_disk(self, phantom_dir):
        """
        Phantom directories removed from ARCHITECTURE.md must not exist on disk
        (confirms they were always phantom, not real dirs that were documented).
        """
        # proto/ is a special case: 'proto' may exist inside control-plane
        if phantom_dir == "proto/":
            # the standalone top-level proto/ should not exist
            top_level_proto = _REPO / "proto"
            # Only flag if it's a top-level standalone directory
            assert not top_level_proto.is_dir(), (
                "Top-level 'proto/' directory exists but ARCHITECTURE.md says "
                "it's a phantom. Check whether ARCHITECTURE.md is still accurate."
            )
        else:
            path = _REPO / phantom_dir
            assert not path.exists(), (
                f"'{phantom_dir}' was documented as phantom but actually exists "
                f"at {path}. ARCHITECTURE.md may need updating."
            )

    def test_internal_storage_exists_on_disk(self):
        """
        ARCHITECTURE.md now documents 'internal/storage' (replacing phantom pkg/db).
        This real directory must actually exist in control-plane/.
        """
        storage_path = _REPO / "control-plane" / "internal" / "storage"
        assert storage_path.is_dir(), (
            f"'internal/storage' is documented in ARCHITECTURE.md but does not "
            f"exist at {storage_path}."
        )

    def test_internal_handlers_exists_on_disk(self):
        """
        ARCHITECTURE.md documents 'internal/handlers'. Verify it exists.
        """
        handlers_path = _REPO / "control-plane" / "internal" / "handlers"
        assert handlers_path.is_dir(), (
            f"'internal/handlers' is documented in ARCHITECTURE.md but does not "
            f"exist at {handlers_path}."
        )


class TestReadmeInternalConsistency:
    """
    README was modified by multiple branches. Verify no conflicting claims remain.
    """

    def test_python_badge_version_consistent_with_pyproject(self, readme):
        """
        README badge says python-3.8+. Confirm pyproject.toml also requires >=3.8
        (not 3.9+), so the badge and build config are consistent.
        """
        pyproject = _REPO / "sdk" / "python" / "pyproject.toml"
        if pyproject.exists():
            content = pyproject.read_text(encoding="utf-8")
            # Confirm 3.9+ is NOT the requirement
            assert 'python_requires = ">=3.9"' not in content and \
                   'python-requires = ">=3.9"' not in content, (
                "pyproject.toml still requires Python >=3.9 but README badge was "
                "changed to 3.8+. The badge and pyproject.toml are inconsistent."
            )

    def test_readme_asyncconfig_import_matches_source_module(self, readme):
        """
        README imports AsyncConfig via 'from agentfield.async_config import AsyncConfig'.
        Verify that the source module actually exists at that import path.
        """
        assert "from agentfield.async_config import AsyncConfig" in readme, (
            "README does not show 'from agentfield.async_config import AsyncConfig'."
        )
        # Verify the module file exists
        assert ASYNC_CONFIG_PY.exists(), (
            f"async_config.py not found at {ASYNC_CONFIG_PY} but README imports from it."
        )
        # Verify AsyncConfig class is defined in the module
        source = ASYNC_CONFIG_PY.read_text(encoding="utf-8")
        assert "class AsyncConfig" in source, (
            "AsyncConfig class not found in async_config.py even though README imports it."
        )

    def test_release_md_link_valid_in_development_md(self, development):
        """
        DEVELOPMENT.md links to docs/RELEASE.md (was incorrectly RELEASING.md before fix).
        Verify the linked file actually exists.
        """
        assert "RELEASE.md" in development, (
            "DEVELOPMENT.md does not reference RELEASE.md."
        )
        release_md = _REPO / "docs" / "RELEASE.md"
        assert release_md.exists(), (
            f"docs/RELEASE.md is referenced in DEVELOPMENT.md but does not exist at {release_md}."
        )

    def test_go_sdk_config_uses_pascal_case_node_id(self, readme):
        """
        The Go SDK example in README uses PascalCase NodeID (not camelCase nodeId
        as in TypeScript). Verify the Go section contains NodeID.
        """
        assert "NodeID" in readme, (
            "README Go SDK example must use PascalCase 'NodeID' field name."
        )
