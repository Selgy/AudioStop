import asyncio
import websockets
import logging
import threading
import time
import os
import sys
import json
from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
import comtypes
import psutil

# Initialize logging with better formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)

# Application path
if getattr(sys, 'frozen', False):
    application_path = sys._MEIPASS
else:
    application_path = os.path.dirname(os.path.abspath(__file__))

# Determine AppData path
appdata_folder = os.getenv('APPDATA')
config_folder = os.path.join(appdata_folder, 'AudioStop')
config_file_path = os.path.join(config_folder, 'config.json')

# Ensure the config folder exists
os.makedirs(config_folder, exist_ok=True)
logging.info(f"Config folder: {config_folder}")

# Load or create config file
if not os.path.exists(config_file_path):
    logging.info("Creating default config file")
    default_config = {
        'target_processes': ['chrome.exe', 'Spotify.exe', 'firefox.exe', 'msedge.exe'],
        'unmute_delay_seconds': 3.0,
        'muting_enabled': True
    }
    with open(config_file_path, 'w') as config_file:
        json.dump(default_config, config_file, indent=4)

# Load config
with open(config_file_path, 'r') as config_file:
    config = json.load(config_file)

# Global variables
TARGET_PROCESSES = config.get('target_processes', [])
UNMUTE_DELAY_SECONDS = config.get('unmute_delay_seconds', 3.0)
muting_enabled = config.get('muting_enabled', True)

logging.info(f"AudioStop Server Started")
logging.info(f"Muting enabled: {muting_enabled}")
logging.info(f"Unmute delay: {UNMUTE_DELAY_SECONDS}s")
logging.info(f"Target processes: {', '.join(TARGET_PROCESSES)}")

# Lock for thread-safe operations
state_lock = threading.Lock()
exit_event = threading.Event()

# Global variable to track the unmute task
unmute_task = None

# Function to initialize COM, run a function, and uninitialize COM
def com_wrapper(func, *args, **kwargs):
    """Thread-safe COM wrapper"""
    comtypes.CoInitialize()
    try:
        result = func(*args, **kwargs)
    finally:
        comtypes.CoUninitialize()
    return result

# Function to fade volume to unmute
async def fade_to_unmute(volume):
    """Smoothly unmute audio with fade effect"""
    try:
        steps = 20
        sleep_time = 0.02  # Total fade time = 0.4 seconds
        for i in range(steps):
            new_volume = (i + 1) / steps
            await asyncio.to_thread(com_wrapper, volume.SetMasterVolume, new_volume, None)
            await asyncio.sleep(sleep_time)
    except Exception as e:
        logging.error(f"Failed to fade volume: {e}")

# Function to mute specific processes instantly
async def mute_target_processes():
    """Instantly mute all configured applications"""
    try:
        sessions = await asyncio.to_thread(com_wrapper, AudioUtilities.GetAllSessions)
        muted_count = 0
        
        for session in sessions:
            if session.Process and session.Process.name() in TARGET_PROCESSES:
                try:
                    volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                    current_volume = await asyncio.to_thread(com_wrapper, volume.GetMasterVolume)
                    if current_volume > 0.0:
                        await asyncio.to_thread(com_wrapper, volume.SetMasterVolume, 0.0, None)
                        muted_count += 1
                        logging.info(f"✓ Muted {session.Process.name()}")
                except Exception as e:
                    logging.error(f"Failed to mute {session.Process.name()}: {e}")
        
        if muted_count > 0:
            logging.info(f"Muted {muted_count} application(s)")
    except Exception as e:
        logging.error(f"Error in mute_target_processes: {e}")

# Function to unmute specific processes with delay and fade
async def unmute_target_processes():
    """Unmute all configured applications after delay"""
    try:
        with state_lock:
            delay_seconds = UNMUTE_DELAY_SECONDS
        
        logging.info(f"Unmuting in {delay_seconds}s...")
        await asyncio.sleep(delay_seconds)
        
        if exit_event.is_set():
            return
        
        sessions = await asyncio.to_thread(com_wrapper, AudioUtilities.GetAllSessions)
        unmuted_count = 0
        
        for session in sessions:
            if session.Process and session.Process.name() in TARGET_PROCESSES:
                try:
                    volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                    current_volume = await asyncio.to_thread(com_wrapper, volume.GetMasterVolume)
                    if current_volume == 0.0:
                        await fade_to_unmute(volume)
                        unmuted_count += 1
                        logging.info(f"✓ Unmuted {session.Process.name()}")
                except Exception as e:
                    logging.error(f"Failed to unmute {session.Process.name()}: {e}")
        
        if unmuted_count > 0:
            logging.info(f"Unmuted {unmuted_count} application(s)")
    except asyncio.CancelledError:
        logging.debug("Unmute cancelled")
    except Exception as e:
        logging.error(f"Error in unmute_target_processes: {e}")

async def get_audio_applications():
    """Get list of applications currently playing audio"""
    try:
        sessions = await asyncio.to_thread(com_wrapper, AudioUtilities.GetAllSessions)
        audio_apps = []
        seen_processes = set()
        
        for session in sessions:
            if session.Process and session.Process.name():
                process_name = session.Process.name()
                # Skip system processes and duplicates
                if process_name not in seen_processes and process_name not in ['audiodg.exe', 'System', 'svchost.exe']:
                    try:
                        # Get process info
                        process = psutil.Process(session.Process.pid)
                        audio_apps.append({
                            'name': process_name,
                            'exe': process_name,
                            'fullPath': process.exe() if hasattr(process, 'exe') else '',
                            'pid': session.Process.pid
                        })
                        seen_processes.add(process_name)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
        
        return audio_apps
    except Exception as e:
        logging.error(f"Error getting audio applications: {e}")
        return []

async def handler(websocket):
    """WebSocket message handler"""
    global unmute_task, muting_enabled, UNMUTE_DELAY_SECONDS, TARGET_PROCESSES
    logging.info("✓ Client connected")
    
    try:
        async for message in websocket:
            # Try to parse as JSON for config updates
            try:
                data = json.loads(message)
                
                # Handle request for audio applications list
                if data.get('type') == 'get_audio_apps':
                    audio_apps = await get_audio_applications()
                    await websocket.send(json.dumps({
                        'type': 'audio_apps_list',
                        'apps': audio_apps,
                        'current_targets': TARGET_PROCESSES
                    }))
                    continue
                
                # Handle config updates
                if data.get('type') == 'update_config':
                    with state_lock:
                        if 'muting_enabled' in data:
                            muting_enabled = data['muting_enabled']
                            logging.info(f"Muting enabled set to: {muting_enabled}")
                        
                        if 'unmute_delay_seconds' in data:
                            UNMUTE_DELAY_SECONDS = float(data['unmute_delay_seconds'])
                            logging.info(f"Unmute delay set to: {UNMUTE_DELAY_SECONDS}s")
                        
                        if 'target_processes' in data:
                            TARGET_PROCESSES = data['target_processes']
                            logging.info(f"Target processes set to: {', '.join(TARGET_PROCESSES)}")
                        
                        # Save to config file
                        config['muting_enabled'] = muting_enabled
                        config['unmute_delay_seconds'] = UNMUTE_DELAY_SECONDS
                        config['target_processes'] = TARGET_PROCESSES
                        
                        with open(config_file_path, 'w') as config_file:
                            json.dump(config, config_file, indent=4)
                        
                        logging.info("Configuration saved")
                    
                    # Send confirmation
                    await websocket.send(json.dumps({'type': 'config_updated', 'success': True}))
                    continue
                    
            except json.JSONDecodeError:
                # Not JSON, treat as simple command
                pass
            
            with state_lock:
                current_muting_enabled = muting_enabled

            if message == 'shutdown':
                logging.info("Shutdown command received")
                exit_event.set()
                break

            if not current_muting_enabled:
                continue

            if message == 'mute':
                # Cancel any pending unmute task
                if unmute_task and not unmute_task.done():
                    unmute_task.cancel()
                await mute_target_processes()

            elif message == 'unmute':
                # Cancel any pending unmute task
                if unmute_task and not unmute_task.done():
                    unmute_task.cancel()
                # Schedule a new unmute task
                unmute_task = asyncio.create_task(unmute_target_processes())

    except asyncio.CancelledError:
        logging.info("Handler cancelled")
    except websockets.exceptions.ConnectionClosed:
        logging.info("✗ Client disconnected")
        exit_event.set()
    except Exception as e:
        logging.error(f"Error in handler: {e}")

async def wait_for_exit_event():
    """Wait for exit event"""
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, exit_event.wait)

def monitor_parent():
    """Monitor parent process and exit if it dies"""
    parent_pid = os.getppid()
    logging.info(f"Monitoring parent process (PID: {parent_pid})")
    
    try:
        parent_process = psutil.Process(parent_pid)
    except psutil.NoSuchProcess:
        logging.info("Parent process not found, exiting")
        exit_event.set()
        return

    while not exit_event.is_set():
        if not parent_process.is_running():
            logging.info("Parent process terminated, exiting")
            exit_event.set()
            break
        time.sleep(2)

async def main():
    """Main async entry point"""
    try:
        # Start the WebSocket server
        server = await websockets.serve(handler, 'localhost', 3350)
        logging.info("✓ WebSocket server running on ws://localhost:3350")

        # Wait for exit event
        await wait_for_exit_event()
        
        logging.info("Shutting down server...")
        server.close()
        await server.wait_closed()

        # Cancel all pending tasks
        pending = asyncio.all_tasks()
        for task in pending:
            if task is not asyncio.current_task():
                task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

        logging.info("✓ AudioStop stopped")
    except Exception as e:
        logging.error(f"Error in main: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        # Start parent process monitor
        parent_monitor_thread = threading.Thread(target=monitor_parent, daemon=True)
        parent_monitor_thread.start()

        # Run main async loop
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Interrupted by user")
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)


# Build command:
# pyinstaller --onefile --windowed --add-data "icon.ico;." --icon=icon.ico audio_control_server.py