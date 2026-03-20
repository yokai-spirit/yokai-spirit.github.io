const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const CAT_API_BASE_URL = "https://api.thecatapi.com/v1/images/search";
const CAT_API_KEY = process.env.CAT_API_KEY;
const CAT_API_BATCH_LIMIT = 10;

function clampLimit(limit) {
  return Math.min(Math.max(limit, 1), 20);
}

async function fetchCatsWithPaging({ limit, headers, hasBreeds }) {
  const results = [];
  const seenIds = new Set();
  const maxPages = 5;

  for (let page = 0; page < maxPages && results.length < limit; page += 1) {
    const remaining = limit - results.length;
    const batchLimit = Math.min(CAT_API_BATCH_LIMIT, remaining);
    const query = new URLSearchParams({
      limit: String(batchLimit),
      page: String(page)
    });

    if (hasBreeds) {
      query.set("has_breeds", "1");
    }

    const response = await fetch(`${CAT_API_BASE_URL}?${query.toString()}`, { headers });

    if (!response.ok) {
      throw new Error(`External API returned HTTP ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    data.forEach((item) => {
      const id = item?.id;
      if (!id || seenIds.has(id)) {
        return;
      }

      seenIds.add(id);
      results.push(item);
    });

    if (data.length < batchLimit) {
      break;
    }
  }

  return results.slice(0, limit);
}

app.use(
  express.static(__dirname, {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    }
  })
);

app.get("/api/cats", async (req, res) => {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = clampLimit(Number.isNaN(rawLimit) ? 8 : rawLimit);
  const headers = { Accept: "application/json" };

  if (CAT_API_KEY) {
    headers["x-api-key"] = CAT_API_KEY;
  }

  const candidates = [true, false];

  let lastError = "Unknown upstream error.";
  const aggregated = [];
  const seenIds = new Set();

  try {
    for (const hasBreeds of candidates) {
      const remaining = limit - aggregated.length;
      if (remaining <= 0) {
        break;
      }

      const data = await fetchCatsWithPaging({ limit: remaining, headers, hasBreeds });

      if (!Array.isArray(data) || data.length === 0) {
        lastError = "External API returned no cat records.";
        continue;
      }

      data.forEach((item) => {
        const id = item?.id;
        if (!id || seenIds.has(id)) {
          return;
        }

        seenIds.add(id);
        aggregated.push(item);
      });
    }

    if (aggregated.length > 0) {
      return res.json(aggregated.slice(0, limit));
    }

    return res.status(502).json({
      error: "Unable to fetch cat data from external API.",
      detail: lastError
    });
  } catch (error) {
    return res.status(500).json({
      error: "Something went wrong while fetching cat data.",
      detail: error.message
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
