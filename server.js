'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const ROOT = path.join(__dirname, 'public');

const rooms = new Map();
const sockets = new Map(); // socketId -> {ws, roomCode, playerId}
let nextPlayer = 1;
let nextBody = 1;

const COLORS = ['#e84855','#3aa0ff','#42d77d','#ffcb45','#b56cff','#ff8ed1','#44e5e7','#ff8c3a','#9aa3ad','#795548','#7bd88f','#f4f1de','#2d3142','#ef476f','#118ab2'];
const BOT_NAMES = ['Lodos','Kıvılcım','Misket','Poyraz','Duman','Kuzey','Aygıt','Kestane','Rota','Badem','Kobra','Çinko','Fener','Kumru'];
const HATS = ['none','miner','antenna','beret','pilot','ice','robot','crown','leaf','ring'];
const VISORS = ['clear','dark','green','gold','crack','scan'];
const BACKS = ['none','pack','tank','wings','cable','battery'];
const PETS = ['none','drone','slime','spark','orb'];

const MAP = {
  w: 1600, h: 1050,
  emergency: { x: 650, y: 420, r: 30, room: 'Merkez' },
  vents: [
    { id: 'v1', x: 155, y: 130, room: 'Komuta' },
    { id: 'v2', x: 425, y: 115, room: 'Seyir' },
    { id: 'v3', x: 1080, y: 140, room: 'Reaktör' },
    { id: 'v4', x: 165, y: 645, room: 'Elektrik' },
    { id: 'v5', x: 650, y: 710, room: 'Güvenlik' },
    { id: 'v6', x: 1075, y: 650, room: 'Medikal' },
    { id: 'v7', x: 850, y: 390, room: 'Depo' },
    { id: 'v8', x: 420, y: 385, room: 'Laboratuvar' },
    { id: 'v9', x: 1420, y: 150, room: 'Hangar' },
    { id: 'v10', x: 1430, y: 410, room: 'Atölye' },
    { id: 'v11', x: 1430, y: 720, room: 'Hidroponik' },
    { id: 'v12', x: 890, y: 910, room: 'Gözlem' }
  ],
  obstacles: [
    { x: 300, y: 215, w: 50, h: 405 },
    { x: 950, y: 215, w: 50, h: 405 },
    { x: 520, y: 250, w: 260, h: 34 },
    { x: 520, y: 555, w: 260, h: 34 },
    { x: 610, y: 315, w: 80, h: 70 },
    { x: 610, y: 455, w: 80, h: 70 },
    { x: 80, y: 260, w: 170, h: 30 },
    { x: 1055, y: 260, w: 170, h: 30 },
    { x: 80, y: 555, w: 170, h: 30 },
    { x: 1055, y: 555, w: 170, h: 30 },
    { x: 385, y: 500, w: 90, h: 34 },
    { x: 830, y: 500, w: 90, h: 34 },
    { x: 1265, y: 240, w: 38, h: 410 },
    { x: 1040, y: 835, w: 360, h: 34 },
    { x: 1345, y: 560, w: 145, h: 28 }
  ],
  doors: [
    { id: 'd1', x: 300, y: 165, w: 50, h: 55 },
    { id: 'd2', x: 300, y: 620, w: 50, h: 55 },
    { id: 'd3', x: 950, y: 165, w: 50, h: 55 },
    { id: 'd4', x: 950, y: 620, w: 50, h: 55 },
    { id: 'd5', x: 520, y: 250, w: 68, h: 34 },
    { id: 'd6', x: 710, y: 555, w: 70, h: 34 },
    { id: 'd7', x: 610, y: 315, w: 80, h: 32 },
    { id: 'd8', x: 610, y: 493, w: 80, h: 32 },
    { id: 'd9', x: 1265, y: 245, w: 38, h: 58 },
    { id: 'd10', x: 1265, y: 570, w: 38, h: 58 },
    { id: 'd11', x: 1040, y: 835, w: 70, h: 34 },
    { id: 'd12', x: 1325, y: 560, w: 70, h: 28 }
  ],
  panels: [
    { id: 'admin', name: 'Yönetim Paneli', x: 735, y: 470, room: 'Merkez' },
    { id: 'security', name: 'Kamera Paneli', x: 720, y: 710, room: 'Güvenlik' },
    { id: 'vitals', name: 'Yaşam Paneli', x: 1115, y: 705, room: 'Medikal' }
  ],
  sabotageFixes: [
    { type: 'lights', name: 'Işıkları Onar', x: 170, y: 705, room: 'Elektrik' },
    { type: 'reactor', name: 'Reaktörü Dengele', x: 1110, y: 160, room: 'Reaktör' },
    { type: 'comms', name: 'İletişimi Kur', x: 450, y: 145, room: 'Seyir' }
  ],
  rooms: [
    { name: 'Komuta', x: 60, y: 55, w: 240, h: 160 },
    { name: 'Seyir', x: 370, y: 45, w: 250, h: 160 },
    { name: 'Reaktör', x: 1000, y: 55, w: 240, h: 180 },
    { name: 'Laboratuvar', x: 370, y: 315, w: 210, h: 170 },
    { name: 'Merkez', x: 585, y: 350, w: 235, h: 140 },
    { name: 'Depo', x: 820, y: 315, w: 180, h: 180 },
    { name: 'Elektrik', x: 60, y: 620, w: 250, h: 165 },
    { name: 'Güvenlik', x: 525, y: 650, w: 260, h: 140 },
    { name: 'Medikal', x: 1000, y: 620, w: 250, h: 165 },
    { name: 'Kafeterya', x: 520, y: 55, w: 260, h: 145 },
    { name: 'Oksijen', x: 1000, y: 330, w: 240, h: 165 },
    { name: 'Arşiv', x: 60, y: 330, w: 240, h: 165 },
    { name: 'Hangar', x: 1320, y: 65, w: 230, h: 190 },
    { name: 'Atölye', x: 1320, y: 330, w: 230, h: 185 },
    { name: 'Hidroponik', x: 1320, y: 650, w: 230, h: 190 },
    { name: 'Gözlem', x: 760, y: 885, w: 280, h: 120 }
  ],
  tasks: [
    { id: 't1', name: 'Kabloları bağla', x: 120, y: 700, room: 'Elektrik' },
    { id: 't2', name: 'Sigortayı sıfırla', x: 260, y: 670, room: 'Elektrik' },
    { id: 't3', name: 'Rotayı çiz', x: 440, y: 100, room: 'Seyir' },
    { id: 't4', name: 'Sinyal ayarla', x: 580, y: 145, room: 'Seyir' },
    { id: 't5', name: 'Reaktörü kalibre et', x: 1085, y: 110, room: 'Reaktör' },
    { id: 't6', name: 'Soğutucuyu aç', x: 1190, y: 185, room: 'Reaktör' },
    { id: 't7', name: 'Kargo say', x: 870, y: 450, room: 'Depo' },
    { id: 't8', name: 'Numuneyi tara', x: 1060, y: 700, room: 'Medikal' },
    { id: 't9', name: 'Kimlik doğrula', x: 1210, y: 675, room: 'Medikal' },
    { id: 't10', name: 'Kamera kaydı indir', x: 575, y: 720, room: 'Güvenlik' },
    { id: 't11', name: 'Yakıt pompası', x: 930, y: 370, room: 'Depo' },
    { id: 't12', name: 'Konsolu temizle', x: 130, y: 115, room: 'Komuta' },
    { id: 't13', name: 'Kalkan testi', x: 260, y: 155, room: 'Komuta' },
    { id: 't14', name: 'Numune karıştır', x: 425, y: 385, room: 'Laboratuvar' },
    { id: 't15', name: 'Veri arşivle', x: 155, y: 425, room: 'Arşiv' },
    { id: 't16', name: 'Oksijen filtresi', x: 1085, y: 420, room: 'Oksijen' },
    { id: 't17', name: 'Yemek otomatı', x: 650, y: 125, room: 'Kafeterya' },
    { id: 't18', name: 'Merkez konsolu', x: 650, y: 455, room: 'Merkez' },
    { id: 't19', name: 'Kargo kapağı', x: 1400, y: 205, room: 'Hangar' },
    { id: 't20', name: 'Motor bakımı', x: 1490, y: 145, room: 'Hangar' },
    { id: 't21', name: 'Aletleri sırala', x: 1395, y: 440, room: 'Atölye' },
    { id: 't22', name: 'Kaynak modülü', x: 1500, y: 390, room: 'Atölye' },
    { id: 't23', name: 'Bitki besini', x: 1395, y: 730, room: 'Hidroponik' },
    { id: 't24', name: 'Nem sensörü', x: 1500, y: 775, room: 'Hidroponik' },
    { id: 't25', name: 'Teleskop hizala', x: 900, y: 940, room: 'Gözlem' }
  ]
};


const DEFAULT_SETTINGS = {
  maxPlayers: 10,
  botCount: 5,
  impostors: 1,
  playerSpeed: 155,
  killCooldown: 22,
  killDistance: 34,
  emergencyMeetings: 1,
  emergencyCooldown: 18,
  discussionTime: 20,
  votingTime: 35,
  tasksPerCrew: 4,
  confirmEjects: true,
  anonymousVotes: false,
  shapeshifterChance: 60,
  shapeshiftCooldown: 20,
  shapeshiftDuration: 12,
  phantomChance: 35,
  phantomCooldown: 22,
  phantomDuration: 8,
  noisemakerChance: 45,
  detectiveChance: 30,
  trackerChance: 30,
  mechanicChance: 25,
  doctorChance: 25,
  guardianChance: 25,
  viperChance: 25,
  viperDissolveTime: 20,
  mechanicCooldown: 18,
  doctorCooldown: 25,
  guardianCooldown: 35,
  guardianDuration: 8,
  sabotageCooldown: 28,
  criticalSabotageTime: 35,
  taskWorkTime: 1.35,
  doorCooldown: 24,
  doorDuration: 8
};

function clamp(v, a, b) { v = Number(v); if (!Number.isFinite(v)) return a; return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(a, b, c, d) { return Math.hypot(a - c, b - d); }
function now() { return Date.now() / 1000; }
function makeId() { return 'p' + (nextPlayer++); }
function roomOf(x, y) {
  for (const r of MAP.rooms) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.name;
  return 'Koridor';
}
function rectCircleCollide(rect, x, y, radius) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return dist(x, y, cx, cy) < radius;
}
function resolveCollisions(p, room) {
  const r = 14;
  const closedDoors = room ? room.doors.filter(d => d.closedUntil > now()) : [];
  for (const o of [...MAP.obstacles, ...closedDoors]) {
    if (!rectCircleCollide(o, p.x, p.y, r)) continue;
    const left = Math.abs(p.x - o.x), right = Math.abs(p.x - (o.x + o.w));
    const top = Math.abs(p.y - o.y), bottom = Math.abs(p.y - (o.y + o.h));
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = o.x - r; else if (m === right) p.x = o.x + o.w + r; else if (m === top) p.y = o.y - r; else p.y = o.y + o.h + r;
  }
}
function nearest(list, p, maxDist = Infinity, filter = () => true) {
  let best = null, bd = Infinity;
  for (const it of list) { if (!filter(it)) continue; const d = dist(p.x, p.y, it.x, it.y); if (d < bd) { bd = d; best = it; } }
  return bd <= maxDist ? { item: best, d: bd } : null;
}
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}
function safeName(name) {
  return String(name || 'Oyuncu').replace(/[<>]/g, '').trim().slice(0, 16) || 'Oyuncu';
}
function safeCosmetic(raw, room) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const used = room ? new Set([...room.players.values()].map(p => p.color)) : new Set();
  let color = typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '';
  if (!COLORS.includes(color) || used.has(color)) color = COLORS.find(x => !used.has(x)) || choice(COLORS);
  return {
    color,
    hat: HATS.includes(c.hat) ? c.hat : 'none',
    visor: VISORS.includes(c.visor) ? c.visor : 'clear',
    back: BACKS.includes(c.back) ? c.back : 'none',
    pet: PETS.includes(c.pet) ? c.pet : 'none'
  };
}

const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0];
  if (file === '/' || file === '') file = '/index.html';
  const fpath = path.normalize(path.join(ROOT, file));
  if (!fpath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fpath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fpath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade !== 'websocket') return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const sid = crypto.randomBytes(8).toString('hex');
  sockets.set(sid, { ws: socket, roomCode: null, playerId: null });
  socket.sid = sid;
  socket.alive = true;
  socket.on('data', buf => handleFrame(socket, buf));
  socket.on('close', () => disconnect(socket));
  socket.on('error', () => disconnect(socket));
  send(socket, { type: 'hello', id: sid });
});

function handleFrame(socket, chunk) {
  // TCP can split or coalesce WebSocket frames. Keep an input buffer per socket
  // and only parse a frame when all bytes have arrived.
  socket._frameBuffer = socket._frameBuffer ? Buffer.concat([socket._frameBuffer, chunk]) : chunk;
  let buffer = socket._frameBuffer;
  let offset = 0;

  while (true) {
    const frameStart = offset;
    if (buffer.length - offset < 2) break;

    const b1 = buffer[offset++];
    const opcode = b1 & 0x0f;
    const b2 = buffer[offset++];
    const masked = !!(b2 & 0x80);
    let len = b2 & 0x7f;

    if (len === 126) {
      if (buffer.length - offset < 2) { offset = frameStart; break; }
      len = buffer.readUInt16BE(offset); offset += 2;
    } else if (len === 127) {
      if (buffer.length - offset < 8) { offset = frameStart; break; }
      const high = buffer.readUInt32BE(offset);
      const low = buffer.readUInt32BE(offset + 4);
      len = high * 2 ** 32 + low;
      offset += 8;
    }

    // Basic abuse protection. Normal game messages are tiny.
    if (!Number.isFinite(len) || len > 1024 * 1024) {
      try { socket.end(); } catch {}
      return;
    }

    let mask;
    if (masked) {
      if (buffer.length - offset < 4) { offset = frameStart; break; }
      mask = buffer.slice(offset, offset + 4); offset += 4;
    }
    if (buffer.length - offset < len) { offset = frameStart; break; }

    const payload = Buffer.from(buffer.slice(offset, offset + len));
    offset += len;

    if (opcode === 8) { socket.end(); return; }
    if (opcode === 9) { pong(socket); continue; }
    if (opcode !== 1) continue;

    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    let msg;
    try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
    try { handleMessage(socket, msg); } catch (err) { console.error('handleMessage error:', err); }
  }

  socket._frameBuffer = buffer.slice(offset);
}

function frame(data, opcode = 1) {
  const payload = Buffer.from(data);
  let header;
  if (payload.length < 126) header = Buffer.from([0x80 | opcode, payload.length]);
  else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(payload.length, 6); }
  return Buffer.concat([header, payload]);
}
function send(ws, obj) { try { if (ws && !ws.destroyed && ws.writable !== false) ws.write(frame(JSON.stringify(obj))); } catch (err) { console.error('send error:', err.message); } }
function pong(ws) { if (!ws.destroyed) ws.write(frame('', 10)); }

function handleMessage(ws, msg) {
  const meta = sockets.get(ws.sid);
  if (!meta) return;
  if (msg.type === 'create') return createRoom(ws, safeName(msg.name), msg.cosmetic);
  if (msg.type === 'join') return joinRoom(ws, String(msg.code || '').toUpperCase().trim(), safeName(msg.name), msg.cosmetic);
  if (!meta.roomCode) return send(ws, { type: 'error', text: 'Önce oda oluştur veya katıl.' });
  const room = rooms.get(meta.roomCode);
  if (!room) return;
  const player = room.players.get(meta.playerId);
  if (!player) return;

  if (msg.type === 'settings') {
    if (player.id !== room.hostId || room.phase !== 'lobby') return;
    room.settings = sanitizeSettings({ ...room.settings, ...(msg.settings || {}) });
    syncBotsToSetting(room);
    broadcastRoom(room);
  }
  if (msg.type === 'addBot' && player.id === room.hostId && room.phase === 'lobby') { addBot(room); broadcastRoom(room); }
  if (msg.type === 'removeBot' && player.id === room.hostId && room.phase === 'lobby') { removeBot(room, msg.id); broadcastRoom(room); }
  if (msg.type === 'start' && player.id === room.hostId && room.phase === 'lobby') startGame(room);
  if (msg.type === 'input' && room.phase === 'play') player.input = { dx: clamp(Number(msg.dx) || 0, -1, 1), dy: clamp(Number(msg.dy) || 0, -1, 1) };
  if (msg.type === 'action' && room.phase === 'play') doAction(room, player, String(msg.action || ''));
  if (msg.type === 'taskMini' && room.phase === 'play') finishMiniTask(room, player, msg);
  if (msg.type === 'chat' && room.phase === 'meeting') addChat(room, player, String(msg.text || '').slice(0, 140));
  if (msg.type === 'vote' && room.phase === 'meeting') vote(room, player, msg.targetId === 'skip' ? 'skip' : String(msg.targetId || ''));
  if (msg.type === 'backToLobby' && player.id === room.hostId && room.phase === 'ended') backToLobby(room);
}

function createRoom(ws, name, cosmetic) {
  const code = generateCode();
  const id = makeId();
  const room = {
    code, hostId: id, phase: 'lobby', settings: { ...DEFAULT_SETTINGS }, players: new Map(), clients: new Map(), bots: new Map(), bodies: [], votes: new Map(), chat: [], meeting: null, startedAt: 0, tasksTotal: 0, tasksDone: 0, winner: null, endReason: '', endStats: null, stats: {}, sabotage: null, sabotageCd: 0, doorCd: 0, doors: MAP.doors.map(d => ({ ...d, closedUntil: 0 }))
  };
  const p = createPlayer(id, name, false, room, cosmetic);
  room.players.set(id, p);
  room.clients.set(id, ws);
  rooms.set(code, room);
  sockets.get(ws.sid).roomCode = code;
  sockets.get(ws.sid).playerId = id;
  send(ws, { type: 'created', code, playerId: id });
  syncBotsToSetting(room);
  broadcastRoom(room);
}

function joinRoom(ws, code, name, cosmetic) {
  const room = rooms.get(code);
  if (!room) return send(ws, { type: 'error', text: 'Oda bulunamadı.' });
  if (room.phase !== 'lobby') return send(ws, { type: 'error', text: 'Oyun başladı; şu an katılamazsın.' });
  if (room.players.size >= room.settings.maxPlayers) {
    const spareBot = [...room.players.values()].find(p => p.isBot);
    if (spareBot) removeBot(room, spareBot.id);
    else return send(ws, { type: 'error', text: 'Oda dolu.' });
  }
  const id = makeId();
  const p = createPlayer(id, name, false, room, cosmetic);
  room.players.set(id, p);
  room.clients.set(id, ws);
  sockets.get(ws.sid).roomCode = code;
  sockets.get(ws.sid).playerId = id;
  send(ws, { type: 'joined', code, playerId: id });
  broadcastRoom(room);
}

function createPlayer(id, name, isBot, room, cosmetic) {
  const cos = isBot ? safeCosmetic({ color: choice(COLORS), hat: choice(HATS), visor: choice(VISORS), back: choice(BACKS), pet: Math.random() < 0.35 ? choice(PETS) : 'none' }, room) : safeCosmetic(cosmetic, room);
  return {
    id, name, isBot, color: cos.color, cosmetic: cos, x: MAP.emergency.x + rand(-45, 45), y: MAP.emergency.y + rand(-45, 45), input: { dx: 0, dy: 0 }, alive: true,
    role: 'crewmate', team: 'crew', taskIds: [], doneTaskIds: [], killCd: 0, emergencyCd: 0, meetingsLeft: DEFAULT_SETTINGS.emergencyMeetings,
    abilityCd: 0, abilityUntil: 0, disguiseAs: null, vanishUntil: 0, trackerTarget: null, trackerUntil: 0, vitalsUntil: 0, protectedUntil: 0, taskWork: null, panel: null,
    lastRoom: 'Merkez', suspicion: {}, bot: isBot ? { state: 'idle', target: null, wait: 0, voteAt: 0, reportMemory: null, selfReportAt: 0, memory: [], roomLog: [], playersSeen: {}, nextObserve: 0 } : null,
    deadAt: 0
  };
}

function sanitizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'boolean') out[k] = !!s[k];
    else out[k] = Number(s[k]);
  }
  out.maxPlayers = clamp(Math.round(out.maxPlayers), 4, 15);
  out.botCount = clamp(Math.round(out.botCount), 0, 14);
  out.impostors = clamp(Math.round(out.impostors), 1, 3);
  out.playerSpeed = clamp(out.playerSpeed, 90, 240);
  out.killCooldown = clamp(out.killCooldown, 5, 60);
  out.killDistance = clamp(out.killDistance, 20, 65);
  out.emergencyMeetings = clamp(Math.round(out.emergencyMeetings), 0, 9);
  out.emergencyCooldown = clamp(out.emergencyCooldown, 0, 60);
  out.discussionTime = clamp(out.discussionTime, 0, 90);
  out.votingTime = clamp(out.votingTime, 10, 180);
  out.tasksPerCrew = clamp(Math.round(out.tasksPerCrew), 1, 8);
  for (const k of ['shapeshifterChance','phantomChance','noisemakerChance','detectiveChance','trackerChance','mechanicChance','doctorChance','guardianChance','viperChance']) out[k] = clamp(out[k], 0, 100);
  out.shapeshiftCooldown = clamp(out.shapeshiftCooldown, 5, 60);
  out.shapeshiftDuration = clamp(out.shapeshiftDuration, 3, 30);
  out.phantomCooldown = clamp(out.phantomCooldown, 5, 60);
  out.phantomDuration = clamp(out.phantomDuration, 3, 25);
  out.viperDissolveTime = clamp(out.viperDissolveTime, 5, 60);
  out.mechanicCooldown = clamp(out.mechanicCooldown, 5, 60);
  out.doctorCooldown = clamp(out.doctorCooldown, 5, 60);
  out.guardianCooldown = clamp(out.guardianCooldown, 8, 90);
  out.guardianDuration = clamp(out.guardianDuration, 3, 20);
  out.sabotageCooldown = clamp(out.sabotageCooldown, 8, 90);
  out.criticalSabotageTime = clamp(out.criticalSabotageTime, 12, 90);
  out.taskWorkTime = clamp(out.taskWorkTime, 0.4, 4);
  out.doorCooldown = clamp(out.doorCooldown, 6, 90);
  out.doorDuration = clamp(out.doorDuration, 3, 18);
  return out;
}

function syncBotsToSetting(room) {
  const humans = [...room.players.values()].filter(p => !p.isBot).length;
  const desired = Math.min(room.settings.botCount, Math.max(0, room.settings.maxPlayers - humans));
  while ([...room.players.values()].filter(p => p.isBot).length < desired && room.players.size < room.settings.maxPlayers) addBot(room, false);
  while ([...room.players.values()].filter(p => p.isBot).length > desired || room.players.size > room.settings.maxPlayers) {
    const bot = [...room.players.values()].find(p => p.isBot);
    if (!bot) break;
    room.players.delete(bot.id); room.bots.delete(bot.id);
  }
  room.settings.botCount = [...room.players.values()].filter(p => p.isBot).length;
}
function addBot(room, shouldUpdate = true) {
  if (room.players.size >= room.settings.maxPlayers) return;
  const id = 'b' + makeId();
  const usedNames = new Set([...room.players.values()].map(p => p.name));
  let name = choice(BOT_NAMES);
  let i = 2;
  while (usedNames.has(name)) name = choice(BOT_NAMES) + i++;
  const p = createPlayer(id, name, true, room);
  room.players.set(id, p); room.bots.set(id, p.bot);
  if (shouldUpdate) {
    room.settings.botCount = [...room.players.values()].filter(x => x.isBot).length;
    broadcastRoom(room);
  }
}
function removeBot(room, id, updateSetting = true) {
  const p = room.players.get(id);
  if (!p || !p.isBot) return;
  room.players.delete(id); room.bots.delete(id);
  if (updateSetting) room.settings.botCount = [...room.players.values()].filter(x => x.isBot).length;
}

function disconnect(ws) {
  const meta = sockets.get(ws.sid);
  if (!meta) return;
  const room = rooms.get(meta.roomCode);
  if (room && meta.playerId) {
    room.clients.delete(meta.playerId);
    const p = room.players.get(meta.playerId);
    if (p && !p.isBot) room.players.delete(meta.playerId);
    if (room.hostId === meta.playerId) {
      const nextHuman = [...room.players.values()].find(x => !x.isBot);
      if (nextHuman) room.hostId = nextHuman.id;
      else { rooms.delete(room.code); sockets.delete(ws.sid); return; }
    }
    broadcastRoom(room);
  }
  sockets.delete(ws.sid);
}

function startGame(room) {
  const players = [...room.players.values()];
  if (players.length < 4) return broadcastError(room, 'Başlamak için en az 4 oyuncu/bot gerekir.');
  room.settings = sanitizeSettings(room.settings);
  room.phase = 'play'; room.startedAt = now(); room.bodies = []; room.chat = []; room.votes.clear(); room.meeting = null; room.winner = null; room.endReason = '';
  room.tasksTotal = 0; room.tasksDone = 0; room.stats = {}; room.endStats = null; room.sabotage = null; room.sabotageCd = 0; room.doorCd = 0; room.doors = MAP.doors.map(d => ({ ...d, closedUntil: 0 }));
  for (const p of players) {
    Object.assign(p, { alive: true, x: MAP.emergency.x + rand(-70, 70), y: MAP.emergency.y + rand(-50, 50), input: { dx: 0, dy: 0 }, role: 'crewmate', team: 'crew', doneTaskIds: [], killCd: room.settings.killCooldown * 0.65, emergencyCd: room.settings.emergencyCooldown, meetingsLeft: room.settings.emergencyMeetings, abilityCd: 0, abilityUntil: 0, disguiseAs: null, vanishUntil: 0, trackerTarget: null, trackerUntil: 0, vitalsUntil: 0, protectedUntil: 0, taskWork: null, panel: null, lastRoom: 'Merkez', suspicion: {}, deadAt: 0 });
    if (p.bot) Object.assign(p.bot, { state: 'idle', target: null, wait: rand(0.5, 2.5), voteAt: 0, reportMemory: null, selfReportAt: 0, memory: [], roomLog: [], playersSeen: {}, nextObserve: 0 });
  }
  const shuffled = players.slice().sort(() => Math.random() - 0.5);
  const impCount = clamp(room.settings.impostors, 1, Math.max(1, Math.floor((players.length - 1) / 2)));
  const impostors = shuffled.slice(0, impCount);
  for (const p of impostors) {
    p.team = 'impostor';
    p.role = 'impostor';
    const r = Math.random() * 100;
    if (r < room.settings.shapeshifterChance) p.role = 'shapeshifter';
    else if (r < room.settings.shapeshifterChance + room.settings.phantomChance) p.role = 'phantom';
    else if (r < room.settings.shapeshifterChance + room.settings.phantomChance + room.settings.viperChance) p.role = 'viper';
  }
  const crewmates = players.filter(p => p.team === 'crew');
  for (const p of crewmates) {
    const r = Math.random() * 100;
    let acc = room.settings.noisemakerChance;
    if (r < acc) p.role = 'noisemaker';
    else if (r < (acc += room.settings.detectiveChance)) p.role = 'detective';
    else if (r < (acc += room.settings.trackerChance)) p.role = 'tracker';
    else if (r < (acc += room.settings.mechanicChance)) p.role = 'mechanic';
    else if (r < (acc += room.settings.doctorChance)) p.role = 'doctor';
    else if (r < (acc += room.settings.guardianChance)) p.role = 'guardian';
    p.taskIds = MAP.tasks.slice().sort(() => Math.random() - 0.5).slice(0, room.settings.tasksPerCrew).map(t => t.id);
    room.tasksTotal += p.taskIds.length;
  }
  for (const p of impostors) p.taskIds = [];
  for (const p of players) room.stats[p.id] = { id: p.id, name: p.name, color: p.color, role: p.role, team: p.team, isBot: p.isBot, tasks: 0, kills: 0, deaths: 0, reports: 0, fixes: 0, sabotages: 0, doors: 0, meetings: 0, votes: 0, survived: true };
  broadcastRoom(room);
}

function doAction(room, p, action) {
  if (!p.alive && !(action === 'task' && p.team === 'crew') && !(action === 'ability' && p.role === 'guardian')) return;
  if (action === 'task') return completeNearestTask(room, p);
  if (action === 'kill') return tryKill(room, p, false);
  if (action === 'report') return tryReport(room, p, null);
  if (action === 'emergency') return tryEmergency(room, p);
  if (action === 'ability') return useAbility(room, p);
  if (action.startsWith('sabotage')) return trySabotage(room, p, action.split(':')[1]);
  if (action === 'fix') return tryFixSabotage(room, p);
  if (action === 'panel') return usePanel(room, p);
  if (action === 'door') return tryDoorLock(room, p);
}



function completeNearestTask(room, p) {
  if (p.team !== 'crew' || (room.sabotage && room.sabotage.type === 'comms')) return;
  const undone = p.taskIds.filter(id => !p.doneTaskIds.includes(id));
  let best = null, bd = 9999;
  for (const id of undone) {
    const t = MAP.tasks.find(x => x.id === id); const d = dist(p.x, p.y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  if (best && bd < 38 && !p.taskWork) {
    p.input = { dx: 0, dy: 0 };
    p.taskWork = buildTaskWork(room, p, best);
  }
}
function buildTaskWork(room, p, task) {
  const minis = ['code', 'wires', 'switches', 'math', 'sequence', 'dial'];
  const mini = minis[Math.abs(task.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0)) % minis.length];
  const tw = { id: task.id, name: task.name, mini, started: now(), endsAt: now() + (p.isBot ? room.settings.taskWorkTime : 25), x: task.x, y: task.y, challenge: {}, answer: '' };
  if (mini === 'code') {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    tw.challenge = { code }; tw.answer = code;
  } else if (mini === 'wires') {
    const colors = ['Kırmızı', 'Mavi', 'Sarı', 'Yeşil'];
    const seq = colors.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    tw.challenge = { sequence: seq }; tw.answer = seq.join('|');
  } else if (mini === 'switches') {
    const mask = Math.floor(1 + Math.random() * 30);
    tw.challenge = { target: mask, count: 5 }; tw.answer = String(mask);
  } else if (mini === 'math') {
    const a = Math.floor(4 + Math.random() * 16), b = Math.floor(2 + Math.random() * 9), c = Math.floor(1 + Math.random() * 7);
    tw.challenge = { expr: `${a} + ${b} × ${c}` }; tw.answer = String(a + b * c);
  } else if (mini === 'sequence') {
    const seq = Array.from({ length: 5 }, () => String(Math.floor(1 + Math.random() * 5)));
    tw.challenge = { sequence: seq }; tw.answer = seq.join('');
  } else if (mini === 'dial') {
    const target = Math.floor(10 + Math.random() * 81);
    tw.challenge = { target }; tw.answer = String(target);
  } else {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    tw.challenge = { code }; tw.answer = code;
  }
  return tw;
}
function finishMiniTask(room, p, msg) {
  if (!p.taskWork || p.isBot || p.team !== 'crew') return false;
  if (String(msg.taskId || '') !== p.taskWork.id) return false;
  if (String(msg.answer || '') !== String(p.taskWork.answer)) return false;
  finishTask(room, p);
  broadcastRoom(room);
  return true;
}
function finishTask(room, p) {
  if (!p.taskWork || p.doneTaskIds.includes(p.taskWork.id)) { p.taskWork = null; return; }
  p.doneTaskIds.push(p.taskWork.id); room.tasksDone++; addStat(room, p, 'tasks');
  addSystem(room, `${p.name} bir görev tamamladı: ${p.taskWork.name}.`);
  p.taskWork = null;
  checkWin(room);
}

function tryKill(room, p, silent) {
  if (!p.alive || p.team !== 'impostor' || p.killCd > 0) return false;
  let best = null, bd = 9999;
  for (const v of room.players.values()) {
    if (!v.alive || v.team === 'impostor' || v.id === p.id) continue;
    const d = dist(p.x, p.y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best || bd > room.settings.killDistance) return false;
  if (best.protectedUntil > now()) {
    p.killCd = Math.min(room.settings.killCooldown, 5);
    addSystem(room, `${best.name} koruma kalkanıyla saldırıdan kurtuldu.`);
    return true;
  }
  killPlayer(room, p, best);
  if (!silent) broadcastRoom(room);
  return true;
}

function killPlayer(room, killer, victim) {
  victim.alive = false; victim.deadAt = now(); victim.input = { dx: 0, dy: 0 }; addStat(room, killer, 'kills'); addStat(room, victim, 'deaths'); if (room.stats?.[victim.id]) room.stats[victim.id].survived = false;
  killer.killCd = room.settings.killCooldown;
  const body = { id: 'body' + (nextBody++), victimId: victim.id, killerId: killer.id, x: victim.x, y: victim.y, room: roomOf(victim.x, victim.y), age: 0, alertUntil: 0, dissolveAt: 0, viper: killer.role === 'viper' };
  if (victim.role === 'noisemaker') body.alertUntil = now() + 6;
  if (killer.role === 'viper') body.dissolveAt = now() + room.settings.viperDissolveTime;
  room.bodies.push(body);
  // Nearby witnesses remember who was near the body. Bots do not get omniscient killer info unless close.
  for (const w of room.players.values()) {
    if (!w.alive || w.team !== 'crew' || !w.bot) continue;
    const nearBody = dist(w.x, w.y, victim.x, victim.y) < 170;
    const sawKiller = dist(w.x, w.y, killer.x, killer.y) < 145;
    if (nearBody) {
      if (sawKiller) w.suspicion[killer.id] = (w.suspicion[killer.id] || 0) + 5;
      for (const o of room.players.values()) if (o.alive && o.id !== w.id && dist(o.x, o.y, victim.x, victim.y) < 110) w.suspicion[o.id] = (w.suspicion[o.id] || 0) + 1.4;
    }
  }
  checkWin(room);
}

function tryReport(room, p, forcedBody) {
  if (!p.alive) return false;
  let body = forcedBody, bd = 9999;
  if (!body) {
    for (const b of room.bodies) {
      const d = dist(p.x, p.y, b.x, b.y);
      if (d < bd) { bd = d; body = b; }
    }
    if (!body || bd > 54) return false;
  }
  addStat(room, p, 'reports');
  startMeeting(room, `${p.name}, ${getPlayer(room, body.victimId)?.name || 'birinin'} cesedini ${body.room} bölümünde raporladı.`, p.id, body.id);
  return true;
}

function tryEmergency(room, p) {
  if (!p.alive || p.meetingsLeft <= 0 || p.emergencyCd > 0) return false;
  if (dist(p.x, p.y, MAP.emergency.x, MAP.emergency.y) > MAP.emergency.r + 16) return false;
  p.meetingsLeft--; p.emergencyCd = room.settings.emergencyCooldown; addStat(room, p, 'meetings');
  startMeeting(room, `${p.name} acil toplantı çağırdı.`, p.id, null);
  return true;
}

function useAbility(room, p) {
  if ((!p.alive && p.role !== 'guardian') || p.abilityCd > 0) return false;
  if (p.role === 'shapeshifter') {
    const targets = [...room.players.values()].filter(x => x.alive && x.id !== p.id);
    if (!targets.length) return false;
    let nearest = targets[0], bd = 9999;
    for (const t of targets) { const d = dist(p.x, p.y, t.x, t.y); if (d < bd) { bd = d; nearest = t; } }
    p.disguiseAs = nearest.id; p.abilityUntil = now() + room.settings.shapeshiftDuration; p.abilityCd = room.settings.shapeshiftCooldown;
    return true;
  }
  if (p.role === 'phantom') {
    p.vanishUntil = now() + room.settings.phantomDuration; p.abilityCd = room.settings.phantomCooldown;
    return true;
  }
  if (p.role === 'tracker') {
    const targets = [...room.players.values()].filter(x => x.alive && x.id !== p.id);
    if (!targets.length) return false;
    let nearest = targets[0], bd = 9999;
    for (const t of targets) { const d = dist(p.x, p.y, t.x, t.y); if (d < bd) { bd = d; nearest = t; } }
    p.trackerTarget = nearest.id; p.trackerUntil = now() + 18; p.abilityCd = 25;
    return true;
  }
  if (p.role === 'detective') {
    // Prototype: detective marks nearest body location in chat if a body exists.
    let b = null, bd = 9999;
    for (const body of room.bodies) { const d = dist(p.x, p.y, body.x, body.y); if (d < bd) { bd = d; b = body; } }
    if (b && bd < 95) { addSystem(room, `Sorgucu notu: Ceset ${b.room} civarında bulundu.`); p.abilityCd = 30; return true; }
  }
  if (p.role === 'mechanic') {
    let nearest = null, bd = 9999;
    for (const v of MAP.vents) { const d = dist(p.x, p.y, v.x, v.y); if (d < bd) { bd = d; nearest = v; } }
    if (!nearest || bd > 54) return false;
    const exits = MAP.vents.filter(v => v.id !== nearest.id).sort((a, b) => dist(p.x, p.y, b.x, b.y) - dist(p.x, p.y, a.x, a.y));
    const exit = exits[0] || nearest;
    p.x = exit.x + rand(-8, 8); p.y = exit.y + rand(-8, 8); p.abilityCd = room.settings.mechanicCooldown;
    return true;
  }
  if (p.role === 'doctor') {
    p.vitalsUntil = now() + 10; p.abilityCd = room.settings.doctorCooldown;
    addSystem(room, `${p.name} yaşam taraması başlattı.`);
    return true;
  }
  if (p.role === 'guardian') {
    if (p.alive) return false;
    const targets = [...room.players.values()].filter(x => x.alive && x.team === 'crew');
    if (!targets.length) return false;
    let nearest = targets[0], bd = 9999;
    for (const t of targets) { const d = dist(p.x, p.y, t.x, t.y); if (d < bd) { bd = d; nearest = t; } }
    nearest.protectedUntil = now() + room.settings.guardianDuration;
    p.abilityCd = room.settings.guardianCooldown;
    return true;
  }
  return false;
}


function trySabotage(room, p, requested) {
  if (!p.alive || p.team !== 'impostor' || room.sabotage || room.sabotageCd > 0) return false;
  const types = ['lights', 'reactor', 'comms'];
  const type = types.includes(requested) ? requested : choice(types);
  const fix = MAP.sabotageFixes.find(f => f.type === type);
  const names = { lights: 'Işık sabotajı', reactor: 'Reaktör krizi', comms: 'İletişim kesintisi' };
  room.sabotage = { type, name: names[type], started: now(), endsAt: type === 'reactor' ? now() + room.settings.criticalSabotageTime : 0, fixX: fix.x, fixY: fix.y, fixRoom: fix.room };
  room.sabotageCd = room.settings.sabotageCooldown; addStat(room, p, 'sabotages');
  addSystem(room, `${names[type]} başladı! ${fix.room} bölümünde onar.`);
  return true;
}
function tryFixSabotage(room, p) {
  if (!p.alive || !room.sabotage) return false;
  const fix = MAP.sabotageFixes.find(f => f.type === room.sabotage.type);
  if (!fix || dist(p.x, p.y, fix.x, fix.y) > 48) return false;
  addSystem(room, `${p.name} sabotajı onardı: ${room.sabotage.name}.`);
  addStat(room, p, 'fixes');
  room.sabotage = null;
  broadcastRoom(room);
  return true;
}
function usePanel(room, p) {
  if (!p.alive) return false;
  const near = nearest(MAP.panels, p, 55);
  if (!near) return false;
  p.panel = { id: near.item.id, until: now() + 10 };
  return true;
}

function tryDoorLock(room, p) {
  if (!p.alive || p.team !== 'impostor' || room.doorCd > 0) return false;
  let near = null, bd = 9999;
  for (const d of room.doors) { const cx = d.x + d.w / 2, cy = d.y + d.h / 2; const dd = dist(p.x, p.y, cx, cy); if (dd < bd) { bd = dd; near = d; } }
  if (!near) return false;
  near.closedUntil = now() + room.settings.doorDuration;
  room.doorCd = room.settings.doorCooldown; addStat(room, p, 'doors');
  addSystem(room, 'Bir kapı kilitlendi.');
  return true;
}

function makePanelInfo(room, viewer) {
  const autoVitals = viewer.vitalsUntil > now();
  if ((!viewer.panel || viewer.panel.until < now()) && !autoVitals) return null;
  const id = autoVitals ? 'vitals' : viewer.panel.id;
  if (id === 'admin') {
    const counts = {};
    for (const p of room.players.values()) if (p.alive) counts[roomOf(p.x, p.y)] = (counts[roomOf(p.x, p.y)] || 0) + 1;
    return { id, title: 'Yönetim Paneli', counts };
  }
  if (id === 'security') {
    const cams = MAP.rooms.map(r => ({ room: r.name, seen: [...room.players.values()].filter(p => p.alive && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h).slice(0, 4).map(p => ({ name: p.name, color: p.color })) }));
    return { id, title: 'Kamera Paneli', cams };
  }
  if (id === 'vitals' || viewer.vitalsUntil > now()) {
    return { id: 'vitals', title: 'Yaşam Paneli', vitals: [...room.players.values()].map(p => ({ name: p.name, color: p.color, alive: p.alive, deadFor: p.alive ? 0 : Math.round(now() - p.deadAt) })) };
  }
  return null;
}

function startMeeting(room, reason, reporterId, bodyId) {
  room.phase = 'meeting';
  room.meeting = { reason, reporterId, bodyId, started: now(), endsAt: now() + room.settings.discussionTime + room.settings.votingTime, votingAt: now() + room.settings.discussionTime };
  room.votes = new Map(); room.chat = [];
  addSystem(room, reason);
  // Like the original social deduction formula: bodies vanish after a meeting begins.
  room.bodies = [];
  for (const p of room.players.values()) {
    p.input = { dx: 0, dy: 0 };
    p.taskWork = null;
    p.panel = null;
    p.vote = null;
    if (p.bot && p.alive) p.bot.voteAt = now() + room.settings.discussionTime + rand(2, Math.max(3, room.settings.votingTime - 2));
  }
  botDiscuss(room);
  broadcastRoom(room);
}
function addSystem(room, text) { room.chat.push({ id: crypto.randomBytes(4).toString('hex'), system: true, text, time: Date.now() }); if (room.chat.length > 40) room.chat.shift(); }
function addChat(room, p, text) {
  if (!text.trim()) return;
  if (!p.alive) text = '(hayalet) ' + text;
  room.chat.push({ id: crypto.randomBytes(4).toString('hex'), from: p.id, name: p.name, color: p.color, text, time: Date.now() });
  if (room.chat.length > 60) room.chat.shift();
  broadcastRoom(room);
}
function vote(room, p, targetId) {
  if (!p.alive || !room.meeting) return;
  if (targetId !== 'skip' && (!room.players.has(targetId) || !room.players.get(targetId).alive)) return;
  room.votes.set(p.id, targetId); p.vote = targetId; addStat(room, p, 'votes');
  maybeEndMeeting(room);
  broadcastRoom(room);
}

function maybeEndMeeting(room) {
  if (!room.meeting) return;
  const alive = [...room.players.values()].filter(p => p.alive).length;
  if (room.votes.size >= alive || now() >= room.meeting.endsAt) resolveMeeting(room);
}
function resolveMeeting(room) {
  if (room.phase !== 'meeting') return;
  const counts = new Map();
  for (const v of room.votes.values()) counts.set(v, (counts.get(v) || 0) + 1);
  let best = 'skip', bestN = 0, tie = false;
  for (const [id, n] of counts) {
    if (n > bestN) { best = id; bestN = n; tie = false; }
    else if (n === bestN) tie = true;
  }
  if (!bestN || tie || best === 'skip') addSystem(room, 'Kimse atılmadı.');
  else {
    const p = room.players.get(best);
    if (p) {
      p.alive = false; p.deadAt = now();
      const roleText = room.settings.confirmEjects ? ` Rolü: ${roleName(p.role)}.` : '';
      addSystem(room, `${p.name} istasyondan atıldı.${roleText}`);
    }
  }
  for (const p of room.players.values()) {
    p.killCd = Math.max(p.killCd, room.settings.killCooldown * 0.55);
    p.emergencyCd = room.settings.emergencyCooldown;
    p.x = MAP.emergency.x + rand(-75, 75); p.y = MAP.emergency.y + rand(-55, 55);
    p.vote = null;
  }
  room.phase = 'play'; room.meeting = null; room.votes = new Map();
  checkWin(room);
  broadcastRoom(room);
}

function roleName(r) {
  return ({ crewmate: 'Mürettebat', noisemaker: 'Alarmcı', detective: 'Sorgucu', tracker: 'İz Sürücü', impostor: 'Gölge', shapeshifter: 'Taklitçi', phantom: 'Sis Hayaleti', viper: 'Çürütücü', mechanic: 'Mekanikçi', doctor: 'Doktor', guardian: 'Koruyucu Ruh' })[r] || r;
}
function getPlayer(room, id) { return room.players.get(id); }
function addStat(room, playerOrId, key, inc = 1) {
  const id = typeof playerOrId === 'string' ? playerOrId : playerOrId?.id;
  if (!id || !room.stats || !room.stats[id]) return;
  room.stats[id][key] = (room.stats[id][key] || 0) + inc;
}

function updateRoom(room, dt) {
  if (room.phase === 'play') {
    const t = now();
    for (const p of room.players.values()) {
      if (p.abilityCd > 0) p.abilityCd = Math.max(0, p.abilityCd - dt);
      if (p.killCd > 0) p.killCd = Math.max(0, p.killCd - dt);
      if (p.emergencyCd > 0) p.emergencyCd = Math.max(0, p.emergencyCd - dt);
      if (p.abilityUntil && t > p.abilityUntil) { p.disguiseAs = null; p.abilityUntil = 0; }
      if (p.trackerUntil && t > p.trackerUntil) { p.trackerUntil = 0; p.trackerTarget = null; }
      if (p.panel && p.panel.until < t) p.panel = null;
      p.lastRoom = roomOf(p.x, p.y);
      if (p.taskWork) {
        const d = dist(p.x, p.y, p.taskWork.x, p.taskWork.y);
        if (d > 45 || Math.hypot(p.input.dx, p.input.dy) > 0.1 || (room.sabotage && room.sabotage.type === 'comms')) p.taskWork = null;
        else if (t >= p.taskWork.endsAt) { if (p.isBot) finishTask(room, p); else p.taskWork = null; }
      }
      if (!p.alive) {
        const len = Math.hypot(p.input.dx, p.input.dy) || 1;
        const ghostSpeed = room.settings.playerSpeed * 1.28;
        p.x = clamp(p.x + p.input.dx / len * ghostSpeed * dt, 25, MAP.w - 25);
        p.y = clamp(p.y + p.input.dy / len * ghostSpeed * dt, 25, MAP.h - 25);
        continue;
      }
      if (p.isBot) { observeBot(room, p); updateBot(room, p, dt); }
      const len = Math.hypot(p.input.dx, p.input.dy) || 1;
      const speed = room.settings.playerSpeed * (room.sabotage && room.sabotage.type === 'lights' && p.team === 'crew' ? 0.94 : 1);
      p.x = clamp(p.x + p.input.dx / len * speed * dt, 25, MAP.w - 25);
      p.y = clamp(p.y + p.input.dy / len * speed * dt, 25, MAP.h - 25);
      resolveCollisions(p, room);
    }
    if (room.sabotageCd > 0) room.sabotageCd = Math.max(0, room.sabotageCd - dt);
    if (room.doorCd > 0) room.doorCd = Math.max(0, room.doorCd - dt);
    if (room.sabotage && room.sabotage.type === 'reactor' && room.sabotage.endsAt && t >= room.sabotage.endsAt) endGame(room, 'impostor', 'Reaktör krizi zamanında onarılamadı.');
    for (let i = room.bodies.length - 1; i >= 0; i--) {
      const b = room.bodies[i]; b.age += dt;
      if (b.dissolveAt && t >= b.dissolveAt) room.bodies.splice(i, 1);
    }
    checkWin(room);
  } else if (room.phase === 'meeting') {
    updateBotVotes(room);
    maybeEndMeeting(room);
  }
}


function observeBot(room, p) {
  if (!p.bot || p.bot.nextObserve > now()) return;
  p.bot.nextObserve = now() + rand(1.2, 2.4);
  const r = roomOf(p.x, p.y);
  p.bot.roomLog.push({ room: r, time: Math.round(now() - room.startedAt) });
  if (p.bot.roomLog.length > 12) p.bot.roomLog.shift();
  for (const o of room.players.values()) {
    if (!o.alive || o.id === p.id) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < 165) {
      p.bot.playersSeen[o.id] = (p.bot.playersSeen[o.id] || 0) + 1;
      p.bot.memory.push({ id: o.id, name: o.name, room: r, time: Math.round(now() - room.startedAt), close: d < 80 });
      if (p.team === 'crew' && d < 55 && o.team === 'impostor') p.suspicion[o.id] = (p.suspicion[o.id] || 0) + 0.15;
    }
  }
  if (p.bot.memory.length > 24) p.bot.memory.splice(0, p.bot.memory.length - 24);
}

function updateBot(room, p, dt) {
  const b = p.bot;
  if (p.team === 'crew') return crewBot(room, p, b, dt);
  return impostorBot(room, p, b, dt);
}
function moveToward(p, x, y) {
  const dx = x - p.x, dy = y - p.y; const l = Math.hypot(dx, dy) || 1;
  p.input = { dx: dx / l, dy: dy / l };
}
function crewBot(room, p, b, dt) {
  if (p.taskWork) { p.input = { dx: 0, dy: 0 }; return; }
  if (room.sabotage && Math.random() < 0.72) {
    const fix = MAP.sabotageFixes.find(f => f.type === room.sabotage.type);
    if (fix) { const dFix = dist(p.x, p.y, fix.x, fix.y); if (dFix > 34) moveToward(p, fix.x, fix.y); else tryFixSabotage(room, p); return; }
  }
  // Report visible bodies quickly, especially Noisemaker alerts.
  let nearestBody = null, bd = 9999;
  for (const body of room.bodies) { const d = dist(p.x, p.y, body.x, body.y); if (d < bd) { bd = d; nearestBody = body; } }
  if (nearestBody && (bd < 95 || nearestBody.alertUntil > now())) {
    moveToward(p, nearestBody.x, nearestBody.y);
    if (bd < 50 && Math.random() < 0.18) return tryReport(room, p, nearestBody);
    return;
  }
  const undone = p.taskIds.filter(id => !p.doneTaskIds.includes(id));
  if (undone.length) {
    let task = b.target && MAP.tasks.find(t => t.id === b.target && undone.includes(t.id));
    if (!task) { b.target = choice(undone); task = MAP.tasks.find(t => t.id === b.target); b.wait = rand(0.3, 1.2); }
    const d = dist(p.x, p.y, task.x, task.y);
    if (d > 20) moveToward(p, task.x, task.y);
    else { p.input = { dx: 0, dy: 0 }; b.wait -= dt; if (b.wait <= 0) { completeNearestTask(room, p); b.target = null; b.wait = rand(0.2, 1.2); } }
  } else {
    if (!b.target || Math.random() < 0.01) b.target = choice(MAP.tasks).id;
    const task = MAP.tasks.find(t => t.id === b.target); moveToward(p, task.x, task.y);
  }
  if ((p.role === 'tracker' || p.role === 'doctor' || p.role === 'mechanic') && p.abilityCd <= 0 && Math.random() < 0.006) useAbility(room, p);
}
function impostorBot(room, p, b, dt) {
  const aliveCrew = [...room.players.values()].filter(x => x.alive && x.team === 'crew');
  if (!aliveCrew.length) { p.input = { dx: 0, dy: 0 }; return; }
  if (!room.sabotage && room.sabotageCd <= 0 && Math.random() < 0.006) trySabotage(room, p);
  if (room.doorCd <= 0 && Math.random() < 0.003) tryDoorLock(room, p);
  // If body nearby, sometimes self report after moving away or to frame.
  let nearBody = null, bdBody = 9999;
  for (const body of room.bodies) { const d = dist(p.x, p.y, body.x, body.y); if (d < bdBody) { bdBody = d; nearBody = body; } }
  if (nearBody && bdBody < 45 && Math.random() < 0.004) return tryReport(room, p, nearBody);

  let best = null, bestScore = -999;
  for (const v of aliveCrew) {
    const d = dist(p.x, p.y, v.x, v.y);
    const crowd = [...room.players.values()].filter(o => o.alive && o.id !== p.id && o.id !== v.id && dist(o.x, o.y, v.x, v.y) < 130).length;
    const score = -d - crowd * 160 + (v.role === 'detective' ? 70 : 0) + (v.role === 'tracker' ? 35 : 0);
    if (score > bestScore) { bestScore = score; best = v; }
  }
  if (!best) return;
  const d = dist(p.x, p.y, best.x, best.y);
  const crowd = [...room.players.values()].filter(o => o.alive && o.id !== p.id && o.id !== best.id && dist(o.x, o.y, best.x, best.y) < 130).length;
  if (p.role === 'shapeshifter' && p.abilityCd <= 0 && !p.disguiseAs && d < 140 && crowd <= 1 && Math.random() < 0.04) useAbility(room, p);
  if (p.role === 'phantom' && p.abilityCd <= 0 && d < 95 && crowd <= 1 && Math.random() < 0.03) useAbility(room, p);
  if (d < room.settings.killDistance && p.killCd <= 0 && crowd <= 1) {
    tryKill(room, p, true);
    // flee after kill
    const far = choice(MAP.tasks);
    b.target = far.id; moveToward(p, far.x, far.y);
    return;
  }
  if (b.target && Math.random() < 0.985) {
    const t = MAP.tasks.find(x => x.id === b.target);
    if (t && dist(p.x, p.y, t.x, t.y) > 25 && Math.random() < 0.25) { moveToward(p, t.x, t.y); return; }
  }
  moveToward(p, best.x, best.y);
}


function botDiscuss(room) {
  const aliveBots = [...room.players.values()].filter(p => p.isBot && p.alive);
  const recentRooms = MAP.rooms.map(r => r.name);
  const taskNames = MAP.tasks.map(t => t.name);
  for (const p of aliveBots.slice(0, 6)) {
    let best = null, score = 0;
    for (const [id, s] of Object.entries(p.suspicion)) {
      const cand = room.players.get(id);
      if (cand && cand.alive && s > score) { score = s; best = cand; }
    }
    let text;
    if (p.team === 'crew') {
      if (best && score > 2.2) text = `${best.name} ${room.meeting?.reason?.includes('raporladı') ? 'cesede yakın olabilir' : 'bana şüpheli geldi'}.`;
      else if (p.role === 'tracker') text = `İz bilgim yok ama son gördüğüm oda ${p.lastRoom}.`;
      else if (p.bot.memory.length && Math.random() < 0.45) { const m = choice(p.bot.memory); text = `${m.name} kişisini ${m.room} civarında gördüm.`; }
      else if (p.role === 'doctor') text = 'Yaşam panelini kontrol etmemiz iyi olur.';
      else text = choice([`Ben ${p.lastRoom} tarafında ${choice(taskNames)} yapıyordum.`, `Son konumum ${p.lastRoom}.`, 'Tek gezenleri not alın.', 'Birlikte gezenler birbirini doğrulasın.']);
    } else {
      const fakeRoom = choice(recentRooms.filter(r => r !== p.lastRoom) || recentRooms);
      const fakeTask = choice(taskNames);
      const frame = [...room.players.values()].filter(x => x.alive && x.team === 'crew' && x.id !== p.id);
      const target = frame.length ? choice(frame) : null;
      text = choice([
        `Ben ${fakeRoom} tarafında ${fakeTask} yapıyordum.`,
        target ? `${target.name} çok sessiz, bence dikkat.` : 'Bence kanıt yoksa pas geçelim.',
        `Ben o tarafta değildim, ${fakeRoom} civarındaydım.`,
        'Acele oy verirsek yanlış kişiyi atabiliriz.'
      ]);
    }
    room.chat.push({ id: crypto.randomBytes(4).toString('hex'), from: p.id, name: p.name, color: p.color, text, time: Date.now() });
  }
}

function updateBotVotes(room) {
  const t = now();
  if (!room.meeting || t < room.meeting.votingAt) return;
  for (const p of room.players.values()) {
    if (!p.isBot || !p.alive || room.votes.has(p.id) || p.bot.voteAt > t) continue;
    let target = 'skip';
    if (p.team === 'crew') {
      let best = null, score = 0;
      for (const [id, s] of Object.entries(p.suspicion)) {
        const cand = room.players.get(id);
        if (cand && cand.alive && s > score) { score = s; best = id; }
      }
      if (best && score > 2.2) target = best;
      else if (Math.random() < 0.18) {
        const suspects = [...room.players.values()].filter(x => x.alive && x.id !== p.id);
        target = choice(suspects).id;
      }
    } else {
      const crews = [...room.players.values()].filter(x => x.alive && x.team === 'crew');
      target = crews.length && Math.random() < 0.55 ? choice(crews).id : 'skip';
    }
    vote(room, p, target);
  }
}

function checkWin(room) {
  if (room.phase === 'lobby' || room.phase === 'ended') return;
  const alive = [...room.players.values()].filter(p => p.alive);
  const aliveImp = alive.filter(p => p.team === 'impostor').length;
  const aliveCrew = alive.filter(p => p.team === 'crew').length;
  if (aliveImp <= 0) return endGame(room, 'crew', 'Tüm gölgeler yakalandı.');
  if (room.tasksTotal > 0 && room.tasksDone >= room.tasksTotal) return endGame(room, 'crew', 'Tüm görevler tamamlandı.');
  if (aliveImp >= aliveCrew) return endGame(room, 'impostor', 'Gölgeler sayıca üstün geldi.');
}
function endGame(room, winner, reason) {
  room.phase = 'ended'; room.winner = winner; room.endReason = reason;
  const duration = Math.max(0, Math.round(now() - (room.startedAt || now())));
  room.endStats = Object.values(room.stats || {}).map(st => ({ ...st, won: st.team === winner, score: st.tasks * 10 + st.kills * 35 + st.reports * 8 + st.fixes * 12 + st.sabotages * 8 + st.doors * 5 + (st.survived ? 15 : 0) + (st.team === winner ? 30 : 0) })).sort((a, b) => b.score - a.score);
  room.endStatsMeta = { duration };
  addSystem(room, `${winner === 'crew' ? 'Mürettebat' : 'Gölgeler'} kazandı: ${reason}`);
  broadcastRoom(room);
}
function backToLobby(room) {
  room.phase = 'lobby'; room.winner = null; room.endReason = ''; room.endStats = null; room.stats = {}; room.bodies = []; room.chat = []; room.meeting = null; room.votes = new Map();
  for (const p of room.players.values()) { p.alive = true; p.role = 'crewmate'; p.team = 'crew'; p.taskIds = []; p.doneTaskIds = []; p.input = { dx: 0, dy: 0 }; }
  broadcastRoom(room);
}

function displayFor(room, viewer, p) {
  const t = now();
  let color = p.color, name = p.name, cosmetic = p.cosmetic, hidden = false;
  if (!p.alive && viewer.alive && room.phase === 'play') hidden = true;
  if (p.vanishUntil > t && viewer.id !== p.id && viewer.team !== 'impostor') hidden = true;
  if (p.disguiseAs && p.abilityUntil > t && viewer.id !== p.id) {
    const d = room.players.get(p.disguiseAs);
    if (d) { color = d.color; name = d.name; cosmetic = d.cosmetic; }
  }
  return { id: p.id, name, trueName: p.name, color, trueColor: p.color, cosmetic, trueCosmetic: p.cosmetic, x: p.x, y: p.y, alive: p.alive, isBot: p.isBot, hidden, protected: p.protectedUntil > t, role: viewer.id === p.id || room.phase === 'ended' ? p.role : null, team: viewer.id === p.id || room.phase === 'ended' || (!viewer.alive && room.phase !== 'play') ? p.team : null, voted: room.phase === 'meeting' && room.votes.has(p.id) };
}
function snapshot(room, viewer) {
  const me = room.players.get(viewer.id) || viewer;
  const t = now();
  const visibleBodies = room.bodies.map(b => ({ id: b.id, victimId: b.victimId, victimName: getPlayer(room, b.victimId)?.name || '?', x: b.x, y: b.y, room: b.room, alert: b.alertUntil > t, viper: b.viper, dissolveLeft: b.dissolveAt ? Math.max(0, b.dissolveAt - t) : 0 }));
  const trackerTarget = me.trackerTarget ? room.players.get(me.trackerTarget) : null;
  const tracker = trackerTarget && me.trackerUntil > t ? displayFor(room, me, trackerTarget) : null;
  const panelInfo = makePanelInfo(room, me);
  const taskWork = me.taskWork ? { id: me.taskWork.id, name: me.taskWork.name, mini: me.taskWork.mini, challenge: me.taskWork.challenge, progress: clamp((t - me.taskWork.started) / Math.max(0.1, me.taskWork.endsAt - me.taskWork.started), 0, 1) } : null;
  return {
    type: 'state', code: room.code, phase: room.phase, hostId: room.hostId, you: me.id, settings: room.settings, sabotage: room.sabotage ? { ...room.sabotage, timeLeft: room.sabotage.endsAt ? Math.max(0, room.sabotage.endsAt - t) : 0 } : null, sabotageCd: room.sabotageCd, doorCd: room.doorCd, doors: room.doors.map(d => ({ ...d, timeLeft: Math.max(0, d.closedUntil - t) })), panelInfo, map: MAP, players: [...room.players.values()].map(p => displayFor(room, me, p)), bodies: visibleBodies,
    tasksDone: room.tasksDone, tasksTotal: room.tasksTotal, chat: room.chat, votes: [...room.votes.entries()], meeting: room.meeting, winner: room.winner, endReason: room.endReason, endStats: room.endStats, endStatsMeta: room.endStatsMeta,
    me: { id: me.id, role: me.role, team: me.team, alive: me.alive, taskIds: me.taskIds, doneTaskIds: me.doneTaskIds, killCd: me.killCd, emergencyCd: me.emergencyCd, meetingsLeft: me.meetingsLeft, abilityCd: me.abilityCd, abilityUntil: Math.max(0, me.abilityUntil - t), vanishLeft: Math.max(0, me.vanishUntil - t), tracker, taskWork, vitalsLeft: Math.max(0, me.vitalsUntil - t), protectedLeft: Math.max(0, me.protectedUntil - t) }
  };
}
function broadcastRoom(room) {
  for (const [id, ws] of room.clients) {
    const p = room.players.get(id); if (p) send(ws, snapshot(room, p));
  }
}
function broadcastError(room, text) { for (const ws of room.clients.values()) send(ws, { type: 'error', text }); }

let last = now();
setInterval(() => {
  const t = now(); const dt = Math.min(0.08, t - last); last = t;
  for (const room of rooms.values()) {
    try { updateRoom(room, dt); } catch (err) { console.error('updateRoom error in', room.code, err); }
  }
}, 50);
setInterval(() => {
  for (const room of rooms.values()) {
    try { if (room.phase !== 'lobby') broadcastRoom(room); } catch (err) { console.error('broadcastRoom error in', room.code, err); }
  }
}, 100);

server.listen(PORT, () => console.log(`Gölge İstasyonu çalışıyor: http://localhost:${PORT}`));
