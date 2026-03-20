package harness

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCodexProvider_Execute(t *testing.T) {
	origRunCLI := RunCLI
	defer func() { RunCLI = origRunCLI }()

	t.Run("success JSONL parsing", func(t *testing.T) {
		RunCLI = func(ctx context.Context, cmd []string, env map[string]string, cwd string, timeout int) (*CLIResult, error) {
			assert.Equal(t, "codex", cmd[0])
			assert.Contains(t, cmd, "exec")
			assert.Contains(t, cmd, "--json")
			assert.Contains(t, cmd, "test prompt")

			jsonl := `{"type":"thread.started", "thread_id":"t-123"}
{"type":"turn.completed", "text":"intermediate text"}
{"type":"item.completed", "item":{"type":"agent_message", "text":"final text"}}
{"type":"result", "result":"ultimate text"}`

			return &CLIResult{
				Stdout:     jsonl,
				Stderr:     "",
				ReturnCode: 0,
			}, nil
		}

		provider := NewCodexProvider("")
		res, err := provider.Execute(context.Background(), "test prompt", Options{})
		require.NoError(t, err)
		assert.False(t, res.IsError)
		// Should pick up the last valid match per our loop in codex.go
		assert.Equal(t, "ultimate text", res.Result)
		assert.Equal(t, "t-123", res.Metrics.SessionID)
		assert.Equal(t, 1, res.Metrics.NumTurns) // From turn.completed
	})

	t.Run("crash without output", func(t *testing.T) {
		RunCLI = func(ctx context.Context, cmd []string, env map[string]string, cwd string, timeout int) (*CLIResult, error) {
			return &CLIResult{
				Stdout:     "",
				Stderr:     "codex crashed badly",
				ReturnCode: 2,
			}, nil
		}

		provider := NewCodexProvider("")
		res, err := provider.Execute(context.Background(), "test prompt", Options{})
		require.NoError(t, err)
		assert.True(t, res.IsError)
		assert.Equal(t, FailureCrash, res.FailureType)
		assert.Contains(t, res.ErrorMessage, "codex crashed badly")
	})
}
