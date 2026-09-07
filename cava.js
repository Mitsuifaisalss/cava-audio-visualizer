/**
 * ============================================================================
 * CAVA Audio Visualizer Live Wallpaper
 * For Lively Wallpaper (rocksdanister)
 * High-performance Canvas 2D audio visualizer engine with CAVA-style physics,
 * segmented terminal blocks, floating peak caps, and customizable themes.
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Visualizer Configuration State (Defaults match LivelyProperties.json) ---
  const config = {
    themePreset: 0, // 0: Cyberpunk, 1: Matrix, 2: Sunset, 3: Tokyo, 4: Nordic, 5: Monochrome, 6: Rainbow, 7: Custom
    primaryColor: '#00F2FE',
    secondaryColor: '#FF007F',
    backgroundColor: '#050508',
    barStyle: 0, // 0: Segmented Terminal Blocks, 1: Solid Bars, 2: Outlined Bars
    barCount: 64,
    barSpacing: 4,
    placement: 0, // 0: Bottom, 1: Center Mirror, 2: Top Ceiling
    maxHeight: 65, // % of screen height
    sensitivity: 14,
    smoothing: 75, // Gravity falloff smoothing (0-100)
    showPeaks: true,
    peakDecay: 4,
    ambientGlow: true,
    showClock: true,
    clockPosition: 0, // 0: Top Right, 1: Top Center, 2: Top Left, 3: Center Screen
    showPerformance: true,
    perfPosition: 0, // 0: Top Left, 1: Top Right, 2: Bottom Left, 3: Bottom Right
    perfOpacity: 85, // % opacity
    showMagicCircle: true,
    circleSize: 280, // px diameter
    circleSpeed: 4, // 1 to 10
    showNowPlaying: true,
    bgMode: 1, // 0: Pure OLED Dark, 1: Custom Image (backgrounds/), 2: Dynamic Audio-Reactive Dim
    bgImage: 'anime_wallpaper.jpg',
    bgBrightness: 60, // %
    bgBlur: 2, // px
    targetFps: 60 // 60: Smooth, 30: Battery saver, 0: Uncapped
  };

  // Frame pacing and efficiency throttles
  let targetFps = 60;
  let frameInterval = 1000 / 60;
  let lastFrameTime = 0;
  let lastGlowEnergy = -1;

  // --- Theme Palettes Definition ---
  const themes = [
    {
      name: 'Cyberpunk Neon',
      stops: [
        { pos: 0.0, color: '#00F2FE' }, // Cyan
        { pos: 0.5, color: '#9B51E0' }, // Neon Purple
        { pos: 1.0, color: '#FF007F' }  // Hot Pink
      ],
      peakColor: '#FFFFFF',
      glowColor: 'rgba(0, 242, 254, 0.22)',
      bg: '#050508'
    },
    {
      name: 'Phosphor Matrix',
      stops: [
        { pos: 0.0, color: '#003B00' }, // Dark Green
        { pos: 0.5, color: '#00B32C' }, // Matrix Green
        { pos: 1.0, color: '#00FF66' }  // Electric Lime
      ],
      peakColor: '#A3FFB8',
      glowColor: 'rgba(0, 255, 102, 0.20)',
      bg: '#020904'
    },
    {
      name: 'Sunset Amber',
      stops: [
        { pos: 0.0, color: '#800020' }, // Burgundy
        { pos: 0.45, color: '#FF4500' }, // Vivid Orange
        { pos: 1.0, color: '#FFCC00' }  // Golden Amber
      ],
      peakColor: '#FFF3B0',
      glowColor: 'rgba(255, 69, 0, 0.24)',
      bg: '#090406'
    },
    {
      name: 'Tokyo Vaporwave',
      stops: [
        { pos: 0.0, color: '#7928CA' }, // Deep Violet
        { pos: 0.5, color: '#0070F3' }, // Azure
        { pos: 1.0, color: '#F81CE5' }  // Magenta
      ],
      peakColor: '#FFE7FC',
      glowColor: 'rgba(248, 28, 229, 0.22)',
      bg: '#07050E'
    },
    {
      name: 'Nordic Ice Frost',
      stops: [
        { pos: 0.0, color: '#0A2540' }, // Midnight Navy
        { pos: 0.5, color: '#00D4FF' }, // Ice Cyan
        { pos: 1.0, color: '#E0F7FF' }  // Crystal Frost
      ],
      peakColor: '#FFFFFF',
      glowColor: 'rgba(0, 212, 255, 0.22)',
      bg: '#040810'
    },
    {
      name: 'Cava Monochrome',
      stops: [
        { pos: 0.0, color: '#2D3748' }, // Slate Gray
        { pos: 0.5, color: '#A0AEC0' }, // Cool Silver
        { pos: 1.0, color: '#F7FAFC' }  // Pure White
      ],
      peakColor: '#FFFFFF',
      glowColor: 'rgba(255, 255, 255, 0.12)',
      bg: '#08080A'
    }
  ];

  // Request high-performance discrete GPU (NVIDIA) in Chromium/WebView2
  try {
    const gpuSelector = document.createElement('canvas');
    gpuSelector.width = 1;
    gpuSelector.height = 1;
    const gl = gpuSelector.getContext('webgl2', { powerPreference: 'high-performance' }) ||
               gpuSelector.getContext('webgl', { powerPreference: 'high-performance' });
  } catch (e) {}

  // --- Internal Engine State ---
  const canvas = document.getElementById('cavaCanvas');
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const customBgEl = document.getElementById('customBg');
  const bgImgEl = document.getElementById('bgImg');
  const bgOverlayEl = document.getElementById('bgOverlay');
  const ambientGlowEl = document.getElementById('ambientGlow');
  const hudContainerEl = document.getElementById('hudContainer');
  const hudTimeEl = document.getElementById('hudTime');
  const hudDateEl = document.getElementById('hudDate');
  const standaloneControlsEl = document.getElementById('standaloneControls');
  const standaloneStatusTextEl = document.getElementById('standaloneStatusText');
  const micBtn = document.getElementById('micBtn');

  // Performance HUD DOM Elements & Telemetry
  const perfHUDEl = document.getElementById('perfHUD');
  const perfFpsEl = document.getElementById('perfFps');
  const cpuPercentEl = document.getElementById('cpuPercent');
  const cpuMeterEl = document.getElementById('cpuMeter');
  const cpuNameEl = document.getElementById('cpuName');
  const ramPercentEl = document.getElementById('ramPercent');
  const ramMeterEl = document.getElementById('ramMeter');
  const ramDetailEl = document.getElementById('ramDetail');
  const gpuPercentEl = document.getElementById('gpuPercent');
  const gpuMeterEl = document.getElementById('gpuMeter');
  const gpuNameEl = document.getElementById('gpuName');
  const netSpeedEl = document.getElementById('netSpeed');

  const cpuCanvas = document.getElementById('cpuGraph');
  const cpuCtx = cpuCanvas ? cpuCanvas.getContext('2d') : null;
  const ramCanvas = document.getElementById('ramGraph');
  const ramCtx = ramCanvas ? ramCanvas.getContext('2d') : null;
  const gpuCanvas = document.getElementById('gpuGraph');
  const gpuCtx = gpuCanvas ? gpuCanvas.getContext('2d') : null;

  // History buffers for sparkline graphs (28 data points)
  const SPARKLINE_POINTS = 28;
  const cpuHistory = new Array(SPARKLINE_POINTS).fill(15);
  const ramHistory = new Array(SPARKLINE_POINTS).fill(42);
  const gpuHistory = new Array(SPARKLINE_POINTS).fill(10);

  let lastLivelySysInfoTime = 0;
  let isLivelySysInfoActive = false;

  // FPS Tracking
  let frameCount = 0;
  let lastFpsUpdateTime = performance.now();
  let currentFps = 60;

  // Touhou Magic Circle & Media DOM Elements
  const magicCircleWrapEl = document.getElementById('magicCircleWrap');
  const magicCanvas = document.getElementById('magicCircleCanvas');
  const magicCtx = magicCanvas ? magicCanvas.getContext('2d') : null;
  const magicCoreEl = document.getElementById('magicCore');
  const magicAlbumArtEl = document.getElementById('magicAlbumArt');
  const magicDefaultCoreEl = document.getElementById('magicDefaultCore');
  const nowPlayingCardEl = document.getElementById('nowPlayingCard');
  const trackTitleEl = document.getElementById('trackTitle');
  const trackArtistEl = document.getElementById('trackArtist');

  // Magic Circle Rotation & Danmaku Mana Particles
  let magicRotationAngle = 0;
  const magicParticles = [];
  for (let i = 0; i < 16; i++) {
    magicParticles.push({
      angle: (i / 16) * Math.PI * 2,
      distRatio: 0.38 + Math.random() * 0.55,
      speed: (Math.random() * 0.015 + 0.005) * (i % 2 === 0 ? 1 : -1),
      radius: Math.random() * 2.2 + 1.2,
      alpha: Math.random() * 0.7 + 0.3
    });
  }

  let lastTrackUpdateTime = 0;
  let isTrackActive = false;

  let width = 0;
  let height = 0;
  let dpr = 1;

  // Bars physics array
  let bars = [];
  const RAW_FFT_SIZE = 128;
  let rawAudioData = new Float32Array(RAW_FFT_SIZE);

  // Audio source detection & standalone demo state
  let lastLivelyAudioTime = 0;
  let isLivelyActive = false;
  let isMicActive = false;
  let micAnalyser = null;
  let micDataArray = null;

  // Procedural demo synthesizer timing
  let demoPhase = 0;

  // --- Initialization & Resizing ---
  function resize() {
    // Cap DPR to 1.25 to prevent 4x-8x fill-rate overhead on Intel UHD integrated graphics
    dpr = Math.min(1.25, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.scale(dpr, dpr);
    initBars();
  }

  function initBars() {
    bars = [];
    for (let i = 0; i < config.barCount; i++) {
      bars.push({
        currentHeight: 0,
        targetHeight: 0,
        peakHeight: 0,
        peakHold: 0,
        peakVelocity: 0
      });
    }
  }

  window.addEventListener('resize', resize);

  // --- CAVA Audio Frequency Binning & Equalization ---
  /**
   * Maps 128 raw FFT frequency bins to user-configured bar count using
   * a logarithmic curve and Fletcher-Munson perceptual equalization weighting.
   */
  function processAudioFrequencies(audioInput) {
    const inputLen = audioInput.length;
    const barCount = config.barCount;
    const maxPxHeight = (height * config.maxHeight) / 100;
    const gain = config.sensitivity / 10;

    for (let i = 0; i < barCount; i++) {
      // Logarithmic bin distribution: low frequencies get narrow bins, highs get grouped
      const normIdxStart = Math.pow(i / barCount, 1.75);
      const normIdxEnd = Math.pow((i + 1) / barCount, 1.75);

      const binStart = Math.min(inputLen - 1, Math.floor(normIdxStart * (inputLen - 1)));
      const binEnd = Math.min(inputLen - 1, Math.max(binStart + 1, Math.ceil(normIdxEnd * (inputLen - 1))));

      // Compute root-mean-square average across the mapped frequency band
      let sum = 0;
      let count = 0;
      for (let b = binStart; b <= binEnd; b++) {
        sum += audioInput[b] * audioInput[b];
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sum / count) : 0;

      // Equal loudness weighting: boosts mids and balances sub-bass and high air
      const t = i / barCount;
      const eqWeight = 0.9 + 0.5 * Math.sin(t * Math.PI) + 0.85 * t;

      const rawVal = rms * eqWeight * gain;
      bars[i].targetHeight = Math.min(maxPxHeight, rawVal * maxPxHeight);
    }
  }

  // --- CAVA Physics & Kinetic Falloff Engine ---
  function updatePhysics() {
    // Attack rate (instant punch) vs Decay (gravity drop)
    const attackLerp = 0.72;
    // Smoothing factor: higher = slower decay, lower = snappy drop
    const decaySpeed = ((100 - config.smoothing) / 100) * 14 + 1.2;
    const peakHoldMax = 12; // Frames to hover at apex
    const peakGravity = config.peakDecay * 0.45;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];

      // Bar Height Physics
      if (b.targetHeight > b.currentHeight) {
        // Fast attack
        b.currentHeight += (b.targetHeight - b.currentHeight) * attackLerp;
      } else {
        // Smooth gravity drop
        b.currentHeight -= decaySpeed;
        if (b.currentHeight < 0) b.currentHeight = 0;
      }

      // Floating Peak Cap Physics
      if (b.currentHeight >= b.peakHeight) {
        b.peakHeight = b.currentHeight;
        b.peakHold = peakHoldMax;
        b.peakVelocity = 0;
      } else {
        if (b.peakHold > 0) {
          b.peakHold--;
        } else {
          b.peakVelocity += peakGravity;
          b.peakHeight -= b.peakVelocity;
          if (b.peakHeight < 0) b.peakHeight = 0;
        }
      }
    }
  }

  // --- Color Gradient Helper ---
  function getThemeColors() {
    if (config.themePreset === 7) {
      // Custom Gradient
      return {
        stops: [
          { pos: 0.0, color: config.primaryColor },
          { pos: 1.0, color: config.secondaryColor }
        ],
        peakColor: '#FFFFFF',
        glowColor: hexToRgba(config.primaryColor, 0.25),
        bg: config.backgroundColor
      };
    }

    if (config.themePreset === 6) {
      // Dynamic Rainbow
      return {
        isRainbow: true,
        peakColor: '#FFFFFF',
        glowColor: 'rgba(255, 0, 128, 0.2)',
        bg: '#050508'
      };
    }

    const presetIdx = Math.min(themes.length - 1, Math.max(0, config.themePreset));
    return themes[presetIdx];
  }

  function hexToRgba(hex, alpha) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function interpolateColor(color1, color2, factor) {
    const c1 = parseColor(color1);
    const c2 = parseColor(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function parseColor(str) {
    if (str.startsWith('#')) {
      let h = str.slice(1);
      if (h.length === 3) h = h.split('').map(x => x + x).join('');
      const val = parseInt(h, 16);
      return { r: (val >> 16) & 255, g: (val >> 8) & 255, b: val & 255 };
    }
    const match = str.match(/\d+/g);
    if (match && match.length >= 3) {
      return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
    }
    return { r: 255, g: 255, b: 255 };
  }

  function getBarSegmentColor(theme, ratio, barIndex, totalBars) {
    if (theme.isRainbow) {
      const hue = ((barIndex / totalBars) * 320 + ratio * 40) % 360;
      return `hsl(${hue}, 100%, ${50 + ratio * 20}%)`;
    }
    const stops = theme.stops;
    if (ratio <= stops[0].pos) return stops[0].color;
    if (ratio >= stops[stops.length - 1].pos) return stops[stops.length - 1].color;

    for (let i = 0; i < stops.length - 1; i++) {
      if (ratio >= stops[i].pos && ratio <= stops[i + 1].pos) {
        const localT = (ratio - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
        return interpolateColor(stops[i].color, stops[i + 1].color, localT);
      }
    }
    return stops[0].color;
  }

  // --- Rendering Loop ---
  function render() {
    const theme = getThemeColors();

    // Clear canvas: transparent for wallpaper mode, or solid fill for OLED mode
    if (config.bgMode === 0) {
      ctx.fillStyle = theme.bg || config.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    const barCount = bars.length;
    const spacing = config.barSpacing;
    const totalSpacing = spacing * (barCount + 1);
    const barWidth = Math.max(2, (width - totalSpacing) / barCount);
    const maxPxHeight = (height * config.maxHeight) / 100;

    // Segment size metrics for CAVA terminal blocks
    const segHeight = Math.max(3, Math.min(8, Math.round(barWidth * 0.75)));
    const segGap = Math.max(1, Math.round(segHeight * 0.35));
    const stepSize = segHeight + segGap;

    // Determine baseline Y coordinate based on Placement
    let baseY = height - 12;
    if (config.placement === 1) {
      baseY = height / 2; // Center Mirror
    } else if (config.placement === 2) {
      baseY = 12; // Top Ceiling
    }

    // Calculate total spectrum energy for ambient glow
    let totalEnergy = 0;

    for (let i = 0; i < barCount; i++) {
      const b = bars[i];
      const h = Math.min(maxPxHeight, Math.max(0, b.currentHeight));
      const peak = Math.min(maxPxHeight, Math.max(0, b.peakHeight));
      totalEnergy += h;

      const x = spacing + i * (barWidth + spacing);

      // --- Draw Bar ---
      if (config.barStyle === 0) {
        // === Style 0: Segmented Terminal Blocks (Classic CAVA) ===
        const numSegs = Math.floor(h / stepSize);

        for (let s = 0; s < numSegs; s++) {
          const segRatio = (s * stepSize) / maxPxHeight;
          ctx.fillStyle = getBarSegmentColor(theme, segRatio, i, barCount);

          if (config.placement === 0) {
            // Bottom anchored
            const y = baseY - (s + 1) * stepSize;
            drawRoundedRect(ctx, x, y, barWidth, segHeight, 1.5);
          } else if (config.placement === 1) {
            // Center Mirror
            const yUp = baseY - (s + 1) * (stepSize / 2);
            const yDown = baseY + s * (stepSize / 2);
            const halfSeg = Math.max(2, segHeight / 2);
            drawRoundedRect(ctx, x, yUp, barWidth, halfSeg, 1);
            drawRoundedRect(ctx, x, yDown, barWidth, halfSeg, 1);
          } else {
            // Top ceiling
            const y = baseY + s * stepSize;
            drawRoundedRect(ctx, x, y, barWidth, segHeight, 1.5);
          }
        }

        // Floating Peak Cap for Segmented Mode (Optimized: zero shadowBlur)
        if (config.showPeaks && peak > segHeight) {
          ctx.fillStyle = theme.peakColor;

          if (config.placement === 0) {
            const peakY = baseY - peak - segHeight;
            drawRoundedRect(ctx, x, peakY, barWidth, segHeight, 1.5);
          } else if (config.placement === 1) {
            const halfPeak = peak / 2;
            const halfSeg = Math.max(2, segHeight / 2);
            drawRoundedRect(ctx, x, baseY - halfPeak - halfSeg, barWidth, halfSeg, 1);
            drawRoundedRect(ctx, x, baseY + halfPeak, barWidth, halfSeg, 1);
          } else {
            const peakY = baseY + peak;
            drawRoundedRect(ctx, x, peakY, barWidth, segHeight, 1.5);
          }
        }

      } else if (config.barStyle === 1) {
        // === Style 1: Solid Continuous Bars ===
        const barGradient = createBarGradient(ctx, baseY, maxPxHeight, theme, i, barCount);
        ctx.fillStyle = barGradient;

        if (config.placement === 0) {
          drawRoundedRect(ctx, x, baseY - h, barWidth, h, 2);
        } else if (config.placement === 1) {
          drawRoundedRect(ctx, x, baseY - h / 2, barWidth, h, 2);
        } else {
          drawRoundedRect(ctx, x, baseY, barWidth, h, 2);
        }

        // Floating Peak Cap (Optimized: zero shadowBlur)
        if (config.showPeaks && peak > 4) {
          ctx.fillStyle = theme.peakColor;
          const capH = Math.max(2, Math.min(4, barWidth * 0.4));

          if (config.placement === 0) {
            drawRoundedRect(ctx, x, baseY - peak - capH - 2, barWidth, capH, 1);
          } else if (config.placement === 1) {
            const capHalf = capH / 2;
            drawRoundedRect(ctx, x, baseY - peak / 2 - capHalf - 2, barWidth, capHalf, 1);
            drawRoundedRect(ctx, x, baseY + peak / 2 + 2, barWidth, capHalf, 1);
          } else {
            drawRoundedRect(ctx, x, baseY + peak + 2, barWidth, capH, 1);
          }
        }

      } else if (config.barStyle === 2) {
        // === Style 2: Sleek Outlined Bars ===
        const outlineColor = getBarSegmentColor(theme, 0.7, i, barCount);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = hexToRgba(outlineColor, 0.15);

        if (config.placement === 0) {
          drawRoundedRect(ctx, x, baseY - h, barWidth, h, 2, true);
        } else if (config.placement === 1) {
          drawRoundedRect(ctx, x, baseY - h / 2, barWidth, h, 2, true);
        } else {
          drawRoundedRect(ctx, x, baseY, barWidth, h, 2, true);
        }

        if (config.showPeaks && peak > 4) {
          ctx.fillStyle = theme.peakColor;
          const capH = 3;
          if (config.placement === 0) {
            drawRoundedRect(ctx, x, baseY - peak - capH, barWidth, capH, 1);
          } else if (config.placement === 1) {
            drawRoundedRect(ctx, x, baseY - peak / 2 - capH, barWidth, capH, 1);
            drawRoundedRect(ctx, x, baseY + peak / 2, barWidth, capH, 1);
          } else {
            drawRoundedRect(ctx, x, baseY + peak, barWidth, capH, 1);
          }
        }
      }
    }

    // --- Dynamic Ambient Glow Update (Throttled for CPU/GPU efficiency) ---
    if (config.ambientGlow && ambientGlowEl) {
      const avgEnergyRatio = Math.min(1, totalEnergy / (barCount * maxPxHeight * 0.4));
      if (Math.abs(avgEnergyRatio - lastGlowEnergy) > 0.025) {
        lastGlowEnergy = avgEnergyRatio;
        ambientGlowEl.style.opacity = (0.2 + avgEnergyRatio * 0.35).toFixed(2);
      }
    }
  }

  function createBarGradient(context, base, maxH, theme, barIdx, totalBars) {
    let grad;
    if (config.placement === 0) {
      grad = context.createLinearGradient(0, base, 0, base - maxH);
    } else if (config.placement === 1) {
      grad = context.createLinearGradient(0, base - maxH / 2, 0, base + maxH / 2);
    } else {
      grad = context.createLinearGradient(0, base, 0, base + maxH);
    }

    if (theme.isRainbow) {
      const hue = (barIdx / totalBars) * 360;
      grad.addColorStop(0, `hsl(${hue}, 100%, 35%)`);
      grad.addColorStop(1, `hsl(${(hue + 45) % 360}, 100%, 65%)`);
      return grad;
    }

    for (const stop of theme.stops) {
      grad.addColorStop(stop.pos, stop.color);
    }
    return grad;
  }

  function drawRoundedRect(context, x, y, w, h, r, withStroke = false) {
    if (w <= 0 || h <= 0) return;
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.arcTo(x + w, y, x + w, y + radius, radius);
    context.lineTo(x + w, y + h - radius);
    context.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    context.lineTo(x + radius, y + h);
    context.arcTo(x, y + h, x, y + h - radius, radius);
    context.lineTo(x, y + radius);
    context.arcTo(x, y, x + radius, y, radius);
    context.closePath();
    context.fill();
    if (withStroke) {
      context.stroke();
    }
  }

  // --- Clock HUD Update Routine ---
  function updateClock() {
    if (!config.showClock) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (hudTimeEl) {
      hudTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    if (hudDateEl) {
      const options = { weekday: 'short', month: 'short', day: '2-digit' };
      hudDateEl.textContent = now.toLocaleDateString('en-US', options).toUpperCase();
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  function applyHUDPlacement() {
    if (!hudContainerEl) return;
    if (!config.showClock) {
      hudContainerEl.classList.add('is-hidden-element');
      return;
    }
    hudContainerEl.classList.remove('is-hidden-element');
    hudContainerEl.className = 'hud-container';
    switch (config.clockPosition) {
      case 0:
        hudContainerEl.classList.add('pos-top-right');
        break;
      case 1:
        hudContainerEl.classList.add('pos-top-center');
        break;
      case 2:
        hudContainerEl.classList.add('pos-top-left');
        break;
      case 3:
        hudContainerEl.classList.add('pos-center');
        break;
    }
  }

  // --- Performance HUD Display & Sparkline Rendering ---
  function drawSparkline(context, canvasEl, history, strokeColor, fillColor) {
    if (!context || !canvasEl) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    context.clearRect(0, 0, w, h);

    if (history.length < 2) return;

    const step = w / (history.length - 1);
    context.beginPath();
    context.moveTo(0, h - (history[0] / 100) * (h - 4) - 2);

    for (let i = 1; i < history.length; i++) {
      const x = i * step;
      const y = h - (history[i] / 100) * (h - 4) - 2;
      context.lineTo(x, y);
    }

    context.strokeStyle = strokeColor;
    context.lineWidth = 1.6;
    context.stroke();

    // Fill under sparkline curve with translucent neon gradient
    context.lineTo(w, h);
    context.lineTo(0, h);
    context.closePath();

    const grad = context.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = grad;
    context.fill();
  }

  function updatePerformanceUI(cpu, cpuName, ram, ramDetail, gpu, gpuName, net) {
    const c = Math.max(0, Math.min(100, cpu));
    const r = Math.max(0, Math.min(100, ram));
    const g = Math.max(0, Math.min(100, gpu));

    // Update history buffers for sparklines
    cpuHistory.push(c);
    cpuHistory.shift();
    ramHistory.push(r);
    ramHistory.shift();
    gpuHistory.push(g);
    gpuHistory.shift();

    // Update text & progress meters
    if (cpuPercentEl) cpuPercentEl.textContent = `${c.toFixed(1)}%`;
    if (cpuMeterEl) cpuMeterEl.style.width = `${c}%`;
    if (cpuNameEl && cpuName) cpuNameEl.textContent = cpuName;

    if (ramPercentEl) ramPercentEl.textContent = `${r.toFixed(1)}%`;
    if (ramMeterEl) ramMeterEl.style.width = `${r}%`;
    if (ramDetailEl && ramDetail) ramDetailEl.textContent = ramDetail;

    if (gpuPercentEl) gpuPercentEl.textContent = `${g.toFixed(1)}%`;
    if (gpuMeterEl) gpuMeterEl.style.width = `${g}%`;
    if (gpuNameEl && gpuName) gpuNameEl.textContent = gpuName;

    if (netSpeedEl && net) netSpeedEl.textContent = net;

    // Draw sparklines
    drawSparkline(cpuCtx, cpuCanvas, cpuHistory, '#00F2FE', 'rgba(0, 242, 254, 0.28)');
    drawSparkline(ramCtx, ramCanvas, ramHistory, '#00FF88', 'rgba(0, 255, 136, 0.28)');
    drawSparkline(gpuCtx, gpuCanvas, gpuHistory, '#FF007F', 'rgba(255, 0, 127, 0.28)');
  }

  function applyPerfPlacement() {
    if (!perfHUDEl) return;
    if (!config.showPerformance) {
      perfHUDEl.classList.add('is-hidden-element');
      return;
    }
    perfHUDEl.classList.remove('is-hidden-element');
    perfHUDEl.className = 'perf-hud';
    perfHUDEl.style.opacity = (config.perfOpacity / 100).toFixed(2);

    switch (config.perfPosition) {
      case 0:
        perfHUDEl.classList.add('pos-top-left');
        break;
      case 1:
        perfHUDEl.classList.add('pos-top-right');
        break;
      case 2:
        perfHUDEl.classList.add('pos-bottom-left');
        break;
      case 3:
        perfHUDEl.classList.add('pos-bottom-right');
        break;
    }
  }

  // --- Simulated Hardware Performance for Standalone Browser Preview ---
  let simCpuBase = 22;
  let simGpuBase = 14;
  let simRamBase = 54.2;

  function generateSimulatedPerf() {
    if (isLivelySysInfoActive && performance.now() - lastLivelySysInfoTime < 2500) {
      return; // Real system info from Lively Wallpaper is streaming!
    }

    const cpuJitter = (Math.random() - 0.48) * 8;
    const cpuSpike = Math.random() > 0.85 ? Math.random() * 25 : 0;
    simCpuBase = Math.max(8, Math.min(88, simCpuBase + cpuJitter + cpuSpike * 0.2));

    const gpuJitter = (Math.random() - 0.48) * 6;
    simGpuBase = Math.max(5, Math.min(65, simGpuBase + gpuJitter));

    simRamBase = Math.max(48, Math.min(65, simRamBase + (Math.random() - 0.5) * 0.4));

    const downSpeed = (Math.random() * 2.8).toFixed(1);
    const upSpeed = (Math.random() * 450).toFixed(0);

    updatePerformanceUI(
      simCpuBase,
      'Intel / AMD Multi-Core CPU',
      simRamBase,
      `${(simRamBase * 0.32).toFixed(1)} / 32.0 GB`,
      simGpuBase,
      'DirectX 3D Graphics Engine',
      `↓ ${downSpeed} MB/s  ↑ ${upSpeed} KB/s`
    );
  }

  setInterval(generateSimulatedPerf, 1000);
  generateSimulatedPerf();

  // --- Touhou Arcane Spell Circle Engine & Now Playing ---
  const TOUHOU_RUNES = ['✦', 'ᛉ', 'ᛟ', 'ᚱ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛝ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', '✦', '✧', '✡', '★', '❂', '✹', '☯'];

  function drawTouhouMagicCircle(context, canvasEl, angle, bassEnergy, theme) {
    if (!context || !canvasEl || !config.showMagicCircle) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    context.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    // Base radius scales with config.circleSize and pulses with audio bass transients
    const sizeScale = (config.circleSize || 280) / 280;
    const baseR = (Math.min(w, h) * 0.43) * sizeScale;
    const pulseR = baseR * (1.0 + bassEnergy * 0.12);

    const primaryCol = theme.stops ? theme.stops[0].color : '#00F2FE';
    const secondaryCol = theme.stops ? theme.stops[theme.stops.length - 1].color : '#FF007F';

    context.save();
    context.translate(cx, cy);

    // --- Layer 1: Outermost Celestial Orbit & Cardinal Ticks (Clockwise) ---
    context.save();
    context.rotate(angle * 0.75);

    context.strokeStyle = primaryCol;
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(0, 0, pulseR, 0, Math.PI * 2);
    context.stroke();

    // Concentric fine boundary circle
    context.lineWidth = 1.0;
    context.beginPath();
    context.arc(0, 0, pulseR * 0.94, 0, Math.PI * 2);
    context.stroke();

    // 12 Cardinal and Celestial Ticks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x1 = Math.cos(a) * (pulseR * 0.94);
      const y1 = Math.sin(a) * (pulseR * 0.94);
      const x2 = Math.cos(a) * pulseR;
      const y2 = Math.sin(a) * pulseR;

      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();

      // Outer diamond markers
      if (i % 3 === 0) {
        const x3 = Math.cos(a) * (pulseR * 1.03);
        const y3 = Math.sin(a) * (pulseR * 1.03);
        context.fillStyle = secondaryCol;
        context.beginPath();
        context.arc(x3, y3, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();

    // --- Layer 2: Arcane Rune Inscription Ring (Counter-Clockwise) ---
    context.save();
    context.rotate(-angle * 1.15);

    const runeR = pulseR * 0.84;
    context.strokeStyle = secondaryCol;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(0, 0, runeR, 0, Math.PI * 2);
    context.stroke();

    // Dashed guide orbit
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(0, 0, pulseR * 0.74, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);

    // Draw Inscribed Touhou Runes
    const runeCount = 16;
    context.fillStyle = '#FFFFFF';
    context.font = '11px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let i = 0; i < runeCount; i++) {
      const a = (i / runeCount) * Math.PI * 2;
      const glyph = TOUHOU_RUNES[i % TOUHOU_RUNES.length];
      context.save();
      context.rotate(a);
      context.translate(0, -(pulseR * 0.79));
      context.fillText(glyph, 0, 0);
      context.restore();
    }
    context.restore();

    // --- Layer 3: Sacred Geometry Star Array (Patchouli / Marisa Hexagram) ---
    context.save();
    context.rotate(angle * 1.55);

    const starR = pulseR * 0.71;
    context.strokeStyle = primaryCol;
    context.lineWidth = 1.4;

    // Hexagram: Two Interlocking Triangles
    for (let t = 0; t < 2; t++) {
      const offset = (t * Math.PI) / 3;
      context.beginPath();
      for (let pt = 0; pt < 3; pt++) {
        const a = offset + (pt / 3) * Math.PI * 2;
        const sx = Math.cos(a) * starR;
        const sy = Math.sin(a) * starR;
        if (pt === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      }
      context.closePath();
      context.stroke();
    }

    // Vertex Nodes (Glowing circles at 6 star points)
    for (let pt = 0; pt < 6; pt++) {
      const a = (pt / 6) * Math.PI * 2;
      const vx = Math.cos(a) * starR;
      const vy = Math.sin(a) * starR;
      context.fillStyle = secondaryCol;
      context.beginPath();
      context.arc(vx, vy, 3, 0, Math.PI * 2);
      context.fill();

      // Outer vertex halo
      context.strokeStyle = primaryCol;
      context.lineWidth = 0.8;
      context.beginPath();
      context.arc(vx, vy, 6, 0, Math.PI * 2);
      context.stroke();
    }

    // Mid-Star boundary ring
    context.strokeStyle = secondaryCol;
    context.lineWidth = 1.0;
    context.beginPath();
    context.arc(0, 0, starR * 0.62, 0, Math.PI * 2);
    context.stroke();

    context.restore();

    // --- Layer 4: Inner Elemental Orbit Arc (Counter-Clockwise) ---
    context.save();
    context.rotate(-angle * 2.1);

    const innerR = pulseR * 0.46;
    context.strokeStyle = primaryCol;
    context.lineWidth = 1.4;

    for (let q = 0; q < 4; q++) {
      const startA = (q / 4) * Math.PI * 2 + 0.16;
      const endA = ((q + 1) / 4) * Math.PI * 2 - 0.16;
      context.beginPath();
      context.arc(0, 0, innerR, startA, endA);
      context.stroke();

      const midA = (q / 4) * Math.PI * 2;
      const ox = Math.cos(midA) * (innerR * 0.85);
      const oy = Math.sin(midA) * (innerR * 0.85);
      context.fillStyle = '#FFFFFF';
      context.beginPath();
      context.arc(ox, oy, 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    // --- Layer 5: Floating Danmaku Mana Particle Sparks ---
    for (let i = 0; i < magicParticles.length; i++) {
      const p = magicParticles[i];
      p.angle += p.speed * (1.0 + bassEnergy * 0.8);
      const px = Math.cos(p.angle) * (pulseR * p.distRatio);
      const py = Math.sin(p.angle) * (pulseR * p.distRatio);

      context.fillStyle = i % 2 === 0 ? primaryCol : secondaryCol;
      context.globalAlpha = p.alpha;
      context.beginPath();
      context.arc(px, py, p.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1.0;

    context.restore();
  }

  function updateTrackUI(title, artist, thumbnailBase64) {
    if (trackTitleEl) {
      trackTitleEl.textContent = title || 'Bad Apple!! feat. nomico';
    }
    if (trackArtistEl) {
      trackArtistEl.textContent = artist || 'Alstroemeria Records (Touhou 4)';
    }

    if (thumbnailBase64 && magicAlbumArtEl) {
      const src = thumbnailBase64.startsWith('data:')
        ? thumbnailBase64
        : `data:image/jpeg;base64,${thumbnailBase64}`;
      magicAlbumArtEl.src = src;
      magicAlbumArtEl.classList.remove('is-hidden');
      if (magicDefaultCoreEl) magicDefaultCoreEl.classList.add('is-hidden');
    } else {
      if (magicAlbumArtEl) magicAlbumArtEl.classList.add('is-hidden');
      if (magicDefaultCoreEl) magicDefaultCoreEl.classList.remove('is-hidden');
    }
  }

  function applyMagicCircleSettings() {
    if (!magicCircleWrapEl) return;
    magicCircleWrapEl.style.display = config.showMagicCircle ? 'flex' : 'none';
    if (nowPlayingCardEl) {
      nowPlayingCardEl.style.display = config.showNowPlaying ? 'block' : 'none';
    }

    const stage = document.querySelector('.magic-circle-stage');
    if (stage) {
      const sz = Math.max(180, config.circleSize);
      stage.style.width = `${sz}px`;
      stage.style.height = `${sz}px`;
      if (magicCanvas) {
        magicCanvas.style.width = `${sz}px`;
        magicCanvas.style.height = `${sz}px`;
      }
      if (magicCoreEl) {
        const coreSz = Math.round(sz * 0.28);
        magicCoreEl.style.width = `${coreSz}px`;
        magicCoreEl.style.height = `${coreSz}px`;
      }
    }
  }

  // Initial track display
  updateTrackUI('Bad Apple!! feat. nomico', 'Alstroemeria Records (Touhou 4)', null);

  // --- Custom Wallpaper Background Handler ---
  function normalizeWallpaperPath(val) {
    if (!val || val === 'none') return '';
    let str = String(val).trim();

    // If it's already a data URL, blob, or absolute web URL
    if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }

    // Convert all Windows backslashes to forward slashes
    str = str.replace(/\\/g, '/');

    // If it contains "backgrounds/", take everything starting from "backgrounds/"
    const bgIdx = str.toLowerCase().indexOf('backgrounds/');
    if (bgIdx !== -1) {
      str = str.substring(bgIdx);
    } else {
      str = 'backgrounds/' + str.replace(/^\.?\//, '');
    }

    return str;
  }

  function applyBackgroundSettings() {
    if (!customBgEl || !bgOverlayEl) return;

    if (config.bgMode === 0) {
      // Pure OLED Dark Mode
      customBgEl.style.display = 'none';
      bgOverlayEl.style.display = 'none';
      if (bgImgEl) bgImgEl.style.display = 'none';
      document.body.style.backgroundColor = config.backgroundColor || '#050508';
    } else {
      // Custom Wallpaper Image or Dynamic Dim Mode
      customBgEl.style.display = 'block';
      bgOverlayEl.style.display = 'block';

      const normPath = normalizeWallpaperPath(config.bgImage);
      if (normPath) {
        const encoded = encodeURI(normPath);
        customBgEl.style.backgroundImage = `url("${encoded}")`;

        if (bgImgEl) {
          bgImgEl.style.display = 'block';
          bgImgEl.onerror = () => {
            console.warn('Path failed:', normPath, 'Trying bare filename...');
            const fallback = normPath.split('/').pop();
            if (fallback && fallback !== normPath) {
              bgImgEl.src = encodeURI(fallback);
              customBgEl.style.backgroundImage = `url("${encodeURI(fallback)}")`;
            }
          };
          bgImgEl.src = encoded;
        }
      } else {
        if (bgImgEl) bgImgEl.style.display = 'none';
        customBgEl.style.backgroundImage = 'none';
      }

      const brightness = Math.max(10, Math.min(100, config.bgBrightness !== undefined ? config.bgBrightness : 60)) / 100;
      const blur = Math.max(0, Math.min(30, config.bgBlur !== undefined ? config.bgBlur : 0));
      customBgEl.style.filter = `brightness(${brightness}) blur(${blur}px)`;
    }
  }

  // Allow User to Drag & Drop Any Image Directly onto the Wallpaper / Browser Window
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (customBgEl) {
            customBgEl.style.backgroundImage = `url("${event.target.result}")`;
            config.bgMode = 1;
            applyBackgroundSettings();
          }
        };
        reader.readAsDataURL(file);
      }
    }
  });

  // --- Procedural Synthwave Demo Audio Generator ---
  /**
   * Automatically activates when running standalone in Chrome/Edge/Firefox
   * or when Lively Wallpaper audio has not started yet.
   */
  function generateDemoAudio() {
    demoPhase += 0.04;
    const beat = Math.pow(Math.max(0, Math.sin(demoPhase * 1.8)), 3); // Kick drum pulse
    const snare = Math.pow(Math.max(0, Math.sin(demoPhase * 0.9 + Math.PI / 2)), 8); // Snare snap
    const bass = 0.5 + 0.5 * Math.sin(demoPhase * 3.6); // Bass groove

    for (let i = 0; i < RAW_FFT_SIZE; i++) {
      const freqNorm = i / RAW_FFT_SIZE;
      let val = 0;

      // Sub-bass & Bass region (bins 0 - 15)
      if (i < 16) {
        val = beat * (1.0 - i / 16) + bass * 0.45;
      }
      // Mid-range melodies (bins 16 - 60)
      else if (i < 60) {
        const wave = Math.sin(demoPhase * 2.5 + i * 0.25);
        val = (0.35 + 0.35 * wave) * (snare * 0.6 + 0.4);
      }
      // Highs & Air (bins 60 - 127)
      else {
        const noise = Math.random() * 0.35;
        val = noise * (beat * 0.5 + snare * 0.5 + 0.2);
      }

      // Smooth falloff towards extreme highs
      val *= Math.max(0, 1.0 - Math.pow(freqNorm, 2));
      rawAudioData[i] = Math.min(1.0, Math.max(0, val));
    }
  }

  // --- Microphone Capture for Standalone Testing ---
  async function initMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 256; // Gives 128 frequency bins
      micAnalyser.smoothingTimeConstant = 0.6;
      source.connect(micAnalyser);
      micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      isMicActive = true;

      if (micBtn) {
        micBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#00FF88">
            <circle cx="12" cy="12" r="8"/>
          </svg>
          Mic Active
        `;
        micBtn.style.borderColor = '#00FF88';
      }
      if (standaloneStatusTextEl) {
        standaloneStatusTextEl.textContent = 'LIVE MIC INPUT ACTIVE';
      }
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      alert('Microphone access was denied. Continuing in synthetic demo mode.');
    }
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (!isMicActive) {
        initMicrophone();
      }
    });
  }

  // --- Main Animation Frame Loop ---
  function animate(timestamp) {
    requestAnimationFrame(animate);

    // Frame rate pacing & capping (drastically reduces GPU load on 144Hz+ monitors)
    if (targetFps > 0 && timestamp) {
      const elapsed = timestamp - lastFrameTime;
      if (elapsed < frameInterval - 1.5) {
        return; // Skip rendering this frame
      }
      lastFrameTime = timestamp - (elapsed % frameInterval);
    }

    const now = performance.now();

    // FPS calculation
    frameCount++;
    if (now - lastFpsUpdateTime >= 600) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      if (perfFpsEl) {
        perfFpsEl.textContent = `${currentFps} FPS`;
      }
      frameCount = 0;
      lastFpsUpdateTime = now;
    }

    const isReceivingLivelyAudio = now - lastLivelyAudioTime < 600;

    if (isReceivingLivelyAudio) {
      if (!isLivelyActive) {
        isLivelyActive = true;
        if (standaloneControlsEl) {
          standaloneControlsEl.classList.add('is-hidden');
        }
      }
      // Process livelyAudioData already populated in livelyAudioListener
      processAudioFrequencies(rawAudioData);
    } else if (isMicActive && micAnalyser && micDataArray) {
      micAnalyser.getByteFrequencyData(micDataArray);
      for (let i = 0; i < RAW_FFT_SIZE; i++) {
        rawAudioData[i] = micDataArray[i] / 255.0;
      }
      processAudioFrequencies(rawAudioData);
    } else {
      // Standalone Synthetic Demo Mode
      generateDemoAudio();
      processAudioFrequencies(rawAudioData);
    }

    updatePhysics();
    render();

    // Calculate Bass Energy for Touhou Magic Circle reactivity
    const maxPxH = (height * config.maxHeight) / 100;
    let bassEnergy = 0;
    if (bars.length >= 4 && maxPxH > 0) {
      bassEnergy = (bars[0].currentHeight + bars[1].currentHeight + bars[2].currentHeight) / (3 * maxPxH);
      bassEnergy = Math.min(1.0, Math.max(0, bassEnergy));
    }

    // Advance Touhou Magic Circle rotation angle
    const baseRot = 0.006 + ((config.circleSpeed || 4) / 10) * 0.015;
    magicRotationAngle += baseRot + bassEnergy * 0.024;

    const activeTheme = getThemeColors();
    drawTouhouMagicCircle(magicCtx, magicCanvas, magicRotationAngle, bassEnergy, activeTheme);
  }

  // --- Lively Wallpaper API Integration ---

  /**
   * System audio stream injected by Lively Wallpaper
   * @param {Array<number>} audioArray - 128 float values (frequency spectrum)
   */
  window.livelyAudioListener = function (audioArray) {
    lastLivelyAudioTime = performance.now();
    if (!audioArray || !audioArray.length) return;

    for (let i = 0; i < Math.min(RAW_FFT_SIZE, audioArray.length); i++) {
      rawAudioData[i] = audioArray[i];
    }
  };

  /**
   * Real-time hardware system information injected by Lively Wallpaper
   * @param {string|object} data - Serialized JSON with CPU, GPU, RAM, and Network metrics
   */
  window.livelySystemInformation = function (data) {
    lastLivelySysInfoTime = performance.now();
    isLivelySysInfoActive = true;
    try {
      const sys = typeof data === 'string' ? JSON.parse(data) : data;
      const cpu = typeof sys.CurrentCpu === 'number' ? sys.CurrentCpu : 0;
      const gpu = typeof sys.CurrentGpu3D === 'number' ? sys.CurrentGpu3D : 0;

      let ramPct = 0;
      let ramText = '';
      if (sys.TotalRam && sys.CurrentRamAvail !== undefined) {
        const totalGB = (sys.TotalRam / 1024).toFixed(1);
        const usedMB = sys.TotalRam - sys.CurrentRamAvail;
        const usedGB = (usedMB / 1024).toFixed(1);
        ramPct = (usedMB / sys.TotalRam) * 100;
        ramText = `${usedGB} / ${totalGB} GB`;
      }

      let netText = 'NET: 0.0 KB/s';
      if (sys.CurrentNetDown !== undefined) {
        const downKB = (sys.CurrentNetDown / 1024).toFixed(0);
        const upKB = ((sys.CurrentNetUp || 0) / 1024).toFixed(0);
        netText = `↓ ${downKB} KB/s  ↑ ${upKB} KB/s`;
      }

      updatePerformanceUI(
        cpu,
        sys.NameCpu || 'System CPU',
        ramPct,
        ramText || 'Memory',
        gpu,
        sys.NameGpu || 'Graphics Engine',
        netText
      );
    } catch (e) {
      console.warn('Error parsing livelySystemInformation:', e);
    }
  };

  /**
   * Real-time Media track information injected by Lively Wallpaper
   * @param {string|object} data - Serialized JSON with Title, Artist, AlbumTitle, Thumbnail (Base64)
   */
  window.livelyCurrentTrack = function (data) {
    lastTrackUpdateTime = performance.now();
    isTrackActive = true;
    if (!data) return;

    try {
      const track = typeof data === 'string' ? JSON.parse(data) : data;
      if (track) {
        updateTrackUI(track.Title, track.Artist, track.Thumbnail);
      }
    } catch (e) {
      console.warn('Error parsing livelyCurrentTrack:', e);
    }
  };

  /**
   * Property change listener called by Lively Wallpaper Customize menu
   * @param {string} name - Property identifier matching LivelyProperties.json
   * @param {any} val - New value chosen by user
   */
  window.livelyPropertyListener = function (name, val) {
    switch (name) {
      case 'themePreset':
        config.themePreset = parseInt(val, 10);
        break;
      case 'primaryColor':
        config.primaryColor = val;
        break;
      case 'secondaryColor':
        config.secondaryColor = val;
        break;
      case 'backgroundColor':
        config.backgroundColor = val;
        break;
      case 'barStyle':
        config.barStyle = parseInt(val, 10);
        break;
      case 'barCount':
        config.barCount = parseInt(val, 10);
        initBars();
        break;
      case 'barSpacing':
        config.barSpacing = parseInt(val, 10);
        break;
      case 'placement':
        config.placement = parseInt(val, 10);
        break;
      case 'maxHeight':
        config.maxHeight = parseInt(val, 10);
        break;
      case 'sensitivity':
        config.sensitivity = parseInt(val, 10);
        break;
      case 'smoothing':
        config.smoothing = parseInt(val, 10);
        break;
      case 'showPeaks':
        config.showPeaks = Boolean(val);
        break;
      case 'peakDecay':
        config.peakDecay = parseInt(val, 10);
        break;
      case 'ambientGlow':
        config.ambientGlow = Boolean(val);
        if (ambientGlowEl) {
          ambientGlowEl.style.display = config.ambientGlow ? 'block' : 'none';
        }
        break;
      case 'showClock':
        config.showClock = Boolean(val);
        applyHUDPlacement();
        break;
      case 'clockPosition':
        config.clockPosition = parseInt(val, 10);
        applyHUDPlacement();
        break;
      case 'showPerformance':
        config.showPerformance = Boolean(val);
        applyPerfPlacement();
        break;
      case 'perfPosition':
        config.perfPosition = parseInt(val, 10);
        applyPerfPlacement();
        break;
      case 'perfOpacity':
        config.perfOpacity = parseInt(val, 10);
        applyPerfPlacement();
        break;
      case 'showMagicCircle':
        config.showMagicCircle = Boolean(val);
        applyMagicCircleSettings();
        break;
      case 'circleSize':
        config.circleSize = parseInt(val, 10);
        applyMagicCircleSettings();
        break;
      case 'circleSpeed':
        config.circleSpeed = parseInt(val, 10);
        break;
      case 'showNowPlaying':
        config.showNowPlaying = Boolean(val);
        applyMagicCircleSettings();
        break;
      case 'bgMode':
        if (typeof val === 'number') {
          config.bgMode = val;
        } else if (!isNaN(parseInt(val, 10))) {
          config.bgMode = parseInt(val, 10);
        } else if (typeof val === 'string') {
          if (val.includes('Pure') || val.includes('OLED')) config.bgMode = 0;
          else if (val.includes('Dynamic') || val.includes('Reactive')) config.bgMode = 2;
          else config.bgMode = 1;
        }
        applyBackgroundSettings();
        break;
      case 'bgImage':
        console.log('Lively bgImage received:', val);
        config.bgImage = val;
        applyBackgroundSettings();
        break;
      case 'bgBrightness':
        config.bgBrightness = parseInt(val, 10);
        applyBackgroundSettings();
        break;
      case 'bgBlur':
        config.bgBlur = parseInt(val, 10);
        applyBackgroundSettings();
        break;
      case 'targetFps':
        const fpsMap = [60, 30, 45, 0]; // 0: 60 FPS, 1: 30 FPS, 2: 45 FPS, 3: Uncapped
        targetFps = fpsMap[val] !== undefined ? fpsMap[val] : 60;
        frameInterval = targetFps > 0 ? 1000 / targetFps : 0;
        break;
      default:
        console.log('Lively Property:', name, val);
        break;
    }
  };

  // --- Kickoff ---
  resize();
  applyBackgroundSettings();
  applyHUDPlacement();
  applyPerfPlacement();
  applyMagicCircleSettings();
  requestAnimationFrame(animate);

})();
