package handlers

import (
	"net/http"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
	"github.com/Agent-Field/agentfield/control-plane/pkg/types"
	"github.com/gin-gonic/gin"
)

// AccessControlConfig holds configuration for memory access control enforcement.
type AccessControlConfig struct {
	// Enabled determines if access control metadata is enforced
	Enabled bool
	// AuditLogEnabled enables audit logging for memory access
	AuditLogEnabled bool
}

// DefaultAccessControlConfig returns a default access control configuration.
func DefaultAccessControlConfig() AccessControlConfig {
	return AccessControlConfig{
		Enabled:         false,
		AuditLogEnabled: false,
	}
}

// checkAccessControl validates the access control metadata on a memory record.
// Returns true if access is allowed, false otherwise.
func checkAccessControl(c *gin.Context, memory *types.Memory, callerAgentID string, config AccessControlConfig) bool {
	if !config.Enabled {
		return true
	}

	if memory == nil || memory.Metadata.AccessControl == nil {
		return true
	}

	acl := memory.Metadata.AccessControl

	// Audit logging
	if acl.AuditAccess {
		logMemoryAccess(c, memory, callerAgentID)
	}

	// Check required roles
	if len(acl.RequiredRoles) > 0 {
		callerRoles := getCallerRoles(c)
		if !hasRequiredRole(callerRoles, acl.RequiredRoles) {
			return false
		}
	}

	// Check team restriction
	if acl.TeamRestricted {
		// Team restriction requires the caller to be in the same team
		callerTeam := c.GetHeader("X-Team-ID")
		memoryTeam := getMemoryTeam(memory)
		if callerTeam != memoryTeam {
			return false
		}
	}

	return true
}

// hasRequiredRole checks if the caller has at least one of the required roles.
func hasRequiredRole(callerRoles []string, requiredRoles []string) bool {
	for _, required := range requiredRoles {
		for _, caller := range callerRoles {
			if caller == required {
				return true
			}
		}
	}
	return false
}

// getCallerRoles extracts the caller's roles from the request headers.
func getCallerRoles(c *gin.Context) []string {
	rolesHeader := c.GetHeader("X-Agent-Roles")
	if rolesHeader == "" {
		return nil
	}

	roles := splitAndTrim(rolesHeader, ",")
	return roles
}

// splitAndTrim splits a string by separator and trims whitespace from each part.
func splitAndTrim(s string, sep string) []string {
	if s == "" {
		return nil
	}
	parts := make([]string, 0)
	for _, part := range splitString(s, sep) {
		trimmed := trimSpace(part)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

// splitString splits a string by separator.
func splitString(s string, sep string) []string {
	result := make([]string, 0)
	current := ""
	for i := 0; i < len(s); i++ {
		if i+len(sep) <= len(s) && s[i:i+len(sep)] == sep {
			result = append(result, current)
			current = ""
			i += len(sep) - 1
		} else {
			current += string(s[i])
		}
	}
	result = append(result, current)
	return result
}

// trimSpace removes leading and trailing whitespace from a string.
func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n') {
		end--
	}
	return s[start:end]
}

// getMemoryTeam extracts the team from memory metadata.
func getMemoryTeam(memory *types.Memory) string {
	if memory.Metadata.Custom == nil {
		return ""
	}
	if team, ok := memory.Metadata.Custom["team"]; ok {
		if teamStr, ok := team.(string); ok {
			return teamStr
		}
	}
	return ""
}

// logMemoryAccess logs an audit entry for memory access.
func logMemoryAccess(c *gin.Context, memory *types.Memory, callerAgentID string) {
	logger.Logger.Info().
		Str("caller_agent_id", callerAgentID).
		Str("memory_key", memory.Key).
		Str("memory_scope", memory.Scope).
		Str("memory_scope_id", memory.ScopeID).
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Str("remote_addr", c.ClientIP()).
		Msg("AUDIT: Memory access")
}

// EnforceAccessControlHandler wraps a handler with access control enforcement for GET operations.
func EnforceAccessControlHandler(storageProvider MemoryStorage, config AccessControlConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.Enabled {
			c.Next()
			return
		}

		// This middleware only applies to memory read operations
		// For write operations, access control is checked in the handler itself
		c.Set("access_control_config", config)
		c.Next()
	}
}

// SetMemoryWithAccessControl wraps SetMemoryHandler to support access control metadata.
func SetMemoryWithAccessControl(storageProvider MemoryStorage, config AccessControlConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		var req SetMemoryWithACLRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			// Fall back to standard set memory handler
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "invalid_request",
				Message: err.Error(),
				Code:    http.StatusBadRequest,
			})
			return
		}

		scope, scopeID := resolveScope(c, req.Scope)

		dataJSON, err := marshalDataWithLogging(req.Data, "memory_data")
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "marshal_error",
				Message: err.Error(),
				Code:    http.StatusBadRequest,
			})
			return
		}

		now := time.Now()
		memory := &types.Memory{
			Scope:     scope,
			ScopeID:   scopeID,
			Key:       req.Key,
			Data:      dataJSON,
			CreatedAt: now,
			UpdatedAt: now,
		}

		// Set access control metadata if provided
		if req.AccessControl != nil {
			memory.Metadata.AccessControl = req.AccessControl
		}

		// Set access level
		if req.AccessLevel != "" {
			memory.AccessLevel = req.AccessLevel
		}

		if err := storageProvider.SetMemory(ctx, memory); err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "storage_error",
				Message: err.Error(),
				Code:    http.StatusInternalServerError,
			})
			return
		}

		c.JSON(http.StatusOK, memory)
	}
}

// SetMemoryWithACLRequest extends SetMemoryRequest with access control fields.
type SetMemoryWithACLRequest struct {
	Key           string                       `json:"key" binding:"required"`
	Data          interface{}                  `json:"data" binding:"required"`
	Scope         *string                      `json:"scope,omitempty"`
	AccessLevel   string                       `json:"access_level,omitempty"`
	AccessControl *types.AccessControlMetadata `json:"access_control,omitempty"`
}
