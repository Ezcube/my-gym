export function sendJson(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function readJsonBody(req, { maxBytes = 6 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(413, 'request body too large', 'BODY_TOO_LARGE'));
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'invalid json', 'INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}
