// Background script that launches audio_control_server.exe and monitors timeline
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Import CSInterface as ES6 module
import CSInterface from '../lib/cep/CSInterface.js';

console.log('[AudioStop Background] CSInterface imported successfully');

let audioServerProcess = null;
let websocket = null;
let isPlaying = false;
let lastPosition = null;
let monitoringInterval = null;

console.log("[AudioStop Background] Starting...");

function getExtensionRootPath() {
    if (typeof window !== 'undefined' && window.__adobe_cep__) {
        return window.__adobe_cep__.getSystemPath('extension');
    } else {
        return process.cwd();
    }
}

function startAudioServer() {
    console.log("[AudioStop Background] Starting audio control server...");
    
    // Check if server is already running
    if (audioServerProcess) {
        console.log('[AudioStop Background] Audio server already running');
        return;
    }
    
    if (typeof process !== 'undefined' && process.versions != null && process.versions.node != null) {
        const extensionRoot = getExtensionRootPath();
        console.log('[AudioStop Background] Extension root path:', extensionRoot);

        let decodedPath;
        if (os.platform() === 'win32') {
            decodedPath = decodeURIComponent(extensionRoot.replace(/^file:[/\\]*/, ''));
        } else if (os.platform() === 'darwin') {
            decodedPath = '/' + decodeURIComponent(extensionRoot.replace(/^file:\/\//, ''));
        } else {
            console.error(`[AudioStop Background] Unsupported platform: ${os.platform()}`);
            return;
        }

        let audioExecutablePath;
        if (os.platform() === 'win32') {
            audioExecutablePath = path.join(decodedPath, 'exec', 'audio_control_server.exe');
        } else if (os.platform() === 'darwin') {
            audioExecutablePath = path.join(decodedPath, 'exec', 'audio_control_server');
        }
        
        audioExecutablePath = path.normalize(audioExecutablePath);
        console.log('[AudioStop Background] Audio server executable path:', audioExecutablePath);

        if (!fs.existsSync(audioExecutablePath)) {
            console.error(`[AudioStop Background] Audio server executable not found at ${audioExecutablePath}`);
            return;
        }

        // Kill any existing audio_control_server processes before starting
        const kill = require('tree-kill');
        const { execSync } = require('child_process');
        
        try {
            if (os.platform() === 'win32') {
                // Find and kill existing processes
                const tasklist = execSync('tasklist /FI "IMAGENAME eq audio_control_server.exe" /FO CSV /NH', { encoding: 'utf8' });
                if (tasklist && !tasklist.includes('INFO: No tasks')) {
                    console.log('[AudioStop Background] Killing existing audio_control_server processes...');
                    execSync('taskkill /F /IM audio_control_server.exe', { stdio: 'ignore' });
                    // Wait a bit for processes to die
                    const startTime = Date.now();
                    while (Date.now() - startTime < 1000) {
                        // Busy wait for 1 second
                    }
                }
            }
        } catch (e) {
            // Ignore errors if no process exists
        }

        audioServerProcess = spawn(audioExecutablePath, [], {
            cwd: path.dirname(audioExecutablePath),
            env: { ...process.env },
            stdio: 'ignore',
            detached: false,
            windowsHide: true
        });

        audioServerProcess.on('error', (err) => {
            console.error(`[AudioStop Background] Failed to start audio server: ${err}`);
            audioServerProcess = null;
        });

        audioServerProcess.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.error(`[AudioStop Background] Audio server process exited with code ${code}`);
            } else {
                console.log('[AudioStop Background] Audio server process exited successfully');
            }
            audioServerProcess = null;
        });

        console.log('[AudioStop Background] Audio server started successfully (PID: ' + audioServerProcess.pid + ')');
        
        // Wait 2 seconds for server to start, then connect WebSocket
        setTimeout(() => {
            connectWebSocket();
        }, 2000);
    } else {
        console.error('[AudioStop Background] This script should only be run in a Node.js environment.');
    }
}

function stopAudioServer() {
    console.log("[AudioStop Background] Stopping audio server...");
    
    // Stop monitoring
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    // Close WebSocket
    if (websocket) {
        try {
            websocket.send('shutdown');
            websocket.close();
        } catch (e) {
            console.error('[AudioStop Background] Error closing WebSocket:', e);
        }
        websocket = null;
    }
    
    // Kill process
    if (audioServerProcess) {
        const kill = require('tree-kill');
        const pid = audioServerProcess.pid;
        
        kill(pid, 'SIGTERM', (err) => {
            if (err) {
                console.error(`[AudioStop Background] Failed to kill process tree: ${err}`);
                // Force kill on Windows
                if (os.platform() === 'win32') {
                    try {
                        const { execSync } = require('child_process');
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                        console.log('[AudioStop Background] Force killed process');
                    } catch (e) {
                        console.error('[AudioStop Background] Force kill failed:', e);
                    }
                }
            } else {
                console.log('[AudioStop Background] Process tree killed');
            }
        });
        audioServerProcess = null;
    }
    
    // Also kill any remaining audio_control_server processes
    if (os.platform() === 'win32') {
        try {
            const { execSync } = require('child_process');
            execSync('taskkill /F /IM audio_control_server.exe', { stdio: 'ignore' });
            console.log('[AudioStop Background] Cleaned up any remaining processes');
        } catch (e) {
            // Ignore if no processes found
        }
    }
}

function connectWebSocket() {
    console.log('[AudioStop Background] Connecting to WebSocket...');
    
    try {
        websocket = new WebSocket('ws://localhost:3350');
        
        websocket.onopen = () => {
            console.log('[AudioStop Background] WebSocket connected');
            startTimelineMonitoring();
        };
        
        websocket.onerror = (error) => {
            console.error('[AudioStop Background] WebSocket error:', error);
        };
        
        websocket.onclose = () => {
            console.log('[AudioStop Background] WebSocket closed');
            websocket = null;
            // Retry connection after 3 seconds
            setTimeout(() => {
                if (audioServerProcess) {
                    connectWebSocket();
                }
            }, 3000);
        };
    } catch (error) {
        console.error('[AudioStop Background] Failed to create WebSocket:', error);
    }
}

function startTimelineMonitoring() {
    if (monitoringInterval) return;
    
    console.log('[AudioStop Background] Starting timeline monitoring...');
    
    // Wait for CSInterface to be loaded
    if (!CSInterface) {
        console.error('[AudioStop Background] CSInterface not loaded yet, retrying in 1 second...');
        setTimeout(startTimelineMonitoring, 1000);
        return;
    }
    
    monitoringInterval = setInterval(() => {
        if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
        
        // Get CSInterface
        const csInterface = new CSInterface();
        
        const script = `
            (function() {
                try {
                    var sequence = app.project.activeSequence;
                    if (sequence && typeof sequence.getPlayerPosition === 'function') {
                        var position = sequence.getPlayerPosition();
                        if (position) {
                            return JSON.stringify({
                                seconds: position.seconds,
                                ticks: position.ticks,
                                frameCount: position.frameCount
                            });
                        }
                    }
                    return JSON.stringify({ error: "No active sequence" });
                } catch (e) {
                    return JSON.stringify({ error: e.toString() });
                }
            })();
        `;
        
        csInterface.evalScript(script, (result) => {
            try {
                const position = JSON.parse(result);
                
                if (position.error) return;
                
                const currentPosition = position.seconds;
                
                if (lastPosition !== null) {
                    const isMoving = currentPosition > lastPosition;
                    
                    if (isMoving !== isPlaying) {
                        isPlaying = isMoving;
                        const message = isPlaying ? 'mute' : 'unmute';
                        
                        if (websocket && websocket.readyState === WebSocket.OPEN) {
                            websocket.send(message);
                            console.log(`[AudioStop Background] Sent: ${message}`);
                        }
                    }
                }
                
                lastPosition = currentPosition;
            } catch (e) {
                console.error('[AudioStop Background] Error parsing position:', e);
            }
        });
    }, 100);
}

// Start the server
startAudioServer();

// Handle extension shutdown - multiple event listeners for safety
const cleanup = () => {
    console.log('[AudioStop Background] Cleanup triggered');
    stopAudioServer();
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
    console.error('[AudioStop Background] Uncaught exception:', err);
    cleanup();
});

if (process.platform === 'win32') {
    process.on('SIGBREAK', cleanup);
}

// CEP event listeners
if (typeof window !== 'undefined' && window.__adobe_cep__) {
    window.__adobe_cep__.addEventListener('com.adobe.csxs.events.ApplicationBeforeQuit', cleanup);
    window.__adobe_cep__.addEventListener('com.adobe.csxs.events.ApplicationQuit', cleanup);
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
}

// Periodic check to ensure Premiere Pro is still running
setInterval(() => {
    if (typeof window !== 'undefined' && window.__adobe_cep__) {
        try {
            // If this fails, Premiere Pro might be closing
            const hostEnv = window.__adobe_cep__.getHostEnvironment();
            if (!hostEnv) {
                console.log('[AudioStop Background] Host environment lost, cleaning up...');
                cleanup();
            }
        } catch (e) {
            console.log('[AudioStop Background] Host check failed, cleaning up...');
            cleanup();
        }
    }
}, 5000); // Check every 5 seconds

console.log("[AudioStop Background] Initialized");

