package ui

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/events"
	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
	"github.com/Agent-Field/agentfield/control-plane/internal/services"
	"github.com/gin-gonic/gin"
)

// ExecutionLogsHandler handles real-time execution log streaming.
type ExecutionLogsHandler struct {
	llmHealthMonitor *services.LLMHealthMonitor
}

// NewExecutionLogsHandler creates a new ExecutionLogsHandler.
func NewExecutionLogsHandler(llmHealthMonitor *services.LLMHealthMonitor) *ExecutionLogsHandler {
	return &ExecutionLogsHandler{
		llmHealthMonitor: llmHealthMonitor,
	}
}

// StreamExecutionLogsHandler streams real-time log events for a specific execution via SSE.
// GET /api/ui/v1/executions/:executionId/logs/stream
func (h *ExecutionLogsHandler) StreamExecutionLogsHandler(c *gin.Context) {
	executionID := c.Param("execution_id")
	if executionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "executionId is required"})
		return
	}

	// Set headers for SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no")

	subscriberID := fmt.Sprintf("exec_logs_%s_%d_%s", executionID, time.Now().UnixNano(), c.ClientIP())

	eventChan := events.GlobalExecutionEventBus.Subscribe(subscriberID)
	defer events.GlobalExecutionEventBus.Unsubscribe(subscriberID)

	// Send initial connection confirmation
	initialEvent := map[string]interface{}{
		"type":         "connected",
		"execution_id": executionID,
		"message":      "Execution log stream connected",
		"timestamp":    time.Now().Format(time.RFC3339),
	}
	if eventJSON, err := json.Marshal(initialEvent); err == nil {
		if !writeSSE(c, eventJSON) {
			return
		}
	}

	ctx := c.Request.Context()
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	logger.Logger.Debug().
		Str("execution_id", executionID).
		Str("subscriber", subscriberID).
		Msg("Execution log SSE client connected")

	for {
		select {
		case event := <-eventChan:
			// Filter to only events for this execution
			if event.ExecutionID != executionID {
				continue
			}

			eventData, err := json.Marshal(event)
			if err != nil {
				logger.Logger.Error().Err(err).Msg("Error marshalling execution event")
				continue
			}
			if !writeSSE(c, eventData) {
				return
			}

		case <-heartbeatTicker.C:
			heartbeat := map[string]interface{}{
				"type":      "heartbeat",
				"timestamp": time.Now().Format(time.RFC3339),
			}
			if heartbeatJSON, err := json.Marshal(heartbeat); err == nil {
				if !writeSSE(c, heartbeatJSON) {
					return
				}
			}

		case <-ctx.Done():
			logger.Logger.Debug().
				Str("execution_id", executionID).
				Msg("Execution log SSE client disconnected")
			return
		}
	}
}

// GetLLMHealthHandler returns the health status of all configured LLM endpoints.
// GET /api/ui/v1/llm/health
func (h *ExecutionLogsHandler) GetLLMHealthHandler(c *gin.Context) {
	if h.llmHealthMonitor == nil {
		c.JSON(http.StatusOK, gin.H{
			"enabled":   false,
			"endpoints": []interface{}{},
		})
		return
	}

	statuses := h.llmHealthMonitor.GetAllStatuses()
	anyHealthy := h.llmHealthMonitor.IsAnyEndpointHealthy()

	c.JSON(http.StatusOK, gin.H{
		"enabled":     true,
		"healthy":     anyHealthy,
		"endpoints":   statuses,
		"checked_at":  time.Now().Format(time.RFC3339),
	})
}
