/* Change artist, track and asset paths only here. */
const CONFIG = Object.freeze({
  artist: "CryptoSound",
  realName: "Enio Ferreira",
  location: "São Paulo, Brazil",
  profileImage: "assets/images/enio.jpg",
  track: Object.freeze({
    title: "Alinys Special Set",
    audio: "assets/audio/Alinx Special 7.mp3",
    peaks: "assets/audio/track-peaks.json",
    cover: "assets/images/cover.svg"
  })
});

function getTrackTitleFromFilePath(path) {
  const cleanPath = String(path || "").split(/[?#]/, 1)[0];
  const fileName = cleanPath.split("/").pop() || "";
  try {
    return decodeURIComponent(fileName).replace(/\.[^/.]+$/, "");
  } catch {
    return fileName.replace(/\.[^/.]+$/, "");
  }
}

const FILE_TRACK_TITLE = getTrackTitleFromFilePath(CONFIG.track.audio) || "Untitled transmission";
const TRACK_TITLE = CONFIG.track.title.trim() || FILE_TRACK_TITLE;

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio");
const canvas = $("#waveform");
const waveShell = $("#waveShell");
const playButton = $("#playButton");
const muteButton = $("#muteButton");
const volume = $("#volume");
const stateLabel = $("#stateLabel");
const loadingText = $("#loadingText");
const errorMessage = $("#errorMessage");
const playhead = $("#playhead");
const hoverTime = $("#hoverTime");

const player = {
  state: "idle",
  duration: 0,
  peaks: [],
  decoded: false,
  decoding: false,
  dragging: false,
  audioContext: null,
  analyser: null,
  source: null,
  raf: 0
};

function applyConfig() {
  document.title = `${CONFIG.artist} — Psychedelic Frequencies`;
  $("#artistName").textContent = CONFIG.artist;
  $("#realName").textContent = CONFIG.realName;
  $("#location").textContent = CONFIG.location;
  $("#trackTitle").textContent = TRACK_TITLE;
  $("#trackArtist").textContent = CONFIG.artist;
  $("#profileImage").src = CONFIG.profileImage;
  $("#coverImage").src = CONFIG.track.cover;
  $("#coverImage").alt = `${TRACK_TITLE} artwork`;
  playButton.setAttribute("aria-label", `Play ${TRACK_TITLE}`);
  audio.src = CONFIG.track.audio;
  audio.volume = Number(localStorage.getItem("cryptosound-volume") ?? 0.82);
  volume.value = audio.volume;
}

function setState(state, label = state) {
  player.state = state;
  document.body.dataset.state = state;
  stateLabel.textContent = label.toUpperCase();
  playButton.setAttribute("aria-label", `${state === "playing" ? "Pause" : "Play"} ${TRACK_TITLE}`);
  if (state === "playing") $("#controlTitle").textContent = "TRANSMITTING";
  else if (state === "error") $("#controlTitle").textContent = "SIGNAL LOST";
  else $("#controlTitle").textContent = state === "ended" ? "PLAY AGAIN" : "ENTER THE FREQUENCY";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}

function createPlaceholderPeaks(count = 720) {
  return Array.from({ length: count }, (_, i) => {
    const envelope = 0.32 + Math.sin((i / count) * Math.PI) * 0.47;
    const texture = Math.abs(Math.sin(i * 0.133) * 0.55 + Math.sin(i * 0.047) * 0.35 + Math.sin(i * 0.71) * 0.1);
    return Math.max(0.06, Math.min(1, envelope * (0.28 + texture)));
  });
}

function normalizePeaks(data) {
  const values = Array.isArray(data) ? data : data?.peaks;
  if (!Array.isArray(values) || values.length < 16) throw new Error("Invalid peaks");
  const max = Math.max(...values.map((value) => Math.abs(Number(value) || 0)), 0.001);
  return values.map((value) => Math.min(1, Math.abs(Number(value) || 0) / max));
}

async function loadCachedPeaks() {
  try {
    const response = await fetch(CONFIG.track.peaks, { cache: "force-cache" });
    if (!response.ok) return;
    player.peaks = normalizePeaks(await response.json());
    player.decoded = true;
    drawWaveform();
  } catch { /* The WAV is decoded after the first user interaction. */ }
}

async function decodeRealPeaks() {
  if (player.decoded || player.decoding) return;
  player.decoding = true;
  loadingText.textContent = "Reading frequency…";
  try {
    const response = await fetch(CONFIG.track.audio);
    if (!response.ok) throw new Error("Audio unavailable");
    const bytes = await response.arrayBuffer();
    const context = player.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const target = Math.min(1800, Math.max(600, Math.round(canvas.clientWidth * 1.8)));
    const block = Math.max(1, Math.floor(buffer.length / target));
    const peaks = [];
    for (let i = 0; i < target; i++) {
      const start = i * block;
      let peak = 0;
      for (let j = start; j < Math.min(start + block, buffer.length); j += Math.max(1, Math.floor(block / 48))) {
        for (const channel of channels) peak = Math.max(peak, Math.abs(channel[j] || 0));
      }
      peaks.push(peak);
    }
    player.peaks = normalizePeaks(peaks);
    player.decoded = true;
    drawWaveform();
  } catch {
    /* Playback can continue even when decoding is not supported or memory is limited. */
  } finally {
    player.decoding = false;
    loadingText.textContent = "Frequency ready";
  }
}

function drawWaveform() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const progress = player.duration ? Math.min(1, audio.currentTime / player.duration) : 0;
  const barWidth = width < 500 ? 2 : 2.5;
  const gap = width < 500 ? 2 : 2.7;
  const bars = Math.max(1, Math.floor(width / (barWidth + gap)));
  const center = height / 2;
  const idle = context.createLinearGradient(0, 0, 0, height);
  idle.addColorStop(0, "rgba(92, 78, 113, .54)"); idle.addColorStop(.5, "rgba(44, 37, 55, .42)"); idle.addColorStop(1, "rgba(92, 78, 113, .54)");
  const played = context.createLinearGradient(0, 0, width, 0);
  played.addColorStop(0, "#e600ff"); played.addColorStop(.54, "#7c3aed"); played.addColorStop(1, "#00e5ff");
  context.lineCap = "round";
  for (let i = 0; i < bars; i++) {
    const peakIndex = Math.min(player.peaks.length - 1, Math.floor((i / bars) * player.peaks.length));
    const value = player.peaks[peakIndex] || 0.1;
    const amplitude = Math.max(3, value * height * 0.44);
    context.strokeStyle = i / bars <= progress ? played : idle;
    context.shadowColor = i / bars <= progress ? "rgba(230,0,255,.5)" : "transparent";
    context.shadowBlur = i / bars <= progress ? 5 : 0;
    context.lineWidth = barWidth;
    context.beginPath(); context.moveTo(i * (barWidth + gap) + 1, center - amplitude); context.lineTo(i * (barWidth + gap) + 1, center + amplitude); context.stroke();
  }
  playhead.style.left = `${progress * 100}%`;
  canvas.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
}

function seekFromPointer(event) {
  if (!player.duration) return;
  const rect = waveShell.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audio.currentTime = ratio * player.duration;
  drawWaveform();
}

async function togglePlayback() {
  if (player.state === "error") { errorMessage.hidden = true; audio.load(); setState("loading", "reconnecting"); }
  if (!audio.paused) { audio.pause(); return; }
  setState("loading", "loading");
  setupAnalyser();
  decodeRealPeaks();
  try { await audio.play(); } catch { showError(); }
}

function setupAnalyser() {
  if (player.audioContext || !(window.AudioContext || window.webkitAudioContext)) return;
  try {
    player.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    player.source = player.audioContext.createMediaElementSource(audio);
    player.analyser = player.audioContext.createAnalyser();
    player.analyser.fftSize = 128;
    player.analyser.smoothingTimeConstant = 0.82;
    player.source.connect(player.analyser);
    player.analyser.connect(player.audioContext.destination);
  } catch { player.analyser = null; }
}

function animateBass() {
  cancelAnimationFrame(player.raf);
  if (audio.paused) { document.body.style.setProperty("--bass-scale", "1"); return; }
  if (player.analyser) {
    const bins = new Uint8Array(player.analyser.frequencyBinCount);
    player.analyser.getByteFrequencyData(bins);
    const bass = bins.slice(0, 10).reduce((sum, value) => sum + value, 0) / 10 / 255;
    document.body.style.setProperty("--bass-scale", String(1.02 + bass * 0.16));
  }
  player.raf = requestAnimationFrame(animateBass);
}

function showError() {
  setState("error", "offline");
  errorMessage.hidden = false;
  loadingText.textContent = "Signal unavailable";
}

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function share() {
  const payload = { title: `${TRACK_TITLE} — ${CONFIG.artist}`, text: `${CONFIG.artist} — ${TRACK_TITLE}`, url: location.href };
  try {
    if (navigator.share) await navigator.share(payload);
    else { await navigator.clipboard.writeText(location.href); showToast("Link copied"); }
  } catch (error) { if (error.name !== "AbortError") showToast("Unable to share"); }
}

function bindEvents() {
  playButton.addEventListener("click", togglePlayback);
  $("#shareButton").addEventListener("click", share);
  volume.addEventListener("input", () => { audio.volume = Number(volume.value); audio.muted = false; localStorage.setItem("cryptosound-volume", volume.value); });
  muteButton.addEventListener("click", () => { audio.muted = !audio.muted; muteButton.setAttribute("aria-label", audio.muted ? "Unmute" : "Mute"); muteButton.style.opacity = audio.muted ? ".45" : "1"; });
  waveShell.addEventListener("pointerdown", (event) => { player.dragging = true; waveShell.setPointerCapture(event.pointerId); seekFromPointer(event); });
  waveShell.addEventListener("pointermove", (event) => { const rect = waveShell.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); hoverTime.style.left = `${ratio * 100}%`; hoverTime.textContent = formatTime(ratio * player.duration); if (player.dragging) seekFromPointer(event); });
  waveShell.addEventListener("pointerup", () => { player.dragging = false; });
  canvas.addEventListener("keydown", (event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); audio.currentTime = Math.max(0, Math.min(player.duration, audio.currentTime + (event.key === "ArrowRight" ? 5 : -5))); } });
  audio.addEventListener("loadedmetadata", () => { player.duration = audio.duration; $("#duration").textContent = formatTime(player.duration); errorMessage.hidden = true; setState("ready"); drawWaveform(); });
  audio.addEventListener("canplay", () => { if (audio.paused && player.state === "loading") setState("ready"); });
  audio.addEventListener("play", () => { setState("playing"); animateBass(); });
  audio.addEventListener("pause", () => { if (!audio.ended && player.state !== "error") setState("paused"); cancelAnimationFrame(player.raf); });
  audio.addEventListener("waiting", () => setState("buffering", "buffering"));
  audio.addEventListener("playing", () => setState("playing"));
  audio.addEventListener("timeupdate", () => { $("#currentTime").textContent = formatTime(audio.currentTime); drawWaveform(); });
  audio.addEventListener("ended", () => { setState("ended"); drawWaveform(); });
  audio.addEventListener("error", showError);
  window.addEventListener("resize", drawWaveform);
  document.addEventListener("keydown", (event) => {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
    if (event.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
    if (event.key === "ArrowRight") audio.currentTime = Math.min(player.duration || Infinity, audio.currentTime + 5);
    if (event.key === "ArrowUp") { event.preventDefault(); audio.volume = Math.min(1, audio.volume + .05); volume.value = audio.volume; }
    if (event.key === "ArrowDown") { event.preventDefault(); audio.volume = Math.max(0, audio.volume - .05); volume.value = audio.volume; }
  });
}

function particles() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("#particles"); const context = layer.getContext("2d"); let dots = [];
  const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2); layer.width = innerWidth * dpr; layer.height = innerHeight * dpr; layer.style.width = `${innerWidth}px`; layer.style.height = `${innerHeight}px`; context.setTransform(dpr, 0, 0, dpr, 0, 0); dots = Array.from({ length: Math.min(90, innerWidth / 12) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + .2, v: Math.random() * .08 + .02, a: Math.random() * .35 + .08 })); };
  const frame = () => { context.clearRect(0, 0, innerWidth, innerHeight); for (const dot of dots) { dot.y -= dot.v * (player.state === "playing" ? 2 : 1); if (dot.y < -2) dot.y = innerHeight + 2; context.globalAlpha = dot.a; context.fillStyle = dot.x % 5 < 1 ? "#00e5ff" : "#ffffff"; context.fillRect(dot.x, dot.y, dot.r, dot.r); } requestAnimationFrame(frame); };
  resize(); addEventListener("resize", resize); frame();
}

applyConfig();
player.peaks = createPlaceholderPeaks();
drawWaveform();
bindEvents();
loadCachedPeaks();
particles();
