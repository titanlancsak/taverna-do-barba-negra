const os = require('os');
const { exec } = require('child_process');
const pool = require('../../db/pool');

// Roda um comando de shell e devolve a saída (ou null se falhar/timeout).
function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout.toString().trim());
    });
  });
}

// Uso de CPU: amostra os núcleos duas vezes com um pequeno intervalo e
// calcula a % de tempo ativo (não-idle) no período.
function cpuSnapshot() {
  let idle = 0;
  let total = 0;
  os.cpus().forEach((cpu) => {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  });
  return { idle, total };
}

function measureCpu() {
  return new Promise((resolve) => {
    const a = cpuSnapshot();
    setTimeout(() => {
      const b = cpuSnapshot();
      const idleDiff = b.idle - a.idle;
      const totalDiff = b.total - a.total;
      const usage = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;
      resolve(Math.max(0, Math.min(100, Math.round(usage))));
    }, 150);
  });
}

// Estado do disco na raiz "/" via `df` (KB, formato POSIX de uma linha).
async function diskUsage() {
  const out = await run('df -kP /');
  if (!out) return null;
  const line = out.split('\n')[1];
  if (!line) return null;
  const parts = line.trim().split(/\s+/);
  // Filesystem  1024-blocks  Used  Available  Capacity  Mounted
  const totalKb = parseInt(parts[1], 10);
  const usedKb = parseInt(parts[2], 10);
  if (!Number.isFinite(totalKb) || !Number.isFinite(usedKb)) return null;
  return {
    totalBytes: totalKb * 1024,
    usedBytes: usedKb * 1024,
    percent: totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0,
  };
}

// Nginx ativo? Usa systemctl (Linux). Fora do Linux ou sem systemctl, "unknown".
async function nginxStatus() {
  const out = await run('systemctl is-active nginx');
  if (out === null) return 'unknown';
  return out === 'active' ? 'online' : 'offline';
}

// Ping no PostgreSQL: SELECT 1 + latência.
async function dbStatus() {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { status: 'online', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'offline', latencyMs: null };
  }
}

// GET /api/admin/status — só admin (protegido no router).
async function getStatus(req, res) {
  try {
    const onlineUsers = req.app.get('onlineUsers'); // Map<userId, Set<socketId>>
    let onlineUserCount = 0;
    let onlineConnections = 0;
    if (onlineUsers) {
      onlineUserCount = onlineUsers.size;
      for (const sockets of onlineUsers.values()) onlineConnections += sockets.size;
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const [cpuPercent, disk, nginx, db] = await Promise.all([
      measureCpu(),
      diskUsage(),
      nginxStatus(),
      dbStatus(),
    ]);

    res.json({
      server: {
        status: 'online', // se respondeu, está no ar
        uptimeSeconds: Math.round(process.uptime()),
        hostname: os.hostname(),
        platform: os.platform(),
      },
      api: { status: 'online' }, // este endpoint faz parte da API
      cpu: {
        percent: cpuPercent,
        cores: os.cpus().length,
        loadAvg1: Math.round(os.loadavg()[0] * 100) / 100,
      },
      ram: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,
      },
      disk,
      database: db,
      nginx: { status: nginx },
      online: {
        users: onlineUserCount,
        connections: onlineConnections,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ステータスの取得に失敗しました' });
  }
}

module.exports = { getStatus };
