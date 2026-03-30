// ─────────────────────────────────────────────
// ASCII ART SCALING
// Measures the art's intrinsic width at a known reference size,
// then scales down (never up past that reference) to fit the header.
// Called on window resize AND after every pane open/close.
// ─────────────────────────────────────────────
const asciiEl = document.getElementById('asciiArt');
const headerOverlay = document.querySelector('.header-overlay');

// We measure once at a large reference size to know the "native" pixel width.
const REF_FONT_SIZE = 13; // px — max size the art will ever render at
const ASCII_SIDE_MARGIN = 24; // px on each side
let asciiNativeWidth = 0;

function measureAsciiNativeWidth() {
    // Temporarily set a known size, measure, then restore
    asciiEl.style.fontSize = REF_FONT_SIZE + 'px';
    asciiNativeWidth = asciiEl.scrollWidth;
    asciiEl.style.fontSize = ''; // clear so we can set the real value next
}

function scaleAsciiArt() {
    // Available width = the header container (which tracks the left pane width)
    const containerW = headerOverlay.getBoundingClientRect().width;
    const availableW = Math.max(containerW - (ASCII_SIDE_MARGIN * 2), 0);
    if (availableW <= 0 || asciiNativeWidth <= 0) return;

    // Linear ratio: how much we need to shrink
    let scale = availableW / asciiNativeWidth;
    // Cap at the reference size (never blow it up beyond native)
    scale = Math.min(scale, 1);
    // Clamp to a readable minimum
    const fontSize = Math.max(scale * REF_FONT_SIZE, 5);
    asciiEl.style.fontSize = fontSize + 'px';
}

// Initial measure + scale
measureAsciiNativeWidth();
scaleAsciiArt();

// ─────────────────────────────────────────────
// THEME TOGGLE (system by default, then manual)
// ─────────────────────────────────────────────
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const THEME_STORAGE_KEY = 'theme-preference';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

let themePreference = localStorage.getItem(THEME_STORAGE_KEY);
if (themePreference !== 'light' && themePreference !== 'dark') {
    themePreference = null;
}

function getEffectiveTheme() {
    if (themePreference) return themePreference;
    return systemThemeQuery.matches ? 'dark' : 'light';
}

function updateThemeToggle() {
    if (!themeToggle) return;
    const effective = getEffectiveTheme();
    const usingSystem = themePreference === null;
    themeToggle.textContent = effective === 'light' ? 'D' : 'L';
    themeToggle.title = usingSystem
        ? `Theme: ${effective} (system). Click to switch to ${effective === 'light' ? 'dark' : 'light'}.`
        : `Theme: ${effective} (manual). Click to switch to ${effective === 'light' ? 'dark' : 'light'}.`;
    themeToggle.setAttribute('aria-label', `Switch to ${effective === 'light' ? 'dark' : 'light'} mode`);
}

function applyThemePreference() {
    const effectiveTheme = getEffectiveTheme();
    root.dataset.theme = effectiveTheme;
    applyPlasmaTheme(effectiveTheme === 'light');
    updateThemeToggle();
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        themePreference = getEffectiveTheme() === 'light' ? 'dark' : 'light';
        localStorage.setItem(THEME_STORAGE_KEY, themePreference);
        applyThemePreference();
    });
}

systemThemeQuery.addEventListener('change', () => {
    if (themePreference === null) {
        applyThemePreference();
    }
});

// ─────────────────────────────────────────────
// PLASMA ANIMATION
// ─────────────────────────────────────────────
class AsciiScreen {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.palette = config.palette || ['#ffffff'];
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.container.appendChild(this.canvas);
        this.fontSize = 9;
        this.fontFamily = 'Courier New, Courier, monospace';
        this.resize();
        // window resize is one trigger; reflow() after open/close is the other
        window.addEventListener('resize', () => this.resize());
    }
    resize() {
        const rect = this.container.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (w <= 0 || h <= 0) return; // pane is collapsed, skip
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        const m = this.ctx.measureText('W');
        this.charW = Math.ceil(m.width);
        this.charH = Math.ceil(this.fontSize * 1.15);
        this.cols = Math.floor(w / this.charW);
        this.rows = Math.floor(h / this.charH);
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.scale(dpr, dpr);
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'center';
        const size = this.cols * this.rows;
        this.data = new Array(size).fill(' ');
        this.colors = new Uint8Array(size).fill(0);
    }
    clear() { this.data.fill(' '); }
    put(x, y, char, colorIdx = 0) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
        const i = y * this.cols + x;
        this.data[i] = char;
        this.colors[i] = colorIdx;
    }
    render() {
        const cw = this.charW, ch = this.charH;
        this.ctx.fillStyle = this.config.bgColor || '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const i = y * this.cols + x;
                const char = this.data[i];
                if (!char || char === ' ') continue;
                this.ctx.fillStyle = this.palette[this.colors[i] % this.palette.length];
                this.ctx.fillText(char, x * cw + (cw / 2), y * ch);
            }
        }
    }
}

const plasmaContainer = document.getElementById('plasma-bg');
const screen = new AsciiScreen(plasmaContainer, {
    palette: ["#164e82", "#1f6feb", "#58a6ff", "#b6e3ff"],
    bgColor: "#070f20"
});

function applyPlasmaTheme(isLight) {
    if (isLight) {
        screen.palette = ["#3e6aa1", "#4b7cc7", "#5b90e6", "#8cb6ff"];
        screen.config.bgColor = "#1f2736";
    } else {
        screen.palette = ["#2d66a8", "#3f8df0", "#7ec0ff", "#d2ecff"];
        screen.config.bgColor = "#070f20";
    }
}
applyThemePreference();
const CHARS = " .:`',:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

function drawPlasma(t) {
    const cols = screen.cols, rows = screen.rows;
    screen.clear();
    const xScale = 0.08, yScale = 0.15;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const u = x * xScale, v = y * yScale;
            let val = Math.sin(u + t * 1.2);
            val += Math.sin((v + u) * 0.8 + t);
            val += Math.sin(Math.sqrt(u * u + v * v) * 2.0 + t);
            let density = Math.pow((val + 3) / 6, 1.5);
            const d = Math.max(0, Math.min(1, density));
            screen.put(x, y, CHARS[Math.floor(d * (CHARS.length - 1))], Math.floor(density * 10 + t * 0.8) % 4);
        }
    }
    screen.render();
}
let startTime = performance.now();
function plasmaLoop(now) {
    drawPlasma((now - startTime) / 1000 * 0.6);
    requestAnimationFrame(plasmaLoop);
}
requestAnimationFrame(plasmaLoop);

// Prevent double-tap zoom on touch devices.
if (window.matchMedia('(pointer: coarse)').matches) {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd < 350) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}

// Block browser-level pinch zoom; pane-level custom pinch handlers take over.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

// ─────────────────────────────────────────────
// REFLOW: re-measure plasma canvas + ascii after any pane change
// ─────────────────────────────────────────────
const paneLeft = document.getElementById('paneLeft');
const paneRight = document.getElementById('paneRight');
const leftScroll = document.getElementById('leftScroll');
let leftPaneScale = 1;
let rightPaneScale = 1;

function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function applyElementZoom(el, scale) {
    if (!el) return;
    if (CSS.supports('zoom', '1')) {
        el.style.zoom = scale.toFixed(3);
    } else {
        el.style.transformOrigin = 'top left';
        el.style.transform = `scale(${scale})`;
    }
}

function addPinchZoom(target, getScale, setScale) {
    if (!target) return;
    let isPinching = false;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;

    target.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 2) return;
        isPinching = true;
        pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
        pinchStartScale = getScale();
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
        if (!isPinching || e.touches.length !== 2) return;
        const distance = getTouchDistance(e.touches[0], e.touches[1]);
        if (!pinchStartDistance) return;
        e.preventDefault();
        const nextScale = clamp(pinchStartScale * (distance / pinchStartDistance), 1, 2.5);
        setScale(nextScale);
    }, { passive: false });

    const stopPinch = () => { isPinching = false; };
    target.addEventListener('touchend', stopPinch, { passive: true });
    target.addEventListener('touchcancel', stopPinch, { passive: true });
}

function addSafariGesturePinch(target, getScale, setScale) {
    if (!target) return;
    let gestureBaseScale = 1;
    let gestureStartScale = 1;

    target.addEventListener('gesturestart', (e) => {
        e.preventDefault();
        gestureBaseScale = getScale();
        gestureStartScale = e.scale || 1;
    }, { passive: false });

    target.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        const current = e.scale || 1;
        const ratio = current / (gestureStartScale || 1);
        setScale(clamp(gestureBaseScale * ratio, 1, 2.5));
    }, { passive: false });

    target.addEventListener('gestureend', (e) => {
        e.preventDefault();
    }, { passive: false });
}

function reflow() {
    screen.resize();
    scaleAsciiArt();
}

// Also reflow on plain window resize
window.addEventListener('resize', reflow);

// Prevent elastic overscroll on the left pane by clamping wheel scrolling.
if (leftScroll) {
    addPinchZoom(
        leftScroll,
        () => leftPaneScale,
        (scale) => {
            leftPaneScale = scale;
            applyElementZoom(leftScroll, leftPaneScale);
        }
    );
    addSafariGesturePinch(
        leftScroll,
        () => leftPaneScale,
        (scale) => {
            leftPaneScale = scale;
            applyElementZoom(leftScroll, leftPaneScale);
        }
    );

    leftScroll.addEventListener('wheel', (e) => {
        e.preventDefault();
        const maxScrollTop = Math.max(leftScroll.scrollHeight - leftScroll.clientHeight, 0);
        const next = leftScroll.scrollTop + e.deltaY;
        leftScroll.scrollTop = Math.min(Math.max(next, 0), maxScrollTop);
    }, { passive: false });
}

// ─────────────────────────────────────────────
// TMUX SPLIT / NAVIGATION LOGIC
// ─────────────────────────────────────────────
const previewFrame = document.getElementById('previewFrame');
const previewTitle = document.getElementById('previewTitle');
const closePreview = document.getElementById('closePreview');

function bindPreviewPanePinchZoom() {
    if (!previewFrame) return;

    try {
        const frameDoc = previewFrame.contentDocument;
        if (!frameDoc) return;
        const frameRoot = frameDoc.scrollingElement || frameDoc.documentElement;
        addPinchZoom(
            frameDoc,
            () => rightPaneScale,
            (scale) => {
                rightPaneScale = scale;
                applyElementZoom(frameRoot, rightPaneScale);
            }
        );
        addSafariGesturePinch(
            frameDoc,
            () => rightPaneScale,
            (scale) => {
                rightPaneScale = scale;
                applyElementZoom(frameRoot, rightPaneScale);
            }
        );
    } catch {
        // If iframe access is restricted, skip custom pinch for preview pane.
    }
}

if (previewFrame) {
    previewFrame.addEventListener('load', bindPreviewPanePinchZoom);
}

const navItems = Array.from(document.querySelectorAll('.nav-item[data-project]'));
let focusIdx = 0;

function setFocus(idx) {
    navItems.forEach((el, i) => {
        el.classList.toggle('focused', i === idx);
    });
    focusIdx = idx;
}

function openProject(idx) {
    const item = navItems[idx];
    if (!item) return;
    const key = item.dataset.project;
    const title = item.dataset.title;
    const path = PROJECT_PATHS[key];
    if (!path) return;

    previewTitle.textContent = title;
    previewFrame.src = path;

    paneLeft.classList.add('split');
    paneRight.classList.add('open');
    reflow();
}

function closeProject() {
    paneLeft.classList.remove('split');
    paneRight.classList.remove('open');
    previewFrame.src = 'about:blank';
    reflow();
}

// Click handlers on nav items
navItems.forEach((item, i) => {
    item.addEventListener('click', () => {
        setFocus(i);
        openProject(i);
    });
});

// Close button
closePreview.addEventListener('click', closeProject);

// ─── KEYBOARD NAVIGATION ───
document.addEventListener('keydown', (e) => {
    if (document.activeElement === previewFrame) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            setFocus(Math.min(focusIdx + 1, navItems.length - 1));
            navItems[focusIdx].scrollIntoView({ block: 'nearest' });
            break;
        case 'ArrowUp':
            e.preventDefault();
            setFocus(Math.max(focusIdx - 1, 0));
            navItems[focusIdx].scrollIntoView({ block: 'nearest' });
            break;
        case 'Enter':
            e.preventDefault();
            openProject(focusIdx);
            break;
        case 'Escape':
            if (paneRight.classList.contains('open')) {
                e.preventDefault();
                closeProject();
            }
            break;
    }
});

// Initial focus
setFocus(0);
