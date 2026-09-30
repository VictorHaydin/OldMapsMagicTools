(function () {
  const BUTTON_ID = 'omm-uma-download-btn';
  const CONCURRENCY = 6;
  const MAX_RETRIES = 2;

  let capturedViewer = null;

  // The site's own click handler only calls `OpenSeadragon(...)` the first
  // time a user opens the viewer, so this patch just needs to be in place
  // before that happens - which document_idle comfortably guarantees, since
  // openseadragon.min.js already ran synchronously earlier in page load.
  function patchOpenSeadragon() {
    if (typeof window.OpenSeadragon !== 'function') return false;
    if (window.OpenSeadragon.__ommPatched) return true;

    const OriginalOSD = window.OpenSeadragon;
    function PatchedOSD(...args) {
      const instance = OriginalOSD.apply(this, args);
      if (instance && typeof instance.addHandler === 'function') {
        capturedViewer = instance;
      }
      return instance;
    }
    Object.assign(PatchedOSD, OriginalOSD);
    PatchedOSD.__ommPatched = true;
    window.OpenSeadragon = PatchedOSD;
    return true;
  }

  function init() {
    if (!patchOpenSeadragon()) {
      setTimeout(init, 200);
      return;
    }
    setupDownloadButton();
  }

  function setupDownloadButton() {
    const container = document.getElementById('zoomify-container');
    const closeBtn = container && container.querySelector('.zoomify-close');
    if (!container || !closeBtn || document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.title = 'Завантажити зображення карти у максимальній роздільній здатності';
    btn.innerHTML = getIconSvg();
    container.appendChild(btn);

    btn.addEventListener('click', () => {
      if (btn.classList.contains('omm-busy')) return;
      startDownload(btn);
    });
  }

  function getIconSvg() {
    return `<svg viewBox="0 0 24 24" class="omm-uma-icon"><path d="M12 16.5l-5.5-5.5 1.4-1.4 3.1 3.1V3h2v9.7l3.1-3.1 1.4 1.4L12 16.5zM5 19h14v2H5z"></path></svg>`;
  }

  function getGridSource() {
    if (!capturedViewer || !capturedViewer.world || capturedViewer.world.getItemCount() === 0) {
      return null;
    }
    const source = capturedViewer.world.getItemAt(0).source;
    if (!source || typeof source.getTileUrl !== 'function' || !Array.isArray(source.gridSize)) {
      return null;
    }
    const level = source.maxLevel;
    const grid = source.gridSize[level];
    if (!grid || !grid.x || !grid.y) return null;
    return { source, level, cols: grid.x, rows: grid.y, width: source.width, height: source.height };
  }

  function deriveFileName(width, height) {
    const match = location.pathname.match(/(\d+)(?:\/)?$/);
    const id = match ? match[1] : 'map';
    return `uma-map-${id}-${width}x${height}.jpg`;
  }

  async function startDownload(btn) {
    const info = getGridSource();
    if (!info) {
      alert('Не вдалося визначити параметри зображення. Відкрийте перегляд карти і спробуйте ще раз.');
      return;
    }

    const { source, level, cols, rows, width, height } = info;
    const total = cols * rows;
    btn.classList.add('omm-busy');
    btn.disabled = true;
    setProgress(btn, 0, total);

    try {
      const tiles = new Array(total);
      const tasks = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          tasks.push({ col, row, index: row * cols + col });
        }
      }

      let completed = 0;
      await runWithConcurrency(tasks, CONCURRENCY, async (task) => {
        const url = source.getTileUrl(level, task.col, task.row);
        const bitmap = await fetchTileBitmap(url);
        tiles[task.index] = { bitmap, col: task.col, row: task.row };
        completed += 1;
        setProgress(btn, completed, total);
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas-context-unavailable');

      const tileSize = source.tileSize || 256;
      for (const tile of tiles) {
        if (!tile || !tile.bitmap) continue;
        ctx.drawImage(tile.bitmap, tile.col * tileSize, tile.row * tileSize);
        tile.bitmap.close && tile.bitmap.close();
      }

      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      if (!blob) throw new Error('canvas-export-failed');

      downloadBlob(blob, deriveFileName(width, height));
      setDone(btn);
    } catch (err) {
      console.error('[OldMaps Magic Tools] Full-resolution download failed:', err);
      alert('Не вдалося завантажити зображення у повній роздільній здатності. Перевірте з’єднання і спробуйте ще раз.');
      resetButton(btn);
    }
  }

  async function fetchTileBitmap(url) {
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const blob = await response.blob();
        return await createImageBitmap(blob);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  async function runWithConcurrency(items, limit, worker) {
    let cursor = 0;
    async function runNext() {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        await worker(item);
      }
    }
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(runNext);
    await Promise.all(runners);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function setProgress(btn, completed, total) {
    const percent = total ? Math.round((completed / total) * 100) : 0;
    btn.title = `Завантаження тайлів: ${completed}/${total} (${percent}%)`;
    btn.style.setProperty('--omm-progress', `${percent}%`);
  }

  function setDone(btn) {
    btn.title = 'Завантаження зображення карти у максимальній роздільній здатності';
    btn.classList.remove('omm-busy');
    btn.classList.add('omm-done');
    btn.disabled = false;
    setTimeout(() => btn.classList.remove('omm-done'), 2000);
  }

  function resetButton(btn) {
    btn.title = 'Завантажити зображення карти у максимальній роздільній здатності';
    btn.classList.remove('omm-busy');
    btn.disabled = false;
    btn.style.removeProperty('--omm-progress');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
