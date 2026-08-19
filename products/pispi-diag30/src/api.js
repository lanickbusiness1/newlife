import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { DiagnosticStore } from './store.js';
import { DiagnosticService } from './service.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'"
};

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
  }
}

function send(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

export function createApi({ service } = {}) {
  const resolvedService = service ?? new DiagnosticService(new DiagnosticStore());

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const segments = url.pathname.split('/').filter(Boolean);

      if (request.method === 'GET' && url.pathname === '/health') {
        return send(response, 200, { status: 'ok', service: 'pispi-diag30', version: '2.1.0' });
      }

      if (segments[0] !== 'api' || segments[1] !== 'v1' || segments[2] !== 'diagnostics') {
        return send(response, 404, { error: 'Not found' });
      }

      if (request.method === 'POST' && segments.length === 3) {
        const session = await resolvedService.createDiagnostic(await readJson(request));
        return send(response, 201, session);
      }

      const id = segments[3];
      const action = segments[4];
      if (!id || !action) return send(response, 404, { error: 'Not found' });

      if (request.method === 'PUT' && action === 'answers') {
        const session = await resolvedService.saveAnswers(id, (await readJson(request)).answers);
        return send(response, 200, session);
      }
      if (request.method === 'POST' && action === 'score') {
        return send(response, 200, await resolvedService.score(id, await readJson(request)));
      }
      if (request.method === 'GET' && action === 'report') {
        return send(response, 200, await resolvedService.report(id));
      }
      if (request.method === 'POST' && action === 'lead-consent') {
        return send(response, 200, await resolvedService.saveConsent(id, await readJson(request)));
      }
      if (request.method === 'POST' && action === 'evidence-request') {
        return send(response, 201, await resolvedService.requestEvidence(id, await readJson(request)));
      }
      return send(response, 405, { error: 'Method not allowed' });
    } catch (error) {
      const statusCode = Number(error.statusCode) || (error instanceof TypeError ? 422 : 500);
      return send(response, statusCode, { error: statusCode === 500 ? 'Internal server error' : error.message });
    }
  });
}

export function startApi({ port = Number(process.env.PORT ?? 3000), filePath } = {}) {
  const service = new DiagnosticService(new DiagnosticStore({ filePath }));
  const server = createApi({ service });
  server.listen(port, () => console.log(`PI-SPI DIAG30 API listening on :${port}`));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startApi();
