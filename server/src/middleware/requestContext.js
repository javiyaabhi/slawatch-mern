import crypto from 'node:crypto';

/** Logs only method, route path, outcome and duration: no credentials, payloads or query strings. */
export function requestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  const started = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const entry = {
      at: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.route?.path || req.path,
      status: res.statusCode,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6)
    };
    console.log(JSON.stringify(entry));
  });
  next();
}
