const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let audioServerProcess = null;

function startAudioServer() {
    console.log("Starting audio control server...");
    if (typeof process !== 'undefined' && process.versions != null && process.versions.node != null) {
        console.log("Node.js environment detected. Node version:", process.version);
        const extensionRoot = getExtensionRootPath();
        console.log('Extension root path:', extensionRoot);

        let decodedPath;
        if (process.platform === 'win32') {
            decodedPath = decodeURIComponent(extensionRoot.replace(/^file:[/\\]*/, ''));
        } else if (process.platform === 'darwin') {
            decodedPath = '/' + decodeURIComponent(extensionRoot.replace(/^file:\/\//, ''));
        } else {
            console.error(`Unsupported platform: ${process.platform}`);
            return;
        }
        console.log('Decoded Extension Root Path:', decodedPath);

        let audioExecutablePath;
        if (process.platform === 'win32') {
            audioExecutablePath = path.join(decodedPath, 'dist', 'audio_control_server.exe');
        } else if (process.platform === 'darwin') {
            audioExecutablePath = path.join(decodedPath, 'dist', 'audio_control_server');
        } else {
            console.error(`Unsupported platform: ${process.platform}`);
            return;
        }
        audioExecutablePath = path.normalize(audioExecutablePath);
        console.log('Audio server executable path:', audioExecutablePath);

        if (!fs.existsSync(audioExecutablePath)) {
            console.error(`Audio server executable not found at ${audioExecutablePath}`);
            return;
        }

        audioServerProcess = spawn(audioExecutablePath, [], {
            cwd: path.dirname(audioExecutablePath),
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        audioServerProcess.stdout.on('data', (data) => {
            console.log(`Audio server stdout: ${data.toString().trim()}`);
        });

        audioServerProcess.stderr.on('data', (data) => {
            console.error(`Audio server stderr: ${data.toString().trim()}`);
        });

        audioServerProcess.on('error', (err) => {
            console.error(`Failed to start audio server: ${err}`);
        });

        audioServerProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Audio server process exited with code ${code}`);
            } else {
                console.log('Audio server process exited successfully');
            }
            audioServerProcess = null;
        });
    } else {
        console.error('This script should only be run in a Node.js environment.');
    }
}

function stopAudioServer() {
    if (audioServerProcess) {
        console.log("Stopping audio server...");
        audioServerProcess.kill();
        audioServerProcess = null;
    }
}

function getExtensionRootPath() {
    if (typeof window !== 'undefined' && window.__adobe_cep__) {
        return window.__adobe_cep__.getSystemPath('extension');
    } else {
        // Fallback for development environment
        return process.cwd();
    }
}

console.log("Background script loaded. Starting audio server...");
startAudioServer();

// Handle extension shutdown
process.on('exit', stopAudioServer);
process.on('SIGINT', stopAudioServer);
process.on('SIGTERM', stopAudioServer);

// For Windows, handle the SIGBREAK signal
if (process.platform === 'win32') {
    process.on('SIGBREAK', stopAudioServer);
}

// If we're in the Adobe CEP environment, use its event system
if (typeof window !== 'undefined' && window.__adobe_cep__) {
    window.__adobe_cep__.addEventListener('com.adobe.csxs.events.ApplicationBeforeQuit', stopAudioServer);
    window.__adobe_cep__.addEventListener('com.adobe.csxs.events.WindowVisibilityChanged', (event) => {
        if (event.data === 'false') {
            // Window is being hidden or closed
            stopAudioServer();
        }
    });
}
