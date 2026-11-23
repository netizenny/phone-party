const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const COLORS = ['#e63946', '#1d8cf8', '#2ec4b6', '#ffb703'];
// One entry per player slot: { pid, name, sock } or null. sock is null while that phone is disconnected.
const slots = [null, null, null, null];

// shortcut: picks the first non-internal IPv4; on PCs with VPN/WSL adapters set HOST_IP=192.168.x.x by hand.
function lanIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
}
// PUBLIC_URL (e.g. https://phone-party.onrender.com) overrides the LAN address when hosted online.
const joinUrl = `${(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${lanIp()}:${PORT}`).replace(/\/$/, '')}/play`;

const server = http.createServer(async (req, res) => {
  // Game scripts from public/, and Three.js from its npm build folder. The regex keeps paths inside those folders.
  const js = req.url.match(/^\/(three\/)?([\w.-]+\.js)$/);
  if (js) {
    const dir = js[1] ? path.join(__dirname, 'node_modules', 'three', 'build') : path.join(__dirname, 'public');
    return fs.readFile(path.join(dir, js[2]), (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(data);
    });
  }
  const file = req.url.startsWith('/play') ? 'phone.html' : req.url === '/' ? 'host.html' : null;
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  let html = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
  if (file === 'host.html') {
    html = html.replace('{{QR}}', await QRCode.toString(joinUrl, { type: 'svg', margin: 1 }))
               .replace('{{URL}}', joinUrl);
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

const io = new Server(server);

function broadcast() {
  const players = slots.map((s, i) => ({
    slot: i, color: COLORS[i], joined: !!s, name: s?.name || '', connected: !!s?.sock,
  }));
  // Paused while any joined player is disconnected; the big screen shows who we are waiting for.
  io.to('host').emit('players', { players, paused: players.some(p => p.joined && !p.connected) });
}

const cleanName = (n, slot) => String(n ?? '').replace(/[<>&"']/g, '').trim().slice(0, 12) || `P${slot + 1}`;

io.on('connection', (socket) => {
  const { role, pid } = socket.handshake.query;

  if (role === 'host') {
    socket.join('host');
    broadcast();
    socket.on('kick', (i) => {
      const s = slots[i];
      if (!s) return;
      s.sock?.emit('kicked');
      s.sock?.disconnect();
      slots[i] = null;
      broadcast();
    });
    return;
  }

  if (typeof pid !== 'string' || pid.length < 8 || pid.length > 64) return socket.disconnect();

  // Same phone coming back (refresh, screen unlock) gets its old slot; otherwise take a free one.
  let slot = slots.findIndex(s => s?.pid === pid);
  if (slot === -1) {
    slot = slots.indexOf(null);
    if (slot === -1) { socket.emit('full'); return socket.disconnect(); }
    slots[slot] = { pid, name: '', sock: null };
  }
  const me = slots[slot];
  if (me.sock && me.sock !== socket) me.sock.disconnect(); // same phone opened twice: newest wins
  me.sock = socket;
  socket.emit('joined', { slot, color: COLORS[slot], name: me.name });
  broadcast();

  socket.on('name', (n) => {
    if (slots[slot] !== me) return;
    me.name = cleanName(n, slot);
    socket.emit('joined', { slot, color: COLORS[slot], name: me.name });
    broadcast();
  });

  socket.on('btn', ({ b, down } = {}) => {
    if (slots[slot] !== me || typeof b !== 'string' || b.length > 8) return; // ignore junk / kicked players
    io.to('host').emit('btn', { slot, b, down: !!down });
  });

  socket.on('disconnect', () => {
    if (me.sock !== socket) return; // an older socket for this phone closed; the new one owns the slot
    me.sock = null;
    broadcast();
  });
});

server.listen(PORT, () => {
  console.log(`Big screen: http://localhost:${PORT}`);
  console.log(`Phones join: ${joinUrl}`);
});
