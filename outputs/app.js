const $ = (selector) => document.querySelector(selector);
const views = Array.from(document.querySelectorAll('.view'));
const pipeline = $('#pipeline');
const dnaTerminal = $('#dnaTerminal');
const binaryRain = $('#binaryRain');
const fileInput = $('#fileInput');
const fileLabel = $('#fileLabel');
const dropzone = $('#dropzone');
const restorePanel = $('#restorePanel');
const state = { file: null, archive: null, objectUrl: null };
const steps = ['Receiving File...', 'Reading File...', 'Converting to Binary...', 'Encoding into DNA...', 'Generating DNA ID...'];

function showView(id) {
  views.forEach(function(view) { view.classList.toggle('active', view.id === id); });
  if (id === 'retrieve' && state.archive) $('#dnaIdInput').value = state.archive.id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-route]').forEach(function(button) {
  button.addEventListener('click', function() {
    var route = button.dataset.route;
    if (route === 'home') resetHome();
    showView(route);
  });
});

function resetHome() {
  restorePanel.hidden = true;
  $('#retrieveForm').reset();
  dnaTerminal.textContent = 'awaiting molecular encoder...';
  buildPipeline();
}

fileInput.addEventListener('change', function() {
  state.file = fileInput.files[0] || null;
  fileLabel.textContent = state.file ? state.file.name : 'Choose File or drag it here';
});

['dragenter', 'dragover'].forEach(function(eventName) {
  dropzone.addEventListener(eventName, function(event) {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
});
['dragleave', 'drop'].forEach(function(eventName) {
  dropzone.addEventListener(eventName, function() { dropzone.classList.remove('dragging'); });
});
dropzone.addEventListener('drop', function(event) {
  event.preventDefault();
  var file = event.dataTransfer.files[0];
  if (!file) return;
  state.file = file;
  try {
    var transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
  } catch (error) {}
  fileLabel.textContent = file.name;
});

$('#uploadForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  var file = state.file || createDemoFile();
  state.file = file;
  fileLabel.textContent = file.name;
  state.archive = await createArchive(file);
  showView('processing');
  runPipeline();
});

function createDemoFile() {
  return new File(['BioVault molecular archive demonstration\nA compact simulated payload for DNA encoding.'], 'biovault-sample.txt', { type: 'text/plain' });
}

async function createArchive(file) {
  var buffer = await file.arrayBuffer();
  var bytes = new Uint8Array(buffer);
  var fallback = new TextEncoder().encode(file.name + ':' + file.size);
  var source = bytes.length ? bytes : fallback;
  var binaryBits = Math.max(8, source.length * 8);
  var dna = bytesToDna(source, 900);
  var id = makeDnaId(source, file.name);
  return { id: id, fileName: file.name, fileSize: file.size, fileType: file.type || 'application/octet-stream', binaryBits: binaryBits, dnaBases: Math.ceil(binaryBits / 2), dna: dna, preview: formatDna(dna.slice(0, 300)) };
}

function bytesToDna(bytes, limit) {
  var map = ['A', 'T', 'C', 'G'];
  var out = '';
  for (var i = 0; out.length < limit; i += 1) {
    var value = bytes[i % bytes.length] ^ ((i * 37) & 255);
    out += map[(value >> 6) & 3] + map[(value >> 4) & 3] + map[(value >> 2) & 3] + map[value & 3];
  }
  return out.slice(0, limit);
}

function makeDnaId(bytes, name) {
  var hash = 2166136261;
  for (var i = 0; i < name.length; i += 1) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  var stride = Math.max(1, Math.floor(bytes.length / 160));
  for (var j = 0; j < bytes.length; j += stride) hash = Math.imul(hash ^ bytes[j], 16777619);
  return 'DNA-' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function formatDna(sequence) { return sequence.match(/.{1,50}/g).join('\n'); }

function buildPipeline() {
  pipeline.innerHTML = steps.map(function(label, index) {
    return '<article class="stage" data-step="' + index + '"><div class="stage-index">' + (index + 1) + '</div><div><h3>' + label + '</h3><div class="progress-track"><div class="progress-fill"></div></div></div><div class="check" aria-label="Pending"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></div></article>';
  }).join('');
}

async function runPipeline() {
  buildPipeline();
  dnaTerminal.textContent = 'initializing BioVault encoder...';
  binaryRain.classList.remove('active');
  var dnaTypeInterval = null;
  for (var i = 0; i < steps.length; i += 1) {
    if (i === 2) startBinaryRain();
    if (i === 3) dnaTypeInterval = startDnaTerminal();
    if (i === 4) dnaTerminal.textContent += '\n\nDNA ID handshake: ' + state.archive.id;
    await animateStage(i, i === 3 ? 1750 : 1100);
  }
  if (dnaTypeInterval) clearInterval(dnaTypeInterval);
  binaryRain.classList.remove('active');
  dnaTerminal.textContent += '\n\nArchive Complete';
  await wait(900);
  renderReport();
  showView('result');
}

function animateStage(index, duration) {
  return new Promise(function(resolve) {
    var stage = pipeline.querySelector('[data-step="' + index + '"]');
    var fill = stage.querySelector('.progress-fill');
    var check = stage.querySelector('.check');
    var start = performance.now();
    function tick(now) {
      var progress = Math.min(1, (now - start) / duration);
      fill.style.width = Math.round(progress * 100) + '%';
      if (progress < 1) requestAnimationFrame(tick);
      else { stage.classList.add('done'); check.setAttribute('aria-label', 'Complete'); resolve(); }
    }
    requestAnimationFrame(tick);
  });
}

function startBinaryRain() {
  binaryRain.innerHTML = '';
  binaryRain.classList.add('active');
  var cols = 19;
  for (var i = 0; i < cols; i += 1) {
    var col = document.createElement('span');
    col.className = 'binary-column';
    col.style.left = ((i / cols) * 100) + '%';
    col.style.animationDuration = (2.8 + Math.random() * 2.4) + 's';
    col.style.animationDelay = (Math.random() * -2) + 's';
    col.textContent = Array.from({ length: 40 }, function() { return Math.random() > 0.5 ? '1' : '0'; }).join('\n');
    binaryRain.appendChild(col);
  }
}

function startDnaTerminal() {
  var cursor = 0;
  dnaTerminal.textContent = '> molecular_encoder.run(lossless=true)\n';
  return setInterval(function() {
    cursor = Math.min(state.archive.dna.length, cursor + 3);
    var visible = state.archive.dna.slice(0, cursor);
    dnaTerminal.textContent = '> molecular_encoder.run(lossless=true)\n' + formatDna(visible) + (cursor < state.archive.dna.length ? '█' : '');
    dnaTerminal.scrollTop = dnaTerminal.scrollHeight;
  }, 26);
}

function renderReport() {
  var archive = state.archive;
  $('#reportName').textContent = archive.fileName;
  $('#reportSize').textContent = formatBytes(archive.fileSize);
  $('#reportBits').textContent = archive.binaryBits.toLocaleString();
  $('#reportBases').textContent = archive.dnaBases.toLocaleString();
  $('#reportId').textContent = archive.id;
  $('#dnaPreview').textContent = archive.preview;
  $('#dnaIdInput').value = archive.id;
  drawQr(location.href.split('#')[0] + '#retrieve?dna=' + encodeURIComponent(archive.id));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  var units = ['KB', 'MB', 'GB'];
  var value = bytes;
  var unit = 'B';
  for (var i = 0; i < units.length; i += 1) { value /= 1024; unit = units[i]; if (value < 1024) break; }
  return value.toFixed(value >= 10 ? 1 : 2) + ' ' + unit;
}

function drawQr(data) {
  var canvas = $('#qrCanvas');
  var ctx = canvas.getContext('2d');
  var modules = makeQrModules(data);
  var size = modules.length;
  var quiet = 4;
  var total = size + quiet * 2;
  var cell = canvas.width / total;
  ctx.fillStyle = '#ecfeff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#04101f';
  for (var y = 0; y < size; y += 1) {
    for (var x = 0; x < size; x += 1) {
      if (!modules[y][x]) continue;
      ctx.fillRect(Math.round((x + quiet) * cell), Math.round((y + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function makeQrModules(text) {
  var version = 3;
  var size = 17 + version * 4;
  var dataCodewords = 55;
  var eccCodewords = 15;
  var mask = 0;
  var bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 53) bytes = bytes.slice(0, 53);
  var bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach(function(byte) { appendBits(bits, byte, 8); });
  appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  var data = [];
  for (var i = 0; i < bits.length; i += 8) {
    var value = 0;
    for (var j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  for (var pad = 0; data.length < dataCodewords; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);
  var ecc = reedSolomonRemainder(data, reedSolomonDivisor(eccCodewords));
  var codewords = data.concat(ecc);
  var qr = Array.from({ length: size }, function() { return Array(size).fill(null); });
  var reserved = Array.from({ length: size }, function() { return Array(size).fill(false); });
  function set(x, y, dark, reserve) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    qr[y][x] = !!dark;
    if (reserve) reserved[y][x] = true;
  }
  function finder(x, y) {
    for (var dy = -1; dy <= 7; dy += 1) for (var dx = -1; dx <= 7; dx += 1) {
      var xx = x + dx, yy = y + dy;
      var dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      set(xx, yy, dark, true);
    }
  }
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (var k = 8; k < size - 8; k += 1) { set(k, 6, k % 2 === 0, true); set(6, k, k % 2 === 0, true); }
  alignment(22, 22);
  function alignment(cx, cy) {
    for (var dy = -2; dy <= 2; dy += 1) for (var dx = -2; dx <= 2; dx += 1) {
      set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
    }
  }
  set(8, 4 * version + 9, true, true);
  for (var f = 0; f < 9; f += 1) { if (qr[8][f] === null) set(f, 8, false, true); if (qr[f][8] === null) set(8, f, false, true); }
  for (var f2 = size - 8; f2 < size; f2 += 1) { set(f2, 8, false, true); set(8, f2, false, true); }
  var allBits = [];
  codewords.forEach(function(byte) { appendBits(allBits, byte, 8); });
  var bitIndex = 0;
  var upward = true;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (var vert = 0; vert < size; vert += 1) {
      var y = upward ? size - 1 - vert : vert;
      for (var col = 0; col < 2; col += 1) {
        var x = right - col;
        if (reserved[y][x]) continue;
        var dark = bitIndex < allBits.length ? allBits[bitIndex] === 1 : false;
        bitIndex += 1;
        if ((x + y) % 2 === 0) dark = !dark;
        set(x, y, dark, false);
      }
    }
    upward = !upward;
  }
  drawFormat(qr, reserved, mask);
  return qr;
}

function drawFormat(qr, reserved, mask) {
  var size = qr.length;
  var data = (1 << 3) | mask;
  var rem = data << 10;
  for (var i = 14; i >= 10; i -= 1) if (((rem >>> i) & 1) !== 0) rem ^= 0x537 << (i - 10);
  var bits = ((data << 10) | rem) ^ 0x5412;
  function bit(i) { return ((bits >>> i) & 1) !== 0; }
  function set(x, y, dark) { qr[y][x] = dark; reserved[y][x] = true; }
  for (var a = 0; a <= 5; a += 1) set(8, a, bit(a));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (var b = 9; b < 15; b += 1) set(14 - b, 8, bit(b));
  for (var c = 0; c < 8; c += 1) set(size - 1 - c, 8, bit(c));
  for (var d = 8; d < 15; d += 1) set(8, size - 15 + d, bit(d));
}

function appendBits(out, value, length) {
  for (var i = length - 1; i >= 0; i -= 1) out.push((value >>> i) & 1);
}

function reedSolomonDivisor(degree) {
  var result = Array(degree).fill(0);
  result[degree - 1] = 1;
  var root = 1;
  for (var i = 0; i < degree; i += 1) {
    for (var j = 0; j < result.length; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  var result = Array(divisor.length).fill(0);
  data.forEach(function(byte) {
    var factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach(function(coef, i) { result[i] ^= gfMul(coef, factor); });
  });
  return result;
}

function gfMul(x, y) {
  var z = 0;
  for (var i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    if (((y >>> i) & 1) !== 0) z ^= x;
  }
  return z & 255;
}

$('#openRetrieve').addEventListener('click', function() { showView('retrieve'); });
$('#retrieveForm').addEventListener('submit', function(event) {
  event.preventDefault();
  var entered = $('#dnaIdInput').value.trim().toUpperCase();
  if (!entered) return;
  $('#dnaIdInput').value = entered;
  restorePanel.hidden = false;
});
$('#downloadButton').addEventListener('click', function() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  var file = state.file || createDemoFile();
  state.objectUrl = URL.createObjectURL(file);
  var anchor = document.createElement('a');
  anchor.href = state.objectUrl;
  anchor.download = file.name || 'biovault-restored-file';
  anchor.click();
});
function wait(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }
function initFromHash() { if (window.location.hash.startsWith('#retrieve')) showView('retrieve'); }

function initCanvas() {
  var canvas = $('#biofield');
  var ctx = canvas.getContext('2d');
  var width = 0, height = 0, nodes = [];
  function resize() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width * ratio; canvas.height = height * ratio;
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    var count = Math.min(82, Math.floor(width * height / 12000));
    nodes = Array.from({ length: count }, function() { return { x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22, phase: Math.random() * Math.PI * 2 }; });
  }
  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    nodes.forEach(function(node) {
      node.x += node.vx; node.y += node.vy;
      if (node.x < -20) node.x = width + 20; if (node.x > width + 20) node.x = -20;
      if (node.y < -20) node.y = height + 20; if (node.y > height + 20) node.y = -20;
    });
    for (var i = 0; i < nodes.length; i += 1) for (var j = i + 1; j < nodes.length; j += 1) {
      var a = nodes[i], b = nodes[j];
      var dx = a.x - b.x, dy = a.y - b.y, dist = Math.hypot(dx, dy);
      if (dist > 120) continue;
      ctx.strokeStyle = 'rgba(53, 232, 255, ' + (0.11 * (1 - dist / 120)) + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    nodes.forEach(function(node) {
      var pulse = 1.7 + Math.sin(time * .002 + node.phase) * .9;
      ctx.fillStyle = 'rgba(94, 234, 255, .58)'; ctx.shadowBlur = 14; ctx.shadowColor = '#35e8ff';
      ctx.beginPath(); ctx.arc(node.x, node.y, pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });
    requestAnimationFrame(draw);
  }
  resize(); window.addEventListener('resize', resize); requestAnimationFrame(draw);
}

buildPipeline();
initCanvas();
initFromHash();