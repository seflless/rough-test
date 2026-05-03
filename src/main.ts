import "./style.css";
import rough from "roughjs";

const svg = document.querySelector("svg");
const rc = rough.svg(svg);
const polygon = rc.polygon(
  [
    [10, 10],
    [200, 10],
    [100, 100],
    [100, 50],
    [300, 100],
    [60, 200],
  ],
  {
    stroke: "none", // <-- no outline
    fill: "red",
    // hachureAngle: -45, // angle of hachure,
    hachureGap: 8,
    roughness: 1,
    fillStyle: "zigzag",
    strokeWidth: 6,
    // fillStyle: "solid",
    // stroke: "black",
    // strokeWidth: 2,
    // fill: "red",
    // hachureAngle: 90,
  },
);
svg.appendChild(polygon);

const SVG_NS = "http://www.w3.org/2000/svg";

// Split each rough.js <path> into one <path> per subpath (each `M ...` block).
// This way each row of the zigzag fill becomes its own continuous stroke we can
// animate cleanly with stroke-dashoffset.
polygon.querySelectorAll<SVGPathElement>("path").forEach((original) => {
  const d = original.getAttribute("d") ?? "";
  // Match each subpath starting with M/m and going up to (but not including) the next M/m.
  const subpaths = d.match(/[Mm][^Mm]*/g) ?? [];
  if (subpaths.length <= 1) return;

  const parent = original.parentNode!;
  // rough.js's zigzag fill emits each row twice (a "double-stroke" for the
  // sketchy look) — keep only every other subpath so we don't draw each line
  // back over itself.
  subpaths
    .filter((_, idx) => idx % 2 === 0)
    .forEach((sub) => {
      const p = document.createElementNS(SVG_NS, "path");
      // Copy every attribute (stroke, stroke-width, fill, etc.) from the original.
      for (const attr of Array.from(original.attributes)) {
        p.setAttribute(attr.name, attr.value);
      }
      p.setAttribute("d", sub.trim());
      parent.insertBefore(p, original);
    });
  parent.removeChild(original);
});

const paths = polygon.querySelectorAll<SVGPathElement>("path");

const debug = document.createElement("pre");
debug.style.cssText =
  "position:fixed;top:0;right:0;background:#000;color:#0f0;padding:8px;font:11px monospace;max-height:90vh;overflow:auto;z-index:9999;";
document.body.appendChild(debug);
const log = (msg: string) => {
  debug.textContent += msg + "\n";
  console.log(msg);
};

// Measure each subpath and build cumulative ranges so we can drive a single
// "pen" position across all paths at constant speed. Path i covers cumulative
// arc-length [starts[i], starts[i] + lengths[i]).
const lengths: number[] = [];
const starts: number[] = [];
let totalLength = 0;
paths.forEach((path) => {
  const len = path.getTotalLength();
  starts.push(totalLength);
  lengths.push(len);
  totalLength += len;
  path.style.strokeDasharray = `${len}`;
  path.style.strokeDashoffset = `${len}`;
});

log(`paths: ${paths.length}  totalLength: ${totalLength.toFixed(1)}`);

// Map progress in [0, 1] to per-path stroke-dashoffset.
// Even-indexed paths draw forward (start → end). Odd-indexed paths draw in
// reverse (end → start) so the "pen" zigzags back and forth instead of
// snapping back to the same side every row.
//
// Reverse trick: with stroke-dasharray "L", animating dashoffset from -L → 0
// reveals the path from end-to-start.
const setProgress = (progress: number) => {
  const drawn = progress * totalLength;
  paths.forEach((path, i) => {
    const localDrawn = Math.max(0, Math.min(lengths[i], drawn - starts[i]));
    const remaining = lengths[i] - localDrawn;
    path.style.strokeDashoffset =
      i % 2 === 0 ? `${remaining}` : `${-remaining}`;
  });
};

// Playback UI: play/pause, scrubber, speed (px/s), time readouts.
const controls = document.createElement("div");
controls.style.cssText =
  "position:fixed;bottom:0;left:0;right:0;padding:12px;background:#111;color:#fff;font:13px system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:9999;";

const playBtn = document.createElement("button");
playBtn.textContent = "▶ Play";
playBtn.style.cssText =
  "padding:6px 12px;background:#2d7;color:#000;border:0;border-radius:4px;font:600 13px system-ui;cursor:pointer;min-width:90px;";

const slider = document.createElement("input");
slider.type = "range";
slider.min = "0";
slider.max = "1";
slider.step = "0.0001";
slider.value = "0";
slider.style.flex = "1";
slider.style.minWidth = "200px";

const speedInput = document.createElement("input");
speedInput.type = "number";
speedInput.min = "1";
speedInput.step = "10";
speedInput.value = "1600";
speedInput.style.cssText =
  "width:80px;padding:4px 6px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;font:13px system-ui;";

const speedLabel = document.createElement("label");
speedLabel.textContent = "Speed (px/s):";

const timeReadout = document.createElement("span");
timeReadout.style.cssText =
  "font-variant-numeric:tabular-nums;min-width:18ch;text-align:right;";

controls.append(playBtn, slider, speedLabel, speedInput, timeReadout);
document.body.appendChild(controls);

const getSpeed = () => Math.max(1, parseFloat(speedInput.value) || 1);
const getDurationMs = () => (totalLength / getSpeed()) * 1000;

const refreshReadout = (progress: number) => {
  const duration = getDurationMs();
  const current = progress * duration;
  timeReadout.textContent = `${current.toFixed(0)} / ${duration.toFixed(0)} ms`;
};

const update = () => {
  const p = parseFloat(slider.value);
  setProgress(p);
  refreshReadout(p);
};

let playing = false;
let lastFrameTime = 0;
const tick = (now: number) => {
  if (!playing) return;
  const dt = lastFrameTime === 0 ? 0 : (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  let p = parseFloat(slider.value);
  p += (dt * getSpeed()) / totalLength;
  if (p >= 1) {
    p = 1;
    stop();
  }
  slider.value = `${p}`;
  setProgress(p);
  refreshReadout(p);
  if (playing) requestAnimationFrame(tick);
};

const play = () => {
  if (parseFloat(slider.value) >= 1) {
    slider.value = "0";
    setProgress(0);
  }
  playing = true;
  lastFrameTime = 0;
  playBtn.textContent = "⏸ Pause";
  requestAnimationFrame(tick);
};

const stop = () => {
  playing = false;
  playBtn.textContent = "▶ Play";
};

playBtn.addEventListener("click", () => (playing ? stop() : play()));
slider.addEventListener("input", () => {
  if (playing) stop();
  update();
});
speedInput.addEventListener("input", () =>
  refreshReadout(parseFloat(slider.value)),
);
update();
