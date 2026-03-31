# E2E Resilience Tests

Tests for execution resilience features described in [#316](https://github.com/Agent-Field/agentfield/issues/316) and tracked in [#318](https://github.com/Agent-Field/agentfield/issues/318).

## What's tested

| Test | What it validates |
|------|-------------------|
| **LLM health monitoring** | Control plane detects when LLM backend (LiteLLM) goes down |
| **Circuit breaker** | Transitions: closed → open → half-open → closed |
| **Execution rejection** | Returns HTTP 503 when LLM circuit is open instead of hanging |
| **LLM freeze simulation** | Exact #316 scenario: LLM hangs, circuit opens, unfreeze recovers |
| **Per-agent concurrency** | Limits concurrent executions per agent (configurable) |
| **Node status** | Agent health reflected in API |
| **SSE log streaming** | Real-time execution event stream works |

## Quick start

```bash
# From repo root
cd examples/e2e_resilience_tests
./run_tests.sh
```

This will:
1. Start a mock LLM server (port 14000)
2. Build and start the control plane (port 18080) with LLM health monitoring enabled
3. Start 3 test agents (healthy, slow, flaky)
4. Run all tests
5. Clean up everything on exit

## Manual testing

### 1. Simulate LLM going down (the #316 scenario)

```bash
# Start mock LLM
python3 mock_llm_server.py 4000 &

# Start control plane with LLM health monitoring
AGENTFIELD_LLM_HEALTH_ENABLED=true \
AGENTFIELD_LLM_HEALTH_ENDPOINT=http://localhost:4000/health \
AGENTFIELD_LLM_HEALTH_ENDPOINT_NAME=litellm \
AGENTFIELD_LLM_HEALTH_CHECK_INTERVAL=5s \
AGENTFIELD_LLM_HEALTH_FAILURE_THRESHOLD=3 \
AGENTFIELD_LLM_HEALTH_RECOVERY_TIMEOUT=15s \
  go run ./cmd/agentfield-server

# Check LLM health
curl http://localhost:8080/api/ui/v1/llm/health | python3 -m json.tool

# Freeze the LLM (simulates LiteLLM hanging)
curl -X POST http://localhost:4000/freeze

# Wait ~15 seconds, check again
curl http://localhost:8080/api/ui/v1/llm/health | python3 -m json.tool
# Should show: "healthy": false, "circuit_state": "open"

# Try to execute - should get 503 instead of hanging
curl -X POST http://localhost:8080/api/v1/execute/my-agent.my-skill \
  -H "Content-Type: application/json" \
  -d '{"input":{"text":"test"}}'
# Should return: {"error": "all configured LLM backends are unavailable"}

# Unfreeze the LLM
curl -X POST http://localhost:4000/unfreeze

# Wait ~20 seconds for circuit breaker recovery
curl http://localhost:8080/api/ui/v1/llm/health | python3 -m json.tool
# Should show: "healthy": true, "circuit_state": "closed"
```

### 2. Test concurrency limits

```bash
# Start control plane with max 3 concurrent per agent
AGENTFIELD_MAX_CONCURRENT_PER_AGENT=3 go run ./cmd/agentfield-server

# Submit 5 slow jobs - 4th and 5th should be rejected with 429
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:8080/api/v1/execute/async/test-slow.slow_task \
    -H "Content-Type: application/json" \
    -d '{"input":{"duration_seconds":30}}' &
done
wait
```

### 3. Test execution retry

```bash
# Start with retry enabled (max 2 retries)
AGENTFIELD_EXECUTION_MAX_RETRIES=2 \
AGENTFIELD_EXECUTION_RETRY_BACKOFF=10s \
  go run ./cmd/agentfield-server

# Submit a job that will get stuck, wait for stale reaper
# Check workflow_executions table - retry_count should increment
```

### 4. Watch execution logs in real-time

```bash
# Submit a job
EXEC_ID=$(curl -s -X POST http://localhost:8080/api/v1/execute/async/my-agent.my-skill \
  -H "Content-Type: application/json" \
  -d '{"input":{}}' | python3 -c "import json,sys; print(json.load(sys.stdin)['execution_id'])")

# Stream logs
curl -N http://localhost:8080/api/ui/v1/executions/$EXEC_ID/logs/stream
```

## Configuration reference

| Env var | Default | Description |
|---------|---------|-------------|
| `AGENTFIELD_LLM_HEALTH_ENABLED` | false | Enable LLM health monitoring |
| `AGENTFIELD_LLM_HEALTH_ENDPOINT` | - | URL to probe (e.g. `http://localhost:4000/health`) |
| `AGENTFIELD_LLM_HEALTH_ENDPOINT_NAME` | default | Display name for the endpoint |
| `AGENTFIELD_LLM_HEALTH_CHECK_INTERVAL` | 15s | How often to check |
| `AGENTFIELD_LLM_HEALTH_CHECK_TIMEOUT` | 5s | Timeout per check |
| `AGENTFIELD_LLM_HEALTH_FAILURE_THRESHOLD` | 3 | Failures before circuit opens |
| `AGENTFIELD_LLM_HEALTH_RECOVERY_TIMEOUT` | 30s | How long circuit stays open before testing recovery |
| `AGENTFIELD_MAX_CONCURRENT_PER_AGENT` | 0 (unlimited) | Max concurrent executions per agent |
| `AGENTFIELD_EXECUTION_MAX_RETRIES` | 0 (disabled) | Max auto-retries for timed-out executions |
| `AGENTFIELD_EXECUTION_RETRY_BACKOFF` | 30s | Backoff between retries |

## Mock LLM server

`mock_llm_server.py` simulates an LLM backend with controllable state:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Returns 200 (healthy) or 500 (error) or hangs (frozen) |
| `GET /state` | Current server state |
| `POST /freeze` | Make all requests hang (simulates LiteLLM freeze) |
| `POST /unfreeze` | Resume normal operation |
| `POST /error` | Make `/health` return 500 |
| `POST /recover` | Make `/health` return 200 |
| `POST /v1/chat/completions` | Fake LLM response (or hang if frozen) |

## Test agents

| Agent | Purpose |
|-------|---------|
| `agent_healthy.py` | Instant responses, baseline/control |
| `agent_slow.py` | Configurable delay, tests concurrency and stale detection |
| `agent_flaky.py` | Intermittent failures, tests retry and error visibility |
