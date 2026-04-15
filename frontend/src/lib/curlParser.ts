/**
 * Parse a cURL command string into a structured object.
 * Handles: -X, -H, -d/--data/--data-raw, --url, -u, --max-time, -m,
 *          shell quoting (single, double), backslash continuations.
 */

export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown | null;
  timeout?: number;
}

/** Tokenize a shell-like command string respecting quotes and backslash continuations. */
function tokenize(input: string): string[] {
  // Normalize backslash-newline continuations
  const normalized = input.replace(/\\\r?\n\s*/g, ' ');
  const tokens: string[] = [];
  let current = '';
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (ch === "'" ) {
      // Single-quoted: read until matching '
      i++;
      while (i < normalized.length && normalized[i] !== "'") {
        current += normalized[i];
        i++;
      }
      i++; // skip closing '
    } else if (ch === '"') {
      // Double-quoted: handle backslash escaping inside
      i++;
      while (i < normalized.length && normalized[i] !== '"') {
        if (normalized[i] === '\\' && i + 1 < normalized.length) {
          const next = normalized[i + 1];
          if (next === '"' || next === '\\' || next === '$' || next === '`') {
            current += next;
            i += 2;
            continue;
          }
        }
        current += normalized[i];
        i++;
      }
      i++; // skip closing "
    } else if (ch === '\\' && i + 1 < normalized.length) {
      current += normalized[i + 1];
      i += 2;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      i++;
    } else {
      current += ch;
      i++;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseCurl(input: string): ParsedCurl {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Empty input');

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new Error('No tokens found');

  // Strip leading "curl" command word
  let start = 0;
  if (tokens[0].toLowerCase() === 'curl') start = 1;

  let url = '';
  let method = '';
  const headers: Record<string, string> = {};
  let bodyStr: string | null = null;
  let timeout: number | undefined;

  let i = start;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === '-X' || tok === '--request') {
      i++;
      method = tokens[i]?.toUpperCase() ?? '';
    } else if (tok === '-H' || tok === '--header') {
      i++;
      const headerVal = tokens[i] ?? '';
      const colonIdx = headerVal.indexOf(':');
      if (colonIdx > 0) {
        const key = headerVal.slice(0, colonIdx).trim();
        const val = headerVal.slice(colonIdx + 1).trim();
        headers[key] = val;
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      i++;
      bodyStr = tokens[i] ?? '';
    } else if (tok === '-u' || tok === '--user') {
      i++;
      const userPass = tokens[i] ?? '';
      headers['Authorization'] = 'Basic ' + btoa(userPass);
    } else if (tok === '--url') {
      i++;
      url = tokens[i] ?? '';
    } else if (tok === '-m' || tok === '--max-time' || tok === '--connect-timeout') {
      i++;
      const val = parseInt(tokens[i] ?? '', 10);
      if (!isNaN(val)) timeout = val;
    } else if (
      tok === '-k' || tok === '--insecure' || tok === '--compressed' ||
      tok === '-s' || tok === '--silent' || tok === '-S' || tok === '--show-error' ||
      tok === '-v' || tok === '--verbose' || tok === '-L' || tok === '--location' ||
      tok === '-i' || tok === '--include'
    ) {
      // Boolean flags — skip
    } else if (tok.startsWith('-') && !tok.startsWith('--') && tok.length === 2) {
      // Unknown single-letter flag with argument — skip both
      i++;
    } else if (tok.startsWith('--')) {
      // Unknown long flag with = or next arg
      if (!tok.includes('=')) i++;
    } else if (!url) {
      // Positional argument = URL
      url = tok;
    }

    i++;
  }

  if (!url) throw new Error('No URL found in cURL command');
  if (!method) method = bodyStr ? 'POST' : 'GET';

  // Try to parse body as JSON
  let body: unknown | null = null;
  if (bodyStr) {
    try {
      body = JSON.parse(bodyStr);
    } catch {
      body = bodyStr;
    }
  }

  return { url, method, headers, body, timeout };
}
