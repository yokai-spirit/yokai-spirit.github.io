const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const MAX_EVENTS = 200;
const events = [];

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("Internal server error");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=UTF-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", reject);
  });
}

async function postWebhook(eventPayload) {
  if (!ALERT_WEBHOOK_URL || typeof fetch !== "function") {
    return { sent: false, reason: ALERT_WEBHOOK_URL ? "fetch unavailable" : "webhook not configured" };
  }

  try {
    const response = await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload)
    });

    return { sent: response.ok, status: response.status };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

function normalizeEvent(input) {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    time: new Date().toISOString(),
    source: input.source || "camera-client",
    movement: input.movement || "unknown",
    objectLabel: input.objectLabel || "unknown",
    trackId: Number.isFinite(input.trackId) ? input.trackId : null,
    confidence: Number.isFinite(input.confidence) ? Number(input.confidence) : null,
    intensity: Number.isFinite(input.intensity) ? Number(input.intensity) : null,
    bbox: input.bbox || null
  };
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (requestUrl.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      webhookConfigured: Boolean(ALERT_WEBHOOK_URL)
    });
    return;
  }

  if (requestUrl.pathname === "/api/events" && req.method === "GET") {
    const limit = Math.max(1, Math.min(200, Number(requestUrl.searchParams.get("limit")) || 30));
    const latest = events.slice(-limit).reverse();
    sendJson(res, 200, {
      events: latest,
      count: latest.length,
      webhookConfigured: Boolean(ALERT_WEBHOOK_URL)
    });
    return;
  }

  if (requestUrl.pathname === "/api/events" && req.method === "POST") {
    readJsonBody(req)
      .then(async (payload) => {
        const event = normalizeEvent(payload);
        events.push(event);
        if (events.length > MAX_EVENTS) {
          events.shift();
        }

        const webhookResult = await postWebhook({ type: "motion_event", event });
        sendJson(res, 201, {
          ok: true,
          event,
          webhook: webhookResult
        });
      })
      .catch((err) => {
        sendJson(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, { ok: false, error: "API route not found" });
    return;
  }

  const safePath = path.normalize(requestUrl.pathname).replace(/^\\+/, "");
  const requestPath = safePath === "/" ? "/index.html" : safePath;
  const fullPath = path.join(PUBLIC_DIR, requestPath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("Not found");
      return;
    }

    sendFile(fullPath, res);
  });
});

server.listen(PORT, () => {
  console.log(`Motion Guard server running at http://localhost:${PORT}`);
});
