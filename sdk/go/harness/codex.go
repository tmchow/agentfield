package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// CodexProvider invokes the Codex CLI as a subprocess.
type CodexProvider struct {
	BinPath string
}

// NewCodexProvider creates a Codex provider. If binPath is empty,
// it defaults to "codex".
func NewCodexProvider(binPath string) *CodexProvider {
	if binPath == "" {
		binPath = "codex"
	}
	return &CodexProvider{BinPath: binPath}
}

// CodexEvent represents a single JSONL event emitted by the Codex CLI.
type CodexEvent struct {
	Type     string `json:"type"`
	ThreadID string `json:"thread_id,omitempty"`
	Text     string `json:"text,omitempty"`
	Result   string `json:"result,omitempty"`
	Content  string `json:"content,omitempty"`
	Item     *struct {
		Type string `json:"type,omitempty"`
		Text string `json:"text,omitempty"`
	} `json:"item,omitempty"`
}

func (p *CodexProvider) Execute(ctx context.Context, prompt string, options Options) (*RawResult, error) {
	cmd := []string{p.BinPath, "exec", "--json"}

	if options.Cwd != "" {
		cmd = append(cmd, "-C", options.Cwd)
	}
	if options.PermissionMode == "auto" {
		cmd = append(cmd, "--full-auto")
	}

	cmd = append(cmd, prompt)

	env := make(map[string]string)
	for k, v := range options.Env {
		env[k] = v
	}

	startAPI := time.Now()

	cliResult, err := RunCLI(ctx, cmd, env, options.Cwd, options.timeout())
	apiMS := int(time.Since(startAPI).Milliseconds())

	if err != nil {
		if isExecNotFound(err) {
			return &RawResult{
				IsError: true,
				ErrorMessage: fmt.Sprintf(
					"Codex binary not found at '%s'. Install Codex CLI: https://github.com/openai/codex",
					p.BinPath,
				),
				FailureType: FailureCrash,
				Metrics:     Metrics{},
			}, nil
		}
		if strings.Contains(err.Error(), "timed out") {
			return &RawResult{
				IsError:      true,
				ErrorMessage: err.Error(),
				FailureType:  FailureTimeout,
				Metrics:      Metrics{DurationAPIMS: apiMS},
			}, nil
		}
		return nil, err
	}

	var events []CodexEvent
	for _, line := range strings.Split(strings.TrimSpace(cliResult.Stdout), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var event CodexEvent
		if err := json.Unmarshal([]byte(line), &event); err == nil {
			events = append(events, event)
		}
	}

	var resultText string
	numTurns := 0
	sessionID := ""

	for _, event := range events {
		switch event.Type {
		case "item.completed":
			if event.Item != nil && event.Item.Type == "agent_message" && event.Item.Text != "" {
				resultText = event.Item.Text
			}
		case "result":
			if event.Result != "" {
				resultText = event.Result
			} else if event.Text != "" {
				resultText = event.Text
			}
		case "turn.completed":
			numTurns++
			if event.Text != "" {
				resultText = event.Text
			}
		case "message", "assistant":
			if event.Content != "" {
				resultText = event.Content
			} else if event.Text != "" {
				resultText = event.Text
			}
		case "thread.started":
			sessionID = event.ThreadID
		}
	}

	cleanStderr := StripANSI(strings.TrimSpace(cliResult.Stderr))

	var messages []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(cliResult.Stdout), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var msg map[string]any
		if err := json.Unmarshal([]byte(line), &msg); err == nil {
			messages = append(messages, msg)
		}
	}

	raw := &RawResult{
		Result:   resultText,
		Messages: messages,
		Metrics: Metrics{
			DurationAPIMS: apiMS,
			NumTurns:      numTurns,
			SessionID:     sessionID,
		},
		ReturnCode: cliResult.ReturnCode,
	}

	if cliResult.ReturnCode < 0 {
		raw.FailureType = FailureCrash
		raw.IsError = true
		if cleanStderr != "" {
			raw.ErrorMessage = fmt.Sprintf("Process killed by signal %d. stderr: %.500s",
				-cliResult.ReturnCode, cleanStderr)
		} else {
			raw.ErrorMessage = fmt.Sprintf("Process killed by signal %d.", -cliResult.ReturnCode)
		}
	} else if cliResult.ReturnCode != 0 && resultText == "" {
		raw.FailureType = FailureCrash
		raw.IsError = true
		if cleanStderr != "" {
			raw.ErrorMessage = truncate(cleanStderr, 1000)
		} else {
			raw.ErrorMessage = fmt.Sprintf("Process exited with code %d and produced no output.", cliResult.ReturnCode)
		}
	}

	return raw, nil
}
