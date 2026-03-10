package server

import (
	"context"
	"fmt"
	"time"

	"github.com/Agent-Field/agentfield/control-plane/internal/config"
	"github.com/Agent-Field/agentfield/control-plane/internal/storage"
	"gopkg.in/yaml.v3"
)

const dbConfigKey = "agentfield.yaml"

// overlayDBConfig loads config from the database and merges it into the
// existing config. The storage section is preserved from the original config
// to avoid the bootstrap problem (DB connection settings can't come from DB).
// Precedence: env vars > DB config > file config > defaults.
func overlayDBConfig(cfg *config.Config, store storage.StorageProvider) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	entry, err := store.GetConfig(ctx, dbConfigKey)
	if err != nil {
		return fmt.Errorf("failed to read config from database: %w", err)
	}
	if entry == nil {
		fmt.Println("[config] No database config found (key: agentfield.yaml), using file/env config only.")
		return nil
	}

	// Preserve the storage config — it must always come from file/env (bootstrap)
	savedStorage := cfg.Storage

	// Parse the DB-stored YAML into a config struct
	var dbCfg config.Config
	if err := yaml.Unmarshal([]byte(entry.Value), &dbCfg); err != nil {
		return fmt.Errorf("failed to parse database config YAML: %w", err)
	}

	// Overlay non-zero DB values onto the existing config
	mergeDBConfig(cfg, &dbCfg)

	// Restore storage config (never overridden from DB)
	cfg.Storage = savedStorage

	fmt.Printf("[config] Loaded config from database (key: %s, version: %d, updated: %s)\n",
		entry.Key, entry.Version, entry.UpdatedAt.Format(time.RFC3339))
	return nil
}

// mergeDBConfig selectively merges DB config values into the target config.
// Only non-zero/non-empty values from the DB config are applied.
func mergeDBConfig(target, dbCfg *config.Config) {
	// AgentField settings
	if dbCfg.AgentField.Port != 0 {
		target.AgentField.Port = dbCfg.AgentField.Port
	}
	if dbCfg.AgentField.NodeHealth.CheckInterval != 0 {
		target.AgentField.NodeHealth = dbCfg.AgentField.NodeHealth
	}
	if dbCfg.AgentField.ExecutionCleanup.RetentionPeriod != 0 {
		target.AgentField.ExecutionCleanup = dbCfg.AgentField.ExecutionCleanup
	}
	if dbCfg.AgentField.Approval.WebhookSecret != "" || dbCfg.AgentField.Approval.DefaultExpiryHours != 0 {
		target.AgentField.Approval = dbCfg.AgentField.Approval
	}

	// Features
	if dbCfg.Features.DID.Method != "" {
		target.Features.DID = dbCfg.Features.DID
	}
	if dbCfg.Features.Connector.Enabled || len(dbCfg.Features.Connector.Capabilities) > 0 {
		target.Features.Connector = dbCfg.Features.Connector
	}

	// API settings (but never override API key from DB for security)
	if len(dbCfg.API.CORS.AllowedOrigins) > 0 {
		target.API.CORS = dbCfg.API.CORS
	}

	// UI settings
	if dbCfg.UI.Mode != "" {
		target.UI = dbCfg.UI
	}
}
