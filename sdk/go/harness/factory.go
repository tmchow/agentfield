package harness

import "fmt"

const (
	// ProviderCodex is the provider name for Codex CLI.
	ProviderCodex = "codex"
	// ProviderGemini is the provider name for Gemini CLI.
	ProviderGemini = "gemini"
)

// BuildProvider instantiates the correct provider implementation based on the selected provider name.
func BuildProvider(opts Options, defaultOpts Options) (Provider, error) {
	switch opts.Provider {
	case ProviderOpenCode:
		binPath := opts.BinPath
		if binPath == "" {
			binPath = defaultOpts.BinPath
		}
		return NewOpenCodeProvider(binPath, ""), nil
	case ProviderClaudeCode:
		binPath := opts.BinPath
		if binPath == "" {
			binPath = defaultOpts.BinPath
		}
		return NewClaudeCodeProvider(binPath), nil
	case ProviderCodex:
		binPath := opts.BinPath
		if binPath == "" {
			binPath = defaultOpts.BinPath
		}
		return NewCodexProvider(binPath), nil
	case ProviderGemini:
		binPath := opts.BinPath
		if binPath == "" {
			binPath = defaultOpts.BinPath
		}
		return NewGeminiProvider(binPath), nil
	default:
		return nil, fmt.Errorf(
			"unknown harness provider: %q (supported: %s, %s, %s, %s)",
			opts.Provider,
			ProviderClaudeCode,
			ProviderCodex,
			ProviderGemini,
			ProviderOpenCode,
		)
	}
}
