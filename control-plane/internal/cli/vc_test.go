package cli

import (
	"strings"
	"testing"
)

func TestValidateExternalURLRejectsUnsafeShapes(t *testing.T) {
	cases := []string{
		"http://example.com/did.json",
		"https:///did.json",
		"https://user:pass@example.com/did.json",
	}

	for _, rawURL := range cases {
		if _, err := validateExternalURL(rawURL); err == nil {
			t.Fatalf("expected validateExternalURL to reject %q", rawURL)
		}
	}
}

func TestResolveWebDIDAcceptsEncodedPort(t *testing.T) {
	_, err := resolveWebDID("did:web:example.com%3A8443:agents:test-agent")
	if err == nil {
		t.Fatalf("expected network fetch to fail in test environment")
	}
	if strings.Contains(err.Error(), "invalid did:web domain") || strings.Contains(err.Error(), "invalid URL") {
		t.Fatalf("expected encoded port to be accepted before fetch, got %v", err)
	}
}
