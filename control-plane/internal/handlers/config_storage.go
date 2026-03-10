package handlers

import (
	"io"
	"net/http"

	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
	"github.com/gin-gonic/gin"
)

// ConfigStorageHandlers provides HTTP handlers for database-backed configuration.
type ConfigStorageHandlers struct {
	storage storage.StorageProvider
}

// NewConfigStorageHandlers creates a new ConfigStorageHandlers instance.
func NewConfigStorageHandlers(store storage.StorageProvider) *ConfigStorageHandlers {
	return &ConfigStorageHandlers{storage: store}
}

// RegisterRoutes registers config storage routes on the given router group.
func (h *ConfigStorageHandlers) RegisterRoutes(group *gin.RouterGroup) {
	group.GET("/configs", h.ListConfigs)
	group.GET("/configs/:key", h.GetConfig)
	group.PUT("/configs/:key", h.SetConfig)
	group.DELETE("/configs/:key", h.DeleteConfig)
}

// ListConfigs returns all stored configuration entries.
func (h *ConfigStorageHandlers) ListConfigs(c *gin.Context) {
	entries, err := h.storage.ListConfigs(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if entries == nil {
		entries = []*storage.ConfigEntry{}
	}
	c.JSON(http.StatusOK, gin.H{
		"configs": entries,
		"total":   len(entries),
	})
}

// GetConfig returns a specific configuration entry by key.
func (h *ConfigStorageHandlers) GetConfig(c *gin.Context) {
	key := c.Param("key")
	entry, err := h.storage.GetConfig(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if entry == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "config not found", "key": key})
		return
	}
	c.JSON(http.StatusOK, entry)
}

// SetConfig creates or updates a configuration entry.
// Accepts raw YAML/text body as the config value.
func (h *ConfigStorageHandlers) SetConfig(c *gin.Context) {
	key := c.Param("key")

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}
	if len(body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request body is empty"})
		return
	}

	updatedBy := c.GetHeader("X-Updated-By")
	if updatedBy == "" {
		updatedBy = "api"
	}

	if err := h.storage.SetConfig(c.Request.Context(), key, string(body), updatedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return the saved entry
	entry, err := h.storage.GetConfig(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "config saved",
		"config":  entry,
	})
}

// DeleteConfig removes a configuration entry by key.
func (h *ConfigStorageHandlers) DeleteConfig(c *gin.Context) {
	key := c.Param("key")
	if err := h.storage.DeleteConfig(c.Request.Context(), key); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "config deleted", "key": key})
}
