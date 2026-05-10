const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Store historical data for charts
let historyLength = 60; // keep last 60 seconds of data
let cpuHistory = [];
let memHistory = [];

setInterval(async () => {
    try {
        const time = new Date().toLocaleTimeString();

        // Get CPU Load
        const currentLoad = await si.currentLoad();
        
        // Get Memory Info
        const mem = await si.mem();

        // Get Processes list - sort by cpu usage
        const processesRaw = await si.processes();
        // Extract the top 50 processes
        const topProcesses = processesRaw.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 50)
            .map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu,
                mem: p.mem,
                state: p.state,
                user: p.user
            }));

        // Update history arrays
        cpuHistory.push({ time, load: parseFloat(currentLoad.currentLoad.toFixed(2)) });
        if (cpuHistory.length > historyLength) cpuHistory.shift();

        const memUsedGB = (mem.active / (1024 * 1024 * 1024)).toFixed(2);
        const memTotalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(2);
        const memUsedPercent = ((mem.active / mem.total) * 100).toFixed(2);

        memHistory.push({ time, usedPercent: parseFloat(memUsedPercent), usedGB: parseFloat(memUsedGB) });
        if (memHistory.length > historyLength) memHistory.shift();

        io.emit('system-metrics', {
            cpu: {
                currentLoad: currentLoad.currentLoad,
                history: cpuHistory
            },
            memory: {
                total: memTotalGB,
                used: memUsedGB,
                usedPercent: memUsedPercent,
                history: memHistory
            },
            processes: topProcesses
        });

    } catch (err) {
        console.error("Error gathering system info: ", err);
    }
}, 1000); // Pool every second

// API endpoint to kill a process safely
app.post('/api/kill', (req, res) => {
    const { pid } = req.body;
    if (!pid) {
        return res.status(400).json({ success: false, message: 'No PID provided' });
    }
    
    // Only allow localized requests for security
    const ip = req.socket.remoteAddress;
    if (ip !== '::1' && ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1') {
         return res.status(403).json({ success: false, message: 'Forbidden: Network requests not allowed' });
    }

    try {
        process.kill(parseInt(pid), 'SIGTERM');
        res.json({ success: true, message: `Terminated process ${pid}` });
    } catch (err) {
        console.error("Failed to kill process:", err);
        res.status(500).json({ success: false, message: `Failed to terminate: ${err.message}` });
    }
});

const PORT = 3001;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend securely running on http://127.0.0.1:${PORT}`);
});
