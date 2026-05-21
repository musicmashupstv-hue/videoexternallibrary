// =======================
// worker.js – Video Library Service Worker (with Video.js + Health Check)
// Supports: HLS, DASH, MP4, MOV, MKV, iframe embeds
// Automatically intercepts video URLs and wraps them in a Video.js player
// Health check endpoint: /video-library-health or /health
// =======================

const CACHE_NAME = 'video-lib-v3';
const ACTIVATION_MSG = '✅ Video Library is activated';

// -------------------------------------------------------------------
// Health check path (customizable)
// -------------------------------------------------------------------
const HEALTH_PATH = '/video-library-health';
const ALT_HEALTH_PATH = '/health';

// -------------------------------------------------------------------
// Detect media type from URL
// -------------------------------------------------------------------
function getMediaType(url) {
  const path = url.pathname || '';
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  if (path.endsWith('.mp4')) return 'native';
  if (path.endsWith('.mov')) return 'native';
  if (path.endsWith('.mkv')) return 'mkv';
  if (url.searchParams?.get('m3u8')) return 'hls';
  if (url.searchParams?.get('mpd')) return 'dash';
  return null;
}

// -------------------------------------------------------------------
// Generate the Video.js player page for a given video URL
// -------------------------------------------------------------------
function getPlayerPage(videoUrl, mediaType) {
  const safeUrl = JSON.stringify(videoUrl);

  // For MKV we use native fallback (browsers rarely support MKV)
  if (mediaType === 'mkv') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Library - MKV Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: system-ui; }
    .player-container { width: 90vw; max-width: 1280px; background: #000; border-radius: 20px; overflow: hidden; }
    video { width: 100%; height: auto; display: block; }
    .info { padding: 1rem; background: #1e1e1e; color: #ccc; text-align: center; }
    .badge { position: fixed; bottom: 16px; right: 16px; background: #2c3e66; color: white; padding: 8px 16px; border-radius: 40px; font-size: 12px; font-family: monospace; z-index: 9999; pointer-events: none; }
  </style>
</head>
<body>
<div class="player-container">
  <video id="video" controls autoplay playsinline>
    <source src=${safeUrl} type="video/x-matroska">
    <p>Your browser does not support MKV playback. <a href=${safeUrl}>Download file</a></p>
  </video>
  <div class="info">🎬 MKV file – native fallback (download available)</div>
</div>
<div class="badge">🎬 Video Library is activated</div>
</body>
</html>`;
  }

  // For all other formats (HLS, DASH, MP4, MOV) – use Video.js with appropriate tech
  let sourceType = "";
  if (mediaType === 'hls') {
    sourceType = 'application/x-mpegURL';
  } else if (mediaType === 'dash') {
    sourceType = 'application/dash+xml';
  } else {
    sourceType = (videoUrl.endsWith('.mov')) ? 'video/quicktime' : 'video/mp4';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>Unified Video Library – Video.js Player</title>
  <!-- Video.js core CSS -->
  <link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
  <!-- Video.js core JS -->
  <script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
  <!-- Plugins for HLS and DASH -->
  <script src="https://cdn.jsdelivr.net/npm/videojs-contrib-hls@5.15.0/dist/videojs-contrib-hls.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/videojs-contrib-dash@5.1.1/dist/videojs-dash.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .player-wrapper {
      width: 90vw;
      max-width: 1280px;
      background: #000;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .video-js {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
    }
    .info {
      padding: 0.8rem;
      background: #1e1e1e;
      color: #ccc;
      text-align: center;
      font-size: 0.85rem;
      border-top: 1px solid #333;
    }
    .badge {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: #2c3e66;
      color: white;
      padding: 8px 16px;
      border-radius: 40px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 9999;
      font-family: monospace;
      pointer-events: none;
    }
    a { color: #8ab3ff; }
    .controls-note { margin-top: 5px; font-size: 0.7rem; color: #888; }
  </style>
</head>
<body>
<div class="player-wrapper">
  <video id="universal-player" class="video-js vjs-big-play-centered" controls autoplay preload="auto" playsinline>
    <source src=${safeUrl} type="${sourceType}">
    <p class="vjs-no-js">To view this video please enable JavaScript, and consider upgrading to a web browser that supports HTML5 video.</p>
  </video>
  <div class="info">
    🎥 <strong>Unified Video Library</strong> – Playing ${mediaType.toUpperCase()} source<br>
    Powered by Video.js • HLS/DASH native support • Smooth controls & theming
    <div class="controls-note">✔️ Fullscreen, quality (if available), captions • Works in iframe</div>
  </div>
</div>
<div class="badge">🎬 Video Library is activated</div>

<script>
  (function() {
    var player = videojs('universal-player', {
      techOrder: ['html5'],
      html5: {
        nativeAudioTracks: false,
        nativeVideoTracks: false,
        hls: { overrideNative: true }
      },
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          'playToggle', 'volumePanel', 'currentTimeDisplay', 'timeDivider',
          'durationDisplay', 'progressControl', 'liveDisplay', 'seekToLive',
          'remainingTimeDisplay', 'playbackRateMenuButton', 'chaptersButton',
          'descriptionsButton', 'subtitlesButton', 'captionsButton',
          'audioTrackButton', 'fullscreenToggle'
        ]
      }
    });

    if (${mediaType === 'hls' ? 'true' : 'false'}) {
      player.src({ src: ${safeUrl}, type: 'application/x-mpegURL' });
    } else if (${mediaType === 'dash' ? 'true' : 'false'}) {
      player.src({ src: ${safeUrl}, type: 'application/dash+xml' });
    }

    console.log("${ACTIVATION_MSG} - Video.js player ready");
  })();
</script>
</body>
</html>`;
}

// -------------------------------------------------------------------
// Health check response
// -------------------------------------------------------------------
function healthCheckResponse() {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      version: '3.0',
      message: ACTIVATION_MSG,
      timestamp: Date.now(),
      endpoints: {
        videoInterception: 'All supported video formats (.mp4, .mov, .mkv, .m3u8, .mpd)',
        playerEngine: 'Video.js 8.10.0 + HLS/DASH plugins',
        healthCheck: 'GET /video-library-health or /health'
      }
    }, null, 2),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// -------------------------------------------------------------------
// Service Worker Lifecycle
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log(ACTIVATION_MSG);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('⚡ Video Library SW activated');
  event.waitUntil(clients.claim());
  (async () => {
    const clientsList = await clients.matchAll({ type: 'window' });
    clientsList.forEach(client => {
      client.postMessage({ type: 'VIDEO_LIB_ACTIVATED', message: ACTIVATION_MSG });
    });
  })();
});

// -------------------------------------------------------------------
// Fetch Interceptor – Health check OR video interception
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // --- Health check endpoints ---
  if (url.pathname === HEALTH_PATH || url.pathname === ALT_HEALTH_PATH) {
    event.respondWith(healthCheckResponse());
    return;
  }

  // --- Video interception ---
  const mediaType = getMediaType(url);
  if (mediaType && event.request.method === 'GET') {
    const htmlResponse = new Response(getPlayerPage(event.request.url, mediaType), {
      headers: { 'Content-Type': 'text/html' }
    });
    event.respondWith(htmlResponse);
    return;
  }

  // --- Everything else: normal fetch ---
  event.respondWith(fetch(event.request));
});

// -------------------------------------------------------------------
// Message listener for status requests
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_STATUS') {
    event.source.postMessage({ status: 'active', message: ACTIVATION_MSG, version: '3.0' });
  }
});
