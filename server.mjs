import { createServer } from "node:http";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "outputs");
const port = Number(process.env.PORT || 8787);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function extensionFor(format) {
  if (format === "jpeg") return "jpg";
  if (format === "webp") return "webp";
  return "png";
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl || "");
  if (!match) throw new Error("Reference image must be sent as a base64 data URL.");
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

async function generateImage(job, apiKeyOverride) {
  const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing API key. Paste your OpenAI API key in the page before generating.");
  }

  const format = job.output_format || "png";
  let response;
  if (job.referenceImage?.dataUrl) {
    const image = dataUrlToBlob(job.referenceImage.dataUrl);
    const form = new FormData();
    form.append("model", job.model || "gpt-image-1.5");
    form.append("prompt", job.prompt);
    form.append("size", job.size || "1536x1024");
    form.append("quality", job.quality || "medium");
    form.append("background", job.background || "opaque");
    form.append("output_format", format);
    form.append("input_fidelity", job.input_fidelity || "high");
    form.append("n", "1");
    form.append("image", new Blob([image.buffer], { type: image.mime }), job.referenceImage.name || "reference.png");

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form
    });
  } else {
    const body = {
      model: job.model || "gpt-image-1.5",
      prompt: job.prompt,
      size: job.size || "1536x1024",
      quality: job.quality || "medium",
      background: job.background || "opaque",
      output_format: format,
      n: 1
    };

    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || `OpenAI API returned ${response.status}`;
    throw new Error(detail);
  }

  const image = data?.data?.[0];
  if (!image?.b64_json && !image?.url) {
    throw new Error("OpenAI response did not include image data.");
  }

  await mkdir(outputDir, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const fileName = `${job.slug || "couple-avatar"}-${id}.${extensionFor(format)}`;
  const filePath = path.join(outputDir, fileName);

  if (image.b64_json) {
    await writeFile(filePath, Buffer.from(image.b64_json, "base64"));
  } else {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) throw new Error("Generated image URL could not be downloaded.");
    await writeFile(filePath, Buffer.from(await imageResponse.arrayBuffer()));
  }

  return {
    id,
    fileName,
    url: `/outputs/${fileName}`,
    revised_prompt: image.revised_prompt || null
  };
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/status") {
    sendJson(res, 200, {
      ok: true,
      hasApiKey: Boolean(process.env.OPENAI_API_KEY),
      defaultModel: "gpt-image-1.5"
    });
    return;
  }

  if (req.method === "GET" && req.url === "/api/reference-images") {
    const referenceDir = path.join(publicDir, "reference-images");
    try {
      const files = await readdir(referenceDir, { withFileTypes: true });
      const images = files
        .filter((file) => file.isFile() && /\.(png|jpe?g|webp|svg)$/iu.test(file.name))
        .map((file) => ({
          name: file.name,
          url: `/reference-images/${encodeURIComponent(file.name)}`
        }));
      sendJson(res, 200, { ok: true, images });
    } catch {
      sendJson(res, 200, { ok: true, images: [] });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    try {
      const body = await readBody(req);
      const jobs = Array.isArray(body.jobs) ? body.jobs : [];
      const sharedReferenceImage = body.referenceImage || null;
      const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      if (!jobs.length) {
        sendJson(res, 400, { ok: false, error: "No generation jobs were provided." });
        return;
      }
      if (jobs.length > 50) {
        sendJson(res, 400, { ok: false, error: "Batch limit is 50 images per run." });
        return;
      }

      const results = [];
      for (const [index, job] of jobs.entries()) {
        try {
          const result = await generateImage({ ...job, referenceImage: job.referenceImage || sharedReferenceImage }, apiKey);
          results.push({ index, ok: true, prompt: job.prompt, ...result });
        } catch (error) {
          results.push({ index, ok: false, prompt: job.prompt, error: error.message });
        }
      }

      sendJson(res, 200, { ok: true, results });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Unknown API route." });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const base = url.pathname.startsWith("/outputs/") ? root : publicDir;
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = safeJoin(base, requested.replace(/^\//, ""));

  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": mime[path.extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  if (req.url?.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }
  await serveStatic(req, res);
}).listen(port);
