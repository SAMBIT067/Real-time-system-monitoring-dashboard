import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, HardDrive, Cpu, TerminalSquare } from 'lucide-react';
import './index.css'; // Make sure styling is imported

// Connect to backend
const targetUrl = 'http://127.0.0.1:3001';
const socket = io(targetUrl);

function App() {
  const [metrics, setMetrics] = useState({
    cpu: { currentLoad: 0, history: [] },
    memory: { total: 0, used: 0, usedPercent: 0, history: [] },
    processes: []
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('system-metrics', (data) => {
      setMetrics(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('system-metrics');
    };
  }, []);

  const handleKill = async (pid, name) => {
    if (!window.confirm(`Are you sure you want to terminate process ${name} (PID: ${pid})?`)) {
      return;
    }
    try {
      const res = await fetch(`${targetUrl}/api/kill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pid })
      });
      const data = await res.json();
      if (!data.success) {
        alert("Failed: " + data.message);
      }
    } catch (err) {
      alert("Error occurred while trying to terminate process.");
    }
  };

  return (
    <div className="container">
      <header>
        <h1 className="title">System Monitor</h1>
        <div className="subtitle">
          {connected ? "Connected to Local System • Live" : "Disconnected • Trying to reconnect..."}
        </div>
      </header>

      <div className="stats-grid">
        {/* CPU Card */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">CPU Load</span>
            <Cpu size={20} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{metrics.cpu.currentLoad.toFixed(1)}%</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.cpu.history}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide={true} />
                <YAxis domain={[0, 100]} hide={true} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Area type="monotone" dataKey="load" stroke="var(--accent-color)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Card */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Memory Usage</span>
            <HardDrive size={20} color="var(--text-muted)" />
          </div>
          <div className="stat-value">{metrics.memory.usedPercent}%</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
             {metrics.memory.used} GB / {metrics.memory.total} GB
          </div>
          <div className="chart-container" style={{ height: '95px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.memory.history}>
                <defs>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide={true} />
                <YAxis domain={[0, 100]} hide={true} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Area type="monotone" dataKey="usedPercent" stroke="var(--accent-color)" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <TerminalSquare size={18} />
             <h2>Top Processes</h2>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>PID</th>
                <th>Name</th>
                <th>State</th>
                <th>CPU %</th>
                <th>Memory %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {metrics.processes.map((proc) => (
                <tr key={proc.pid}>
                  <td style={{ color: 'var(--text-muted)' }}>{proc.pid}</td>
                  <td style={{ fontWeight: 500 }}>{proc.name}</td>
                  <td>
                    <span className={`status-badge ${proc.state === 'running' || proc.state === 'R' ? 'running' : 'sleeping'}`}>
                      {proc.state || 'Unknown'}
                    </span>
                  </td>
                  <td>{proc.cpu.toFixed(1)}%</td>
                  <td>{proc.mem.toFixed(1)}%</td>
                  <td>
                    <button className="btn-danger" onClick={() => handleKill(proc.pid, proc.name)}>
                      Kill
                    </button>
                  </td>
                </tr>
              ))}
              {metrics.processes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Loading processes...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
