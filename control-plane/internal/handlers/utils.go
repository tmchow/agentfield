package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/Agent-Field/agentfield/control-plane/internal/logger"
)

// marshalDataWithLogging marshals data to JSON with proper error handling and logging
func marshalDataWithLogging(data interface{}, fieldName string) ([]byte, error) {
	if data == nil {
		logger.Logger.Debug().Str("operation", "marshal").Str("field_name", fieldName).Bool("is_nil", true).Msg("field is nil")
		return []byte("null"), nil
	}

	// Log the type and content of data being marshaled
	logger.Logger.Debug().Str("operation", "marshal").Str("field_name", fieldName).Str("type", fmt.Sprintf("%T", data)).Msg("marshaling field")

	// Attempt to marshal with detailed error reporting
	jsonData, err := json.Marshal(data)
	if err != nil {
		logger.Logger.Error().Err(err).Str("operation", "marshal").Str("field_name", fieldName).Str("type", fmt.Sprintf("%T", data)).Msg("failed to marshal field")
		return nil, fmt.Errorf("failed to marshal %s: %w", fieldName, err)
	}

	logger.Logger.Debug().Str("operation", "marshal").Str("field_name", fieldName).Int("size_bytes", len(jsonData)).Msg("field marshaled successfully")
	return jsonData, nil
}
