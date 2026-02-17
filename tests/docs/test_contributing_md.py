"""Tests for docs/CONTRIBUTING.md correctness."""
import pathlib


def test_contributing_md_content():
    content = pathlib.Path("docs/CONTRIBUTING.md").read_text()

    assert "install-dev-deps.sh" in content, "Developer bootstrap script must be referenced"
    assert "./scripts/install.sh" not in content, "End-user binary installer must not be referenced"
    assert len(content) > 100 and "#" in content, "File must be a non-trivial markdown document"
    assert "Fork the repository" in content, "Fork instructions must be preserved"
    assert "make fmt tidy" in content, "make fmt tidy reference must be preserved"
    assert "test-all.sh" in content, "test-all.sh reference must be preserved"
