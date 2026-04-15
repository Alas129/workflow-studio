from __future__ import annotations

from fastapi import APIRouter

from app.models.steps import StepDefinition, ParameterSchema, ParameterType

router = APIRouter(prefix="/step-templates", tags=["Step Templates"])


def _get_builtin_definitions() -> list[StepDefinition]:
    return [
        StepDefinition(
            type="http_request",
            label="HTTP Request",
            category="Requests",
            description="Send a generic HTTP request",
            icon="globe",
            color="#4A90D9",
            parameters=[
                ParameterSchema(name="url", label="URL", type=ParameterType.STRING, required=True, placeholder="https://api.example.com/endpoint"),
                ParameterSchema(name="method", label="Method", type=ParameterType.SELECT, default="POST", enum_values=["GET", "POST", "PUT", "DELETE"]),
                ParameterSchema(name="headers", label="Headers", type=ParameterType.KEY_VALUE),
                ParameterSchema(name="body", label="Request Body", type=ParameterType.JSON),
                ParameterSchema(name="timeout_seconds", label="Timeout (s)", type=ParameterType.INTEGER, default=180),
            ],
            outputs=["status_code", "headers", "body", "duration_ms"],
            supports_matrix=True,
        ),
        StepDefinition(
            type="llm_request",
            label="LLM API Call",
            category="Requests",
            description="Call an Anthropic-compatible LLM API endpoint",
            icon="bot",
            color="#7C3AED",
            parameters=[
                ParameterSchema(name="endpoint_url", label="Endpoint URL", type=ParameterType.STRING, required=True, placeholder="https://api.example.com/v1/messages"),
                ParameterSchema(name="model", label="Model", type=ParameterType.STRING, required=True, placeholder="claude-haiku-4-5-20251001"),
                ParameterSchema(name="api_key", label="API Key", type=ParameterType.SECRET, description="Will use {{API_KEY}} variable if not set"),
                ParameterSchema(name="auth_type", label="Auth Type", type=ParameterType.SELECT, default="x-api-key", enum_values=["x-api-key", "bearer"]),
                ParameterSchema(name="anthropic_version", label="Anthropic Version", type=ParameterType.STRING, default="bedrock-2023-05-31"),
                ParameterSchema(name="anthropic_beta", label="Anthropic Beta", type=ParameterType.MULTILINE, description="Comma-separated beta flags"),
                ParameterSchema(name="messages", label="Messages", type=ParameterType.JSON, required=True),
                ParameterSchema(name="max_tokens", label="Max Tokens", type=ParameterType.INTEGER, default=256),
                ParameterSchema(name="temperature", label="Temperature", type=ParameterType.FLOAT),
                ParameterSchema(name="stream", label="Stream", type=ParameterType.BOOLEAN, default=False),
                ParameterSchema(name="thinking_enabled", label="Enable Thinking", type=ParameterType.BOOLEAN, default=False),
                ParameterSchema(name="thinking_budget_tokens", label="Thinking Budget", type=ParameterType.INTEGER, default=10000),
                ParameterSchema(name="timeout_seconds", label="Timeout (s)", type=ParameterType.INTEGER, default=180),
            ],
            outputs=["status_code", "response_body", "model_used", "input_tokens", "output_tokens", "duration_ms"],
            supports_matrix=True,
        ),
        StepDefinition(
            type="expand_matrix",
            label="Matrix Expansion",
            category="Data",
            description="Test multiple endpoints/models/params at once. Define dimensions and the next step runs for every combination.",
            icon="grid-3x3",
            color="#059669",
            parameters=[
                ParameterSchema(
                    name="dimensions",
                    label="Dimensions",
                    type=ParameterType.JSON,
                    required=True,
                    default={
                        "endpoint": ["https://your-api.example.com/v1/messages"],
                        "model": ["claude-haiku-4-5-20251001"],
                        "auth_type": ["x-api-key"],
                    },
                    description="Add dimensions (e.g. endpoint, model) and their values. The downstream step runs once per combination.",
                ),
            ],
            outputs=["matrix", "count", "dimensions"],
        ),
        StepDefinition(
            type="load_targets",
            label="Load Targets",
            category="Data",
            description="Load target list from CSV, JSON, or inline data",
            icon="file-input",
            color="#059669",
            parameters=[
                ParameterSchema(name="source_type", label="Source Type", type=ParameterType.SELECT, default="inline_json", enum_values=["inline_json", "csv_file", "json_file"]),
                ParameterSchema(name="data", label="Data / File Path", type=ParameterType.JSON, required=True),
            ],
            outputs=["matrix", "count"],
        ),
        StepDefinition(
            type="inject_variables",
            label="Inject Variables",
            category="Transform",
            description="Substitute {{variable}} placeholders in a template",
            icon="replace",
            color="#D97706",
            parameters=[
                ParameterSchema(name="template", label="Template", type=ParameterType.JSON, required=True),
                ParameterSchema(name="variables", label="Extra Variables", type=ParameterType.KEY_VALUE),
            ],
            outputs=["resolved"],
        ),
        StepDefinition(
            type="summarize_results",
            label="Summarize Results",
            category="Output",
            description="Aggregate matrix results: compute success rate, avg latency, group by endpoint/model. Connect after a matrix-expanded step.",
            icon="bar-chart-3",
            color="#DC2626",
            parameters=[
                ParameterSchema(name="group_by", label="Group By", type=ParameterType.JSON, default=[], description="Fields to group by, e.g. [\"endpoint\", \"model\"]. Leave empty to see overall stats."),
                ParameterSchema(name="metrics", label="Metrics", type=ParameterType.JSON, default=["status_code", "duration_ms"], description="Fields to compute stats on (min/max/avg/p50 for numbers, counts for strings)"),
            ],
            outputs=["summary", "table", "total", "success_count", "success_rate"],
        ),
        StepDefinition(
            type="gcp_config",
            label="GCP Config",
            category="GCP",
            description="Read or write GCS configuration files",
            icon="cloud",
            color="#4285F4",
            parameters=[
                ParameterSchema(name="operation", label="Operation", type=ParameterType.SELECT, default="read", enum_values=["read", "write"]),
                ParameterSchema(name="gcs_uri", label="GCS URI", type=ParameterType.STRING, required=True, placeholder="gs://bucket/config.json"),
                ParameterSchema(name="content", label="Content (for write)", type=ParameterType.JSON),
                ParameterSchema(name="gsutil_path", label="gsutil Path", type=ParameterType.STRING, default="gsutil"),
            ],
            outputs=["config", "operation", "success"],
        ),
        # ---------- Assertions ----------
        StepDefinition(
            type="assert_equals",
            label="Assert Equals",
            category="Assertions",
            description="Fail if two values are not equal",
            icon="check-circle",
            color="#16A34A",
            parameters=[
                ParameterSchema(name="actual", label="Actual", type=ParameterType.JSON, required=True, description="Value (supports {{vars}})"),
                ParameterSchema(name="expected", label="Expected", type=ParameterType.JSON, required=True),
            ],
            outputs=["test_status", "expected", "actual", "message"],
        ),
        StepDefinition(
            type="assert_contains",
            label="Assert Contains",
            category="Assertions",
            description="Fail unless needle is contained in haystack",
            icon="search",
            color="#16A34A",
            parameters=[
                ParameterSchema(name="haystack", label="Haystack", type=ParameterType.JSON, required=True, description="String, list, or object"),
                ParameterSchema(name="needle", label="Needle", type=ParameterType.STRING, required=True),
            ],
            outputs=["test_status", "message"],
        ),
        StepDefinition(
            type="assert_json_path",
            label="Assert JSON Path",
            category="Assertions",
            description="Assert on a value extracted from a JSON path",
            icon="target",
            color="#16A34A",
            parameters=[
                ParameterSchema(name="data", label="Data", type=ParameterType.JSON, required=True),
                ParameterSchema(name="path", label="Path", type=ParameterType.STRING, required=True, placeholder="$.body.items[0].id"),
                ParameterSchema(name="operator", label="Operator", type=ParameterType.SELECT, default="equals", enum_values=["equals", "not_equals", "greater_than", "less_than", "exists", "matches_regex"]),
                ParameterSchema(name="expected", label="Expected", type=ParameterType.JSON),
            ],
            outputs=["test_status", "path", "operator", "expected", "actual", "message"],
        ),
        StepDefinition(
            type="assert_json_schema",
            label="Assert JSON Schema",
            category="Assertions",
            description="Validate a JSON value against a lightweight schema",
            icon="shield-check",
            color="#16A34A",
            parameters=[
                ParameterSchema(name="data", label="Data", type=ParameterType.JSON, required=True),
                ParameterSchema(name="schema", label="Schema", type=ParameterType.JSON, required=True, description='{"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}'),
            ],
            outputs=["test_status", "errors", "message"],
        ),
        StepDefinition(
            type="snapshot",
            label="Snapshot Baseline",
            category="Assertions",
            description="Compare output to stored baseline; fails on drift",
            icon="camera",
            color="#0EA5E9",
            parameters=[
                ParameterSchema(name="name", label="Name", type=ParameterType.STRING, required=True, placeholder="llm_response_shape"),
                ParameterSchema(name="value", label="Value", type=ParameterType.JSON, required=True),
                ParameterSchema(name="workflow_id", label="Workflow ID", type=ParameterType.STRING, description="Scope the baseline (defaults to workflow)"),
                ParameterSchema(name="update", label="Update Baseline", type=ParameterType.BOOLEAN, default=False, description="Overwrite baseline with current value"),
            ],
            outputs=["test_status", "action", "baseline", "current", "diffs", "message"],
        ),
        # ---------- Integrations ----------
        StepDefinition(
            type="notify",
            label="Notify",
            category="Integrations",
            description="Send notification via Slack / Discord / generic webhook",
            icon="bell",
            color="#EAB308",
            parameters=[
                ParameterSchema(name="channel", label="Channel", type=ParameterType.SELECT, default="webhook", enum_values=["webhook", "slack", "discord"]),
                ParameterSchema(name="webhook_url", label="Webhook URL", type=ParameterType.SECRET, required=True),
                ParameterSchema(name="title", label="Title", type=ParameterType.STRING, default="Workflow Notification"),
                ParameterSchema(name="message", label="Message", type=ParameterType.MULTILINE, required=True),
            ],
            outputs=["channel", "status_code", "delivered"],
        ),
    ]


@router.get("")
def list_step_templates() -> list[StepDefinition]:
    return _get_builtin_definitions()


@router.get("/{step_type}")
def get_step_template(step_type: str) -> StepDefinition:
    for defn in _get_builtin_definitions():
        if defn.type == step_type:
            return defn
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Step type '{step_type}' not found")
