/* Lightweight local stability smoke test. Run with: node stability-test.js
   It starts no server; run `npm start` separately or let CI use bash with server in background. */
'use strict';

const net = require('net');
const crypto = require('crypto');

function encodeFrame(obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
  else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
  const out = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, out]);
}

class WSClient {
  constructor(name) { this.name = name; this.socket = null; this.buffer = Buffer.alloc(0); this.messages = []; }
  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      this.socket = net.createConnection(8080, '127.0.0.1', () => {
        this.socket.write(`GET / HTTP/1.1\r\nHost: localhost:8080\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let handshake = Buffer.alloc(0);
      const onData = chunk => {
        handshake = Buffer.concat([handshake, chunk]);
        const idx = handshake.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = handshake.slice(0, idx).toString();
        if (!head.includes('101')) return reject(new Error('Handshake failed: ' + head));
        this.socket.off('data', onData);
        const rest = handshake.slice(idx + 4);
        this.socket.on('data', c => this._data(c));
        if (rest.length) this._data(rest);
        resolve();
      };
      this.socket.on('data', onData);
      this.socket.on('error', reject);
    });
  }
  _data(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let off = 0;
    while (this.buffer.length - off >= 2) {
      const start = off;
      const op = this.buffer[off++] & 15;
      let len = this.buffer[off++] & 127;
      if (len === 126) { if (this.buffer.length - off < 2) { off = start; break; } len = this.buffer.readUInt16BE(off); off += 2; }
      else if (len === 127) { if (this.buffer.length - off < 8) { off = start; break; } len = Number(this.buffer.readBigUInt64BE(off)); off += 8; }
      if (this.buffer.length - off < len) { off = start; break; }
      const payload = this.buffer.slice(off, off + len); off += len;
      if (op === 1) { try { this.messages.push(JSON.parse(payload.toString())); } catch {} }
    }
    this.buffer = this.buffer.slice(off);
  }
  send(obj, split = false) {
    const frame = encodeFrame(obj);
    if (split && frame.length > 3) { this.socket.write(frame.slice(0, 3)); setTimeout(() => this.socket.write(frame.slice(3)), 5); }
    else this.socket.write(frame);
  }
  waitState(predicate, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        for (let i = 0; i < this.messages.length; i++) {
          const m = this.messages[i];
          if (m.type === 'state' && (!predicate || predicate(m))) return resolve(m);
        }
        if (Date.now() - start > timeout) return reject(new Error('state timeout'));
        setTimeout(tick, 25);
      };
      tick();
    });
  }
  close() { try { this.socket.end(); } catch {} }
}

(async () => {
  const a = new WSClient('A');
  await a.connect();
  a.send({ type: 'create', name: 'Tester', cosmetic: { color: '#3aa0ff' } }, true);
  const lobby = await a.waitState(s => s.phase === 'lobby');
  console.log('lobby ok', lobby.code, lobby.players.length);
  a.send({ type: 'settings', settings: { botCount: 5, maxPlayers: 10 } });
  a.send({ type: 'start' });
  const play = await a.waitState(s => s.phase === 'play');
  console.log('play ok', play.me.role, play.tasksTotal, play.map.rooms.length);
  const actions = ['panel', 'task', 'fix', 'ability', 'report', 'emergency', 'sabotage:lights', 'door', 'kill'];
  for (let i = 0; i < 60; i++) {
    a.send({ type: 'input', dx: Math.sin(i / 3), dy: Math.cos(i / 4) });
    a.send({ type: 'action', action: actions[i % actions.length] });
    await new Promise(r => setTimeout(r, 50));
  }
  const latest = a.messages.filter(m => m.type === 'state').at(-1);
  if (!latest) throw new Error('no final state');
  console.log('final ok', latest.phase, latest.players.length);
  a.close();
})().catch(err => { console.error(err); process.exit(1); });
