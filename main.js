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
    bgColor: "#000000"
});

const plasmaThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
function applyPlasmaTheme(isLight) {
    if (isLight) {
        screen.palette = ["#3e6aa1", "#4b7cc7", "#5b90e6", "#8cb6ff"];
        screen.config.bgColor = "#1f2736";
    } else {
        screen.palette = ["#164e82", "#1f6feb", "#58a6ff", "#b6e3ff"];
        screen.config.bgColor = "#000000";
    }
}
applyPlasmaTheme(plasmaThemeQuery.matches);
plasmaThemeQuery.addEventListener('change', (e) => applyPlasmaTheme(e.matches));
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

// ─────────────────────────────────────────────
// REFLOW: re-measure plasma canvas + ascii after any pane change
// ─────────────────────────────────────────────
const paneLeft = document.getElementById('paneLeft');
const paneRight = document.getElementById('paneRight');

function reflow() {
    screen.resize();
    scaleAsciiArt();
}

// Also reflow on plain window resize
window.addEventListener('resize', reflow);

// ─────────────────────────────────────────────
// TMUX SPLIT / NAVIGATION LOGIC
// ─────────────────────────────────────────────
const previewFrame = document.getElementById('previewFrame');
const previewTitle = document.getElementById('previewTitle');
const closePreview = document.getElementById('closePreview');
const statusPanes = document.getElementById('statusPanes');

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
    statusPanes.textContent = '[1/2]';
    reflow();
}

function closeProject() {
    paneLeft.classList.remove('split');
    paneRight.classList.remove('open');
    previewFrame.src = 'about:blank';
    statusPanes.textContent = '[1/1]';
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
