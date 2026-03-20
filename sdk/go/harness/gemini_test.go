package harness

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiProvider_Execute(t *testing.T) {
	origRunCLI := RunCLI
	defer func() { RunCLI = origRunCLI }()

	t.Run("success", func(t *testing.T) {
		RunCLI = func(ctx context.Context, cmd []string, env map[string]string, cwd string, timeout int) (*CLIResult, error) {
			assert.Equal(t, "gemini", cmd[0])
			assert.Contains(t, cmd, "test prompt")
			assert.Contains(t, cmd, "-m")
			assert.Contains(t, cmd, "gemini-1.5-pro")

			return &CLIResult{
				Stdout:     "gemini output",
				Stderr:     "",
				ReturnCode: 0,
			}, nil
		}

		provider := NewGeminiProvider("")
		res, err := provider.Execute(context.Background(), "test prompt", Options{
			Model: "gemini-1.5-pro",
		})
		require.NoError(t, err)
		assert.False(t, res.IsError)
		assert.Equal(t, "gemini output", res.Result)
		assert.Equal(t, 1, res.Metrics.NumTurns)
	})

	t.Run("crash without output", func(t *testing.T) {
		RunCLI = func(ctx context.Context, cmd []string, env map[string]string, cwd string, timeout int) (*CLIResult, error) {
			return &CLIResult{
				Stdout:     "",
				Stderr:     "some crash details",
				ReturnCode: 1,
			}, nil
		}

		provider := NewGeminiProvider("")
		res, err := provider.Execute(context.Background(), "test prompt", Options{})
		require.NoError(t, err)
		assert.True(t, res.IsError)
		assert.Equal(t, FailureCrash, res.FailureType)
		assert.Contains(t, res.ErrorMessage, "some crash details")
	})
}
