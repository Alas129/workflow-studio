/**
 * Convert a ParsedCurl into a step configuration.
 * Auto-detects if it's an LLM API call based on URL, headers, and body.
 */
import type { ParsedCurl } from './curlParser';

export interface StepFromCurl {
  stepType: 'http_request' | 'llm_request';
  label: string;
  config: Record<string, unknown>;
}

const LLM_URL_PATTERNS = [
  /anthropic/i,
  /openai/i,
  /\/v1\/messages/,
  /\/v1\/chat\/completions/,
  /claude/i,
  /bedrock.*runtime.*invoke/i,
];

function isLlmRequest(parsed: ParsedCurl): boolean {
  // Check URL
  if (LLM_URL_PATTERNS.some((p) => p.test(parsed.url))) return true;

  // Check headers
  const headerKeys = Object.keys(parsed.headers).map((k) => k.toLowerCase());
  if (headerKeys.includes('anthropic-version')) return true;
  if (headerKeys.includes('x-api-key') && LLM_URL_PATTERNS.some((p) => p.test(parsed.url))) return true;

  // Check body shape
  if (parsed.body && typeof parsed.body === 'object' && !Array.isArray(parsed.body)) {
    const b = parsed.body as Record<string, unknown>;
    if ('model' in b && 'messages' in b) return true;
  }

  return false;
}

function extractHostLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^(api\.|www\.)/, '');
  } catch {
    return url.slice(0, 30);
  }
}

function toLlmStep(parsed: ParsedCurl): StepFromCurl {
  const body = (typeof parsed.body === 'object' && parsed.body !== null)
    ? parsed.body as Record<string, unknown>
    : {};

  // Extract API key and auth type from headers
  let apiKey = '';
  let authType = 'x-api-key';
  let anthropicVersion = '';
  let anthropicBeta = '';
  const lowerHeaders: Record<string, { original: string; value: string }> = {};
  for (const [k, v] of Object.entries(parsed.headers)) {
    lowerHeaders[k.toLowerCase()] = { original: k, value: v };
  }

  if (lowerHeaders['x-api-key']) {
    apiKey = lowerHeaders['x-api-key'].value;
    authType = 'x-api-key';
  } else if (lowerHeaders['authorization']) {
    const auth = lowerHeaders['authorization'].value;
    if (auth.toLowerCase().startsWith('bearer ')) {
      apiKey = auth.slice(7).trim();
      authType = 'bearer';
    }
  }

  if (lowerHeaders['anthropic-version']) {
    anthropicVersion = lowerHeaders['anthropic-version'].value;
  }
  if (lowerHeaders['anthropic-beta']) {
    anthropicBeta = lowerHeaders['anthropic-beta'].value;
  }

  // Extract thinking config
  const thinking = body.thinking as Record<string, unknown> | undefined;
  const thinkingEnabled = thinking?.type === 'enabled';
  const thinkingBudget = typeof thinking?.budget_tokens === 'number' ? thinking.budget_tokens : 10000;

  const config: Record<string, unknown> = {
    endpoint_url: parsed.url,
    model: body.model ?? '',
    api_key: apiKey,
    auth_type: authType,
    messages: body.messages ?? [],
    max_tokens: body.max_tokens ?? 256,
  };

  if (anthropicVersion) config.anthropic_version = anthropicVersion;
  if (anthropicBeta) config.anthropic_beta = anthropicBeta;
  if (body.temperature !== undefined) config.temperature = body.temperature;
  if (body.stream) config.stream = true;
  if (thinkingEnabled) {
    config.thinking_enabled = true;
    config.thinking_budget_tokens = thinkingBudget;
  }
  if (parsed.timeout) config.timeout_seconds = parsed.timeout;

  const modelStr = typeof body.model === 'string' ? body.model : '';
  const label = modelStr
    ? `LLM: ${modelStr}`
    : `LLM: ${extractHostLabel(parsed.url)}`;

  return { stepType: 'llm_request', label, config };
}

function toHttpStep(parsed: ParsedCurl): StepFromCurl {
  // Filter out Content-Type from explicit headers (it's implicit in body)
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.headers)) {
    if (k.toLowerCase() !== 'content-type') {
      headers[k] = v;
    }
  }

  const config: Record<string, unknown> = {
    url: parsed.url,
    method: parsed.method,
  };

  if (Object.keys(headers).length > 0) config.headers = headers;
  if (parsed.body !== null) config.body = parsed.body;
  if (parsed.timeout) config.timeout_seconds = parsed.timeout;

  const label = `${parsed.method} ${extractHostLabel(parsed.url)}`;

  return { stepType: 'http_request', label, config };
}

export function curlToStep(parsed: ParsedCurl): StepFromCurl {
  if (isLlmRequest(parsed)) {
    return toLlmStep(parsed);
  }
  return toHttpStep(parsed);
}
