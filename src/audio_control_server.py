import asyncio
import websockets
import json
import os
import logging
from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
import sys

# Initialize logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG to capture all levels of log messages
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Path to AppData config file
APP_NAME = 'AudioStop'
CONFIG_FILE_NAME = 'config.json'

if sys.platform == 'win32':
    appdata_folder = os.getenv('APPDATA')  # Typically C:\Users\username\AppData\Roaming
else:
    appdata_folder = os.path.expanduser("~/.config")

logging.debug(f"AppData folder: {appdata_folder}")
config_folder = os.path.join(appdata_folder, APP_NAME)
config_file_path = os.path.join(config_folder, CONFIG_FILE_NAME)
logging.debug(f"Config folder: {config_folder}")
logging.debug(f"Config file path: {config_file_path}")

# Ensure config folder exists
try:
    os.makedirs(config_folder, exist_ok=True)
    logging.debug(f"Ensured config folder exists: {config_folder}")
except Exception as e:
    logging.error(f"Failed to create config folder: {e}", exc_info=True)

# Default config
default_config = {
    "target_processes": ["chrome.exe", "Spotify.exe"]
}

# Load or create config file
if not os.path.isfile(config_file_path):
    # Create default config file
    try:
        with open(config_file_path, 'w') as config_file:
            json.dump(default_config, config_file, indent=4)
            logging.info(f"Created default config file at {config_file_path}")
    except Exception as e:
        logging.error(f"Failed to create config file: {e}", exc_info=True)
else:
    logging.debug(f"Config file already exists at {config_file_path}")

# Load config
try:
    with open(config_file_path, 'r') as config_file:
        config = json.load(config_file)
        logging.debug(f"Loaded config: {config}")
except Exception as e:
    logging.error(f"Failed to load config file: {e}", exc_info=True)
    config = default_config  # Fallback to default config

TARGET_PROCESSES = config.get("target_processes", [])
logging.debug(f"Target processes: {TARGET_PROCESSES}")

# Function to mute specific processes
def mute_target_processes():
    logging.debug("Attempting to mute target processes.")
    sessions = AudioUtilities.GetAllSessions()
    for session in sessions:
        if session.Process and session.Process.name() in TARGET_PROCESSES:
            try:
                volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                current_volume = volume.GetMasterVolume()
                if current_volume > 0.0:
                    logging.info(f"Muting {session.Process.name()}")
                    volume.SetMasterVolume(0.0, None)  # Mute the process
                else:
                    logging.debug(f"{session.Process.name()} is already muted.")
            except Exception as e:
                logging.error(f"Failed to mute {session.Process.name()}: {e}", exc_info=True)

# Function to unmute specific processes
def unmute_target_processes():
    logging.debug("Attempting to unmute target processes.")
    sessions = AudioUtilities.GetAllSessions()
    for session in sessions:
        if session.Process and session.Process.name() in TARGET_PROCESSES:
            try:
                volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                current_volume = volume.GetMasterVolume()
                if current_volume == 0.0:
                    logging.info(f"Unmuting {session.Process.name()}")
                    volume.SetMasterVolume(1.0, None)  # Unmute the process
                else:
                    logging.debug(f"{session.Process.name()} is already unmuted.")
            except Exception as e:
                logging.error(f"Failed to unmute {session.Process.name()}: {e}", exc_info=True)

# WebSocket server handler
async def handler(websocket, path):
    logging.info("Client connected")
    try:
        async for message in websocket:
            logging.info(f"Received message: {message}")
            if message == 'mute':
                mute_target_processes()
            elif message == 'unmute':
                unmute_target_processes()
            else:
                logging.warning(f"Unknown message received: {message}")
    except websockets.exceptions.ConnectionClosed as e:
        logging.info("Client disconnected")
    except Exception as e:
        logging.error(f"Error in WebSocket handler: {e}", exc_info=True)

# Start the WebSocket server
async def main():
    try:
        server = await websockets.serve(handler, 'localhost', 3350)
        logging.info("WebSocket server started on ws://localhost:3350")
        await server.wait_closed()
    except Exception as e:
        logging.error(f"Failed to start WebSocket server: {e}", exc_info=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logging.error(f"Unexpected error in main: {e}", exc_info=True)
