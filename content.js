(function () {
  const BUTTON_ID = 'omm-magic-button';
  const PANEL_ID = 'omm-magic-panel';

  function init() {
    // Only run on actual map-viewer pages (they render the home button).
    const homeBtn = document.getElementById('home-button');
    if (!homeBtn || document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'leaflet-bar leaflet-control';
    button.title = 'Розширені налаштування';
    button.innerHTML = '<i class="fa fa-magic"></i>';
    document.body.appendChild(button);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.innerHTML = `
      <div class="omm-panel-header">Розширені налаштування</div>
      <label class="omm-panel-row">
        <input type="checkbox" id="omm-toggle-center" checked>
        <span>Показати центр</span>
      </label>

      <div class="omm-panel-divider"></div>

      <div class="omm-panel-subheader">Вигляд мапи</div>
      <label class="omm-panel-row">
        <input type="radio" name="omm-view-mode" id="omm-view-side" value="side" checked>
        <span>Одна біля одної</span>
      </label>
      <label class="omm-panel-row">
        <input type="radio" name="omm-view-mode" id="omm-view-overlay" value="overlay">
        <span>На ввесь екран</span>
      </label>

      <div class="omm-opacity-row" id="omm-opacity-row" hidden>
        <label for="omm-opacity-slider">Прозорість <span id="omm-opacity-value">100%</span></label>
        <input type="range" id="omm-opacity-slider" min="0" max="100" value="100">
      </div>
    `;
    document.body.appendChild(panel);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      panel.hidden = !panel.hidden;
    });

    document.addEventListener('click', (event) => {
      if (panel.hidden) return;
      if (panel.contains(event.target) || button.contains(event.target)) return;
      panel.hidden = true;
    });

    panel.querySelector('#omm-toggle-center').addEventListener('change', (event) => {
      setCentersVisible(event.target.checked);
    });

    panel.querySelectorAll('input[name="omm-view-mode"]').forEach((radio) => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) setViewMode(event.target.value);
      });
    });

    const opacitySlider = panel.querySelector('#omm-opacity-slider');
    const opacityValue = panel.querySelector('#omm-opacity-value');
    opacitySlider.addEventListener('input', (event) => {
      opacityValue.textContent = `${event.target.value}%`;
      applyTopMapOpacity(event.target.value);
    });

    setupOverlayResizeHandling();
  }

  function setCentersVisible(visible) {
    document.querySelectorAll('.mapcenter').forEach((el) => {
      el.style.display = visible ? '' : 'none';
    });
  }

  const OVERLAY_BODY_CLASS = 'omm-overlay-mode';

  function setViewMode(mode) {
    const opacityRow = document.getElementById('omm-opacity-row');
    if (mode === 'overlay') {
      document.body.classList.add(OVERLAY_BODY_CLASS);
      opacityRow.hidden = false;
      applyTopMapOpacity(document.getElementById('omm-opacity-slider').value);
      floatControlsForOverlay();
    } else {
      document.body.classList.remove(OVERLAY_BODY_CLASS);
      opacityRow.hidden = true;
      applyTopMapOpacity(100);
      restoreControlsFromOverlay();
    }
    invalidateMapsSoon();
  }

  // #leftmap and #rightmap each create their own stacking context; once both
  // are full-size, a control living inside #rightmap can never render above
  // #leftmap's opaque tiles no matter its z-index. Detach the two controls
  // that need to stay visible/stacked and float them at the body level.
  const movedElements = [];
  const FLOAT_CLASSES = [
    'omm-floated',
    'omm-float-layers',
    'omm-float-layers-top',
    'omm-float-layers-bottom',
    'omm-float-attrib',
    'omm-float-attrib-top',
    'omm-float-attrib-bottom',
  ];

  function floatControlsForOverlay() {
    const targets = [
      { el: window.layersleft && window.layersleft.getContainer(), cls: ['omm-float-layers', 'omm-float-layers-top'] },
      { el: window.layersright && window.layersright.getContainer(), cls: ['omm-float-layers', 'omm-float-layers-bottom'] },
      { el: document.querySelector('#leftmap .leaflet-control-attribution'), cls: ['omm-float-attrib', 'omm-float-attrib-top'] },
      { el: document.querySelector('#rightmap .leaflet-control-attribution'), cls: ['omm-float-attrib', 'omm-float-attrib-bottom'] },
    ];
    targets.forEach(({ el, cls }) => {
      if (!el || el.classList.contains('omm-floated')) return;
      movedElements.push({ el, parent: el.parentNode, next: el.nextSibling });
      el.classList.add('omm-floated', ...cls);
      document.body.appendChild(el);
    });
  }

  function restoreControlsFromOverlay() {
    while (movedElements.length) {
      const { el, parent, next } = movedElements.pop();
      el.classList.remove(...FLOAT_CLASSES);
      parent.insertBefore(el, next);
    }
  }

  function applyTopMapOpacity(percent) {
    const pane = document.querySelector('#leftmap .leaflet-map-pane');
    if (pane) pane.style.opacity = String(Number(percent) / 100);
  }

  function invalidateMapsNow() {
    if (window.leftmap && typeof window.leftmap.invalidateSize === 'function') {
      window.leftmap.invalidateSize();
    }
    if (window.rightmap && typeof window.rightmap.invalidateSize === 'function') {
      window.rightmap.invalidateSize();
    }
  }

  function invalidateMapsSoon() {
    setTimeout(invalidateMapsNow, 300);
  }

  function setupOverlayResizeHandling() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (!document.body.classList.contains(OVERLAY_BODY_CLASS)) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(invalidateMapsNow, 250);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
