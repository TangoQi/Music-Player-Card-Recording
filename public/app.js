const $ = (id) => document.getElementById(id);

const fields = {
  theme: $("theme"),
  couples: $("couples"),
  referenceImage: $("referenceImage"),
  style: $("style"),
  variants: $("variants"),
  apiKey: $("apiKey"),
  model: $("model"),
  size: $("size"),
  quality: $("quality"),
  format: $("format"),
  constraints: $("constraints")
};

const apiStatus = $("apiStatus");
const imageBoard = $("imageBoard");
const imageBoardStatus = $("imageBoardStatus");
const gallery = $("gallery");
const runSummary = $("runSummary");
const referencePreview = $("referencePreview");
const previewBtn = $("previewBtn");
const generateBtn = $("generateBtn");

let referenceImage = null;
let displayImages = [];
const isFilePreview = window.location.protocol === "file:";

const variantNotes = [
  "轻微侧脸，视线越过中线，适合左右头像并排使用",
  "正面近景，表情自然，头像裁切后仍然有高辨识度",
  "头肩构图，加入彼此呼应但不雷同的小道具",
  "肩部以上构图，背景元素形成一组隐藏情侣线索",
  "更明亮的日间光线，适合社交平台头像",
  "更安静的夜间光线，氛围克制高级"
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "couple-avatar";
}

function parseCouples() {
  return fields.couples.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split("|").map((part) => part?.trim());
      return {
        left: left || line,
        right: right || "另一半，气质互补，造型协调"
      };
    });
}

function makePrompt(couple, variantIndex) {
  return [
    "请基于输入参考图进行再创作，不要机械复刻原图。",
    "提取参考图里的核心主题、人物线索、材质、色彩、氛围或造型语言，重构成一组专门设计的情侣头像。",
    "最终画面必须是横向构图，并清楚分成左右两个可独立裁剪的正方形头像区域。左半区是一个完整头像，右半区是另一个完整头像。不要出现硬分割线。",
    `左侧人物：${couple.left}。`,
    `右侧人物：${couple.right}。`,
    `主题关键词：${fields.theme.value.trim()}。`,
    `视觉风格：${fields.style.value}。`,
    `变化要求：${variantNotes[(variantIndex - 1) % variantNotes.length]}。`,
    "结构硬约束：每一侧单独裁剪成 1:1 后必须构图完整、视觉成立；合在一起观看时必须有额外的互动感、默契感或隐含关系。",
    "角色硬约束：左右两方气质必须明显区分，一方更柔和/可爱，另一方更克制/简洁或略偏男性气质；避免两侧都像同一种性别气质，尤其避免都像女生。",
    "关系硬约束：通过视线方向、身体朝向、动作暗示、材质呼应、背景线索、光影节奏或情绪状态建立对应关系，但不要只做同款换色。",
    "商业生产要求：让人一眼觉得这是专门设计的一对情侣头像，适合真实用户裁剪并长期使用，画面干净，成品精致。",
    `统一约束：${fields.constraints.value.trim()}`
  ].join("\n");
}

function buildJobs() {
  const couples = parseCouples();
  const variants = Math.min(Math.max(Number(fields.variants.value) || 1, 1), 6);
  const jobs = [];

  couples.forEach((couple, coupleIndex) => {
    for (let variant = 1; variant <= variants; variant += 1) {
      jobs.push({
        model: fields.model.value.trim() || "gpt-image-1.5",
        size: fields.size.value,
        quality: fields.quality.value,
        output_format: fields.format.value,
        background: "opaque",
        input_fidelity: "high",
        slug: slugify(`couple-${coupleIndex + 1}-${variant}`),
        prompt: makePrompt(couple, variant)
      });
    }
  });

  return jobs;
}

function renderImageBoard(jobs) {
  imageBoard.innerHTML = "";

  if (!displayImages.length) {
    imageBoard.innerHTML = `
      <article class="showcase-card empty-showcase">
        <div class="showcase-placeholder">上传参考图后，这里会显示你的图片素材。</div>
      </article>
    `;
    imageBoardStatus.textContent = "等待上传参考图";
    return;
  }

  displayImages.forEach((image, index) => {
    const preview = document.createElement("article");
    preview.className = "showcase-card";
    preview.innerHTML = `
      <img src="${image.dataUrl}" alt="参考图 ${index + 1}" />
      <div class="showcase-meta">
        <strong>${index === 0 ? "主参考图" : `展示图 ${index + 1}`}</strong>
        <span>${image.name}</span>
      </div>
    `;
    imageBoard.appendChild(preview);
  });

  const plan = document.createElement("article");
  plan.className = "showcase-card plan-card";
  plan.innerHTML = `
    <div class="plan-count">${jobs.length}</div>
    <div class="showcase-meta">
      <strong>待生成图片</strong>
      <span>${displayImages.length} 张参考图 · ${parseCouples().length} 组设定</span>
    </div>
  `;
  imageBoard.appendChild(plan);
  imageBoardStatus.textContent = `准备生成 ${jobs.length} 张`;
}

function refreshDisplay() {
  const jobs = buildJobs();

  if (!jobs.length) {
    imageBoard.innerHTML = '<div class="error-card">至少输入一行左右气质设定。</div>';
    imageBoardStatus.textContent = "队列为空";
    runSummary.textContent = "队列为空";
    return jobs;
  }

  renderImageBoard(jobs);
  runSummary.textContent = `队列中 ${jobs.length} 张`;
  return jobs;
}

function renderResults(results) {
  gallery.innerHTML = "";
  let success = 0;

  for (const result of results) {
    if (result.ok) {
      success += 1;
      const card = document.createElement("article");
      card.className = "result-card";
      card.innerHTML = `
        <img src="${result.url}" alt="情侣头像生成结果" />
        <div class="meta">
          <strong>#${result.index + 1}</strong>
          <a href="${result.url}" target="_blank" rel="noreferrer">打开图片</a>
          <button type="button" data-crop="${result.url}" data-name="${result.fileName}">下载 2:1 裁剪版</button>
          <button type="button" data-split="${result.url}" data-name="${result.fileName}">下载左右头像</button>
          <span class="crop-note">模型输出会先生成横图；下载按钮会在浏览器中处理成严格 2:1 和两个 1:1。</span>
        </div>
      `;
      gallery.appendChild(card);
    } else {
      const card = document.createElement("article");
      card.className = "error-card";
      card.textContent = `#${result.index + 1} 失败：${result.error}`;
      gallery.appendChild(card);
    }
  }

  runSummary.textContent = `完成 ${success}/${results.length} 张`;
}

async function imageUrlToCanvas(url) {
  const image = new Image();
  image.src = url;
  await image.decode();

  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (sourceRatio > 2) {
    sw = image.naturalHeight * 2;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / 2;
    sy = (image.naturalHeight - sh) / 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function downloadCanvas(canvas, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function dataUrlFromUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

async function loadBuiltInReferenceImages() {
  if (isFilePreview || displayImages.length) return;

  try {
    const response = await fetch("/api/reference-images");
    const data = await response.json();
    const images = Array.isArray(data.images) ? data.images : [];
    if (!images.length) return;

    displayImages = await Promise.all(images.map(async (image) => ({
      dataUrl: await dataUrlFromUrl(image.url),
      name: image.name,
      type: "image"
    })));
    referenceImage = displayImages[0] || null;
    referencePreview.innerHTML = `<img src="${referenceImage.dataUrl}" alt="主参考图片预览" />`;
    refreshDisplay();
  } catch {
    // Built-in examples are optional.
  }
}

gallery.addEventListener("click", async (event) => {
  const cropButton = event.target.closest("[data-crop]");
  const splitButton = event.target.closest("[data-split]");
  const button = cropButton || splitButton;
  if (!button) return;

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = cropButton ? "裁剪中..." : "拆分中...";

  try {
    const canvas = await imageUrlToCanvas(button.dataset.crop || button.dataset.split);
    const baseName = button.dataset.name.replace(/\.(png|jpg|jpeg|webp)$/i, "");

    if (cropButton) {
      downloadCanvas(canvas, `${baseName}-2x1.png`);
    } else {
      for (const [index, side] of ["left", "right"].entries()) {
        const avatar = document.createElement("canvas");
        avatar.width = 1024;
        avatar.height = 1024;
        avatar.getContext("2d").drawImage(canvas, index * 1024, 0, 1024, 1024, 0, 0, 1024, 1024);
        downloadCanvas(avatar, `${baseName}-${side}-avatar.png`);
      }
    }
  } catch (error) {
    gallery.insertAdjacentHTML("afterbegin", `<div class="error-card">裁剪失败：${error.message}</div>`);
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

async function refreshStatus() {
  if (isFilePreview) {
    apiStatus.textContent = "预览模式：请运行 start-tool.bat";
    apiStatus.className = "status missing";
    generateBtn.disabled = true;
    generateBtn.title = "直接打开 HTML 只能预览。请运行 start-tool.bat 后在 localhost 使用生成。";
    return;
  }

  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    const pageKeyReady = Boolean(fields.apiKey.value.trim());
    const ready = data.hasApiKey || pageKeyReady;
    apiStatus.textContent = ready ? "可以生成" : "请填写 API Key";
    apiStatus.className = `status ${ready ? "ready" : "missing"}`;
    generateBtn.disabled = false;
  } catch {
    apiStatus.textContent = "服务未连接";
    apiStatus.className = "status missing";
    generateBtn.disabled = true;
  }
}

previewBtn.addEventListener("click", refreshDisplay);

generateBtn.addEventListener("click", async () => {
  const jobs = refreshDisplay();
  if (!jobs.length) return;
  if (!referenceImage) {
    gallery.innerHTML = '<div class="error-card">请先上传至少一张参考图。</div>';
    return;
  }
  const apiKey = fields.apiKey.value.trim();
  if (!apiKey && !apiStatus.classList.contains("ready")) {
    gallery.innerHTML = '<div class="error-card">请先填写 OpenAI API Key。</div>';
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "生成中...";
  runSummary.textContent = `正在生成 ${jobs.length} 张`;
  gallery.innerHTML = "";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobs, referenceImage, apiKey })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "生成失败");
    renderResults(data.results);
  } catch (error) {
    gallery.innerHTML = `<div class="error-card">${error.message}</div>`;
    runSummary.textContent = "生成失败";
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "开始批量生成";
    refreshStatus();
  }
});

for (const field of Object.values(fields)) {
  if (field.type === "file") continue;
  field.addEventListener("input", () => {
    refreshDisplay();
    if (field === fields.apiKey) refreshStatus();
  });
}

fields.referenceImage.addEventListener("change", () => {
  const files = Array.from(fields.referenceImage.files || []);
  if (!files.length) {
    referenceImage = null;
    displayImages = [];
    referencePreview.innerHTML = "<span>可一次选择多张图片。生成时默认使用第一张作为参考图。</span>";
    refreshDisplay();
    return;
  }

  Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      dataUrl: reader.result,
      name: file.name,
      type: file.type
    });
    reader.readAsDataURL(file);
  }))).then((images) => {
    displayImages = images;
    referenceImage = images[0] || null;
    referencePreview.innerHTML = `<img src="${referenceImage.dataUrl}" alt="主参考图片预览" />`;
    refreshDisplay();
  });
});

refreshStatus();
refreshDisplay();
loadBuiltInReferenceImages();
