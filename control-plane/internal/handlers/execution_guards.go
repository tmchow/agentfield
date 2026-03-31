package handlers

import (
	"sync"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/events"
	"github.com/Agent-Field/agentfield/control-plane/internal/services"
)

// Package-level reference to LLM health monitor for execution guards.
// Set during server startup via SetLLMHealthMonitor.
var (
	llmHealthMonitor     *services.LLMHealthMonitor
	llmHealthMonitorOnce sync.Once
	llmHealthMonitorMu   sync.RWMutex
)

// SetLLMHealthMonitor registers the LLM health monitor for execution guards.
func SetLLMHealthMonitor(monitor *services.LLMHealthMonitor) {
	llmHealthMonitorMu.Lock()
	defer llmHealthMonitorMu.Unlock()
	llmHealthMonitor = monitor
}

// GetLLMHealthMonitor returns the registered LLM health monitor, or nil.
func GetLLMHealthMonitor() *services.LLMHealthMonitor {
	llmHealthMonitorMu.RLock()
	defer llmHealthMonitorMu.RUnlock()
	return llmHealthMonitor
}

// CheckExecutionPreconditions verifies that shared execution preconditions are met:
// - LLM backend is reachable (circuit breaker is not open)
// - Agent has not exceeded its concurrent execution limit
//
// Returns nil if all checks pass, or an error describing the blocking condition.
func CheckExecutionPreconditions(agentNodeID string) error {
	// Check LLM health
	monitor := GetLLMHealthMonitor()
	if monitor != nil && !monitor.IsAnyEndpointHealthy() {
		statuses := monitor.GetAllStatuses()
		if len(statuses) > 0 {
			lastErr := ""
			for _, s := range statuses {
				if s.LastError != "" {
					lastErr = s.LastError
					break
				}
			}
			if lastErr != "" {
				return &executionPreconditionError{
					code:    503,
					message: "LLM backend unavailable: " + lastErr,
				}
			}
		}
		return &executionPreconditionError{
			code:    503,
			message: "all configured LLM backends are unavailable",
		}
	}

	// Check per-agent concurrency limit
	limiter := GetConcurrencyLimiter()
	if err := limiter.Acquire(agentNodeID); err != nil {
		return &executionPreconditionError{
			code:    429,
			message: err.Error(),
		}
	}

	return nil
}

// ReleaseExecutionSlot releases the concurrency slot for the given agent.
// Safe to call even if concurrency limiting is disabled.
func ReleaseExecutionSlot(agentNodeID string) {
	limiter := GetConcurrencyLimiter()
	limiter.Release(agentNodeID)
}

// executionPreconditionError carries both an HTTP status code and message.
type executionPreconditionError struct {
	code    int
	message string
}

func (e *executionPreconditionError) Error() string {
	return e.message
}

// HTTPStatusCode returns the appropriate HTTP status code for this error.
func (e *executionPreconditionError) HTTPStatusCode() int {
	return e.code
}

// PublishExecutionLog publishes a structured log event for an execution.
// These events are streamed to SSE clients watching the execution.
func PublishExecutionLog(executionID, workflowID, agentNodeID, level, message string, metadata map[string]interface{}) {
	data := map[string]interface{}{
		"level":   level,
		"message": message,
	}
	if metadata != nil {
		data["metadata"] = metadata
	}

	events.GlobalExecutionEventBus.Publish(events.ExecutionEvent{
		Type:        events.ExecutionLogEntry,
		ExecutionID: executionID,
		WorkflowID:  workflowID,
		AgentNodeID: agentNodeID,
		Status:      level,
		Timestamp:   time.Now(),
		Data:        data,
	})
}
