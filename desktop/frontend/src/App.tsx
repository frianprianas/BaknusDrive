import { useState, useEffect } from 'react';
import { Monitor, Folder, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

// Wails bindings are usually available on window.go
declare global {
    interface Window {
        go: any;
        runtime: any;
    }
}

function App() {
    const [token, setToken] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [status, setStatus] = useState('Idle');
    const [syncPath, setSyncPath] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        // Listen for events from Go
        if (window.runtime) {
            window.runtime.EventsOn('file-synced', (fileName: string) => {
                setLogs(prev => [`Synced: ${fileName}`, ...prev].slice(0, 10));
            });
            window.runtime.EventsOn('sync-complete', (msg: string) => {
                setStatus(msg);
                setIsSyncing(false);
            });
        }
    }, []);

    const handleRegister = async () => {
        if (!token || !deviceName) {
            alert("Please enter token and device name");
            return;
        }
        try {
            await window.go.main.App.SetToken(token);
            const res = await window.go.main.App.RegisterDevice(deviceName);
            setStatus(res);
        } catch (err: any) {
            setStatus("Error: " + err);
        }
    };

    const handleSelectFolder = async () => {
        try {
            const path = await window.go.main.App.SelectFolder();
            if (path) setSyncPath(path);
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleStartSync = async () => {
        setIsSyncing(true);
        setStatus("Syncing...");
        try {
            const res = await window.go.main.App.StartSync();
            setStatus(res);
        } catch (err: any) {
            setStatus("Sync failed: " + err);
            setIsSyncing(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <div className="max-w-2xl mx-auto space-y-8">
                <header className="flex items-center gap-4 mb-12">
                    <div className="p-3 bg-blue-600 rounded-2xl">
                        <Monitor size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">BaknusDrive Desktop</h1>
                        <p className="text-slate-400">Computer Cloud Sync Agent</p>
                    </div>
                </header>

                <section className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-xl space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <RefreshCw className={isSyncing ? 'animate-spin' : ''} />
                            Configuration
                        </h2>
                        <div className="grid gap-4">
                            <input
                                type="password"
                                placeholder="Paste Auth Token here..."
                                className="bg-slate-900 border border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Device Name (e.g. My-Laptop)"
                                className="bg-slate-900 border border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                            />
                            <button
                                onClick={handleRegister}
                                className="bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl p-3 font-semibold"
                            >
                                Connect Device
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700 space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Folder /> Sync Folder
                        </h2>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-400 truncate">
                                {syncPath || "No folder selected"}
                            </div>
                            <button
                                onClick={handleSelectFolder}
                                className="bg-slate-700 hover:bg-slate-600 rounded-xl px-4 font-semibold"
                            >
                                Browse
                            </button>
                        </div>
                        <button
                            onClick={handleStartSync}
                            disabled={isSyncing || !syncPath}
                            className={`w-full p-4 rounded-xl font-bold text-lg transition-all ${isSyncing || !syncPath
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'
                                }`}
                        >
                            Start Synchronizing
                        </button>
                    </div>
                </section>

                <section className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-400 uppercase tracking-wider text-sm">Status Log</h3>
                        <span className="text-xs px-2 py-1 bg-slate-700 rounded-full">{status}</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-slate-600 italic">No activity yet...</p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                    <CheckCircle2 size={14} className="text-green-500" />
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
