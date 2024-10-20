import asyncio
import websockets
import logging
import threading
import time
import os
import sys
import json
import tkinter as tk
from tkinter import simpledialog
from ctypes import POINTER
from pycaw.pycaw import AudioUtilities, ISimpleAudioVolume
from comtypes import CLSCTX_ALL
import pystray
from PIL import Image
import psutil
import win32api
import win32process
import win32con
import win32gui
import inspect
import ctypes
import contextlib
import traceback

# Initialize logging
logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')

# Application path
if getattr(sys, 'frozen', False):
    application_path = sys._MEIPASS
else:
    application_path = os.path.dirname(os.path.abspath(__file__))
logging.debug(f"Application path: {application_path}")

# Determine AppData path
appdata_folder = os.getenv('APPDATA')
logging.debug(f"AppData folder: {appdata_folder}")

# Create config folder and file path
config_folder = os.path.join(appdata_folder, 'AudioStop')
logging.debug(f"Config folder: {config_folder}")
config_file_path = os.path.join(config_folder, 'config.json')
logging.debug(f"Config file path: {config_file_path}")

# Ensure the config folder exists
os.makedirs(config_folder, exist_ok=True)
logging.debug(f"Ensured config folder exists: {config_folder}")

# Load or create config file
if not os.path.exists(config_file_path):
    logging.debug(f"Config file does not exist, creating default config at {config_file_path}")
    default_config = {
        'target_processes': ['chrome.exe', 'Spotify.exe'],
        'unmute_delay_seconds': 3.0,
        'muting_enabled': True
    }
    with open(config_file_path, 'w') as config_file:
        json.dump(default_config, config_file, indent=4)
else:
    logging.debug(f"Config file already exists at {config_file_path}")

# Load config
with open(config_file_path, 'r') as config_file:
    config = json.load(config_file)
logging.debug(f"Loaded config: {config}")

# Global variables
TARGET_PROCESSES = config.get('target_processes', [])
UNMUTE_DELAY_SECONDS = config.get('unmute_delay_seconds', 3.0)
muting_enabled = config.get('muting_enabled', True)
logging.debug(f"Muting enabled: {muting_enabled}")
logging.debug(f"Unmute delay (seconds): {UNMUTE_DELAY_SECONDS}")
logging.debug(f"Target processes: {TARGET_PROCESSES}")

# Lock for thread-safe operations
state_lock = threading.Lock()
exit_event = threading.Event()

# Add the global variable to track the unmute task
unmute_task = None  # Global variable to track the unmute task

# Function to fade volume to unmute
def fade_to_unmute(volume):
    try:
        steps = 20
        sleep_time = 0.05  # Total fade time = steps * sleep_time = 1 second
        for i in range(steps):
            new_volume = (i + 1) / steps
            volume.SetMasterVolume(new_volume, None)
            time.sleep(sleep_time)
        logging.debug("Process unmuted")
    except Exception as e:
        logging.error(f"Failed to fade volume: {e}", exc_info=True)

# Function to mute specific processes instantly
def mute_target_processes():
    logging.debug("Attempting to mute target processes.")
    sessions = AudioUtilities.GetAllSessions()
    for session in sessions:
        if session.Process and session.Process.name() in TARGET_PROCESSES:
            try:
                volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                current_volume = volume.GetMasterVolume()
                if current_volume > 0.0:
                    logging.info(f"Muting {session.Process.name()} instantly")
                    volume.SetMasterVolume(0.0, None)
                else:
                    logging.debug(f"{session.Process.name()} is already muted.")
            except Exception as e:
                logging.error(f"Failed to mute {session.Process.name()}: {e}", exc_info=True)

# Function to unmute specific processes with delay and fade
async def unmute_target_processes():
    try:
        with state_lock:
            delay_seconds = UNMUTE_DELAY_SECONDS
        logging.debug(f"Delaying unmute by {delay_seconds} seconds.")
        await asyncio.sleep(delay_seconds)  # Delay unmute by specified seconds
        logging.debug("Attempting to unmute target processes.")
        sessions = AudioUtilities.GetAllSessions()
        for session in sessions:
            if session.Process and session.Process.name() in TARGET_PROCESSES:
                try:
                    volume = session._ctl.QueryInterface(ISimpleAudioVolume)
                    current_volume = volume.GetMasterVolume()
                    if current_volume == 0.0:
                        logging.info(f"Unmuting {session.Process.name()} with fade")
                        fade_to_unmute(volume)  # Fade volume to unmute
                    else:
                        logging.debug(f"{session.Process.name()} is already unmuted.")
                except Exception as e:
                    logging.error(f"Failed to unmute {session.Process.name()}: {e}", exc_info=True)
    except asyncio.CancelledError:
        logging.debug("Unmute task was cancelled before completion")
    except Exception as e:
        logging.error(f"Error in unmute_target_processes: {e}", exc_info=True)

# WebSocket server handler
async def handler(websocket, path):
    global unmute_task  # Declare unmute_task as global
    logging.info("Client connected")
    try:
        async for message in websocket:
            logging.info(f"Received message: {message}")
            with state_lock:
                current_muting_enabled = muting_enabled

            if not current_muting_enabled:
                logging.info("Muting is disabled, ignoring message")
                continue

            if message == 'mute':
                # Cancel any pending unmute task
                if unmute_task and not unmute_task.done():
                    unmute_task.cancel()
                    logging.debug("Canceled pending unmute task")
                mute_target_processes()

            elif message == 'unmute':
                # Cancel any pending unmute task
                if unmute_task and not unmute_task.done():
                    unmute_task.cancel()
                    logging.debug("Canceled previous unmute task")
                # Schedule a new unmute task
                unmute_task = asyncio.create_task(unmute_target_processes())

            else:
                logging.warning(f"Unknown message received: {message}")

    except asyncio.CancelledError:
        logging.info("Handler task was cancelled")
    except websockets.exceptions.ConnectionClosed as e:
        logging.info("Client disconnected")
    except Exception as e:
        logging.error(f"Error in WebSocket handler: {e}", exc_info=True)

# Function to run the system tray icon
def run_tray_icon():
    def on_toggle_mute(icon, item):
        global muting_enabled
        with state_lock:
            muting_enabled = not muting_enabled
            logging.info(f"Muting enabled set to {muting_enabled}")
            # Update the config file
            config['muting_enabled'] = muting_enabled
            with open(config_file_path, 'w') as config_file:
                json.dump(config, config_file, indent=4)
        # Update the menu text
        update_menu(icon)

    def on_set_unmute_delay(icon, item):
        global UNMUTE_DELAY_SECONDS
        # Open a dialog to input unmute delay
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        root.attributes('-topmost', True)  # Bring the dialog to the front
        try:
            new_delay = simpledialog.askfloat("Set Unmute Delay",
                                              "Enter unmute delay in seconds:",
                                              minvalue=0.0,
                                              initialvalue=UNMUTE_DELAY_SECONDS)
            if new_delay is not None:
                with state_lock:
                    UNMUTE_DELAY_SECONDS = new_delay
                    logging.info(f"Unmute delay set to {UNMUTE_DELAY_SECONDS} seconds")
                    # Update the config file
                    config['unmute_delay_seconds'] = UNMUTE_DELAY_SECONDS
                    with open(config_file_path, 'w') as config_file:
                        json.dump(config, config_file, indent=4)
        except Exception as e:
            logging.error(f"Failed to set unmute delay: {e}", exc_info=True)
        finally:
            root.destroy()

    def on_edit_muted_apps(icon, item):
        global TARGET_PROCESSES
        # Open a dialog to input target processes
        root = tk.Tk()
        root.withdraw()  # Hide the main window
        root.attributes('-topmost', True)  # Bring the dialog to the front
        try:
            current_apps = ', '.join(TARGET_PROCESSES)
            new_apps = simpledialog.askstring("Edit Muted Applications",
                                              "Enter process names separated by commas:",
                                              initialvalue=current_apps)
            if new_apps is not None:
                new_apps_list = [app.strip() for app in new_apps.split(',') if app.strip()]
                with state_lock:
                    TARGET_PROCESSES = new_apps_list
                    logging.info(f"Target processes updated: {TARGET_PROCESSES}")
                    # Update the config file
                    config['target_processes'] = TARGET_PROCESSES
                    with open(config_file_path, 'w') as config_file:
                        json.dump(config, config_file, indent=4)
        except Exception as e:
            logging.error(f"Failed to edit muted applications: {e}", exc_info=True)
        finally:
            root.destroy()

    def on_exit(icon, item):
        logging.info("Exiting application")
        icon.stop()
        exit_event.set()

    def update_menu(icon):
        with state_lock:
            enabled = muting_enabled
        if enabled:
            mute_toggle_text = 'Disable muting'
        else:
            mute_toggle_text = 'Enable muting'
        icon.menu = pystray.Menu(
            pystray.MenuItem(mute_toggle_text, on_toggle_mute),
            pystray.MenuItem('Set unmute delay', on_set_unmute_delay),
            pystray.MenuItem('Edit muted applications', on_edit_muted_apps),
            pystray.MenuItem('Exit', on_exit)
        )

    # Load icon.ico if it exists
    icon_path = os.path.join(application_path, 'icon.ico')
    if os.path.exists(icon_path):
        image = Image.open(icon_path)
        logging.debug(f"Loaded tray icon from {icon_path}")
    else:
        # Create a simple icon if icon.ico doesn't exist
        image = Image.new('RGB', (64, 64), "white")
        logging.debug("Using default tray icon")

    # Create the icon
    icon = pystray.Icon("AudioStop", image, "AudioStop")
    update_menu(icon)
    icon.run()

# Start the tray icon in a separate thread
def start_tray_icon():
    tray_thread = threading.Thread(target=run_tray_icon, daemon=True)
    tray_thread.start()

# Function to wait for the exit event
async def wait_for_exit_event():
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, exit_event.wait)

# Main async function
async def main():
    try:
        # Start the server
        server = await websockets.serve(handler, 'localhost', 3350)
        logging.info("WebSocket server started on ws://localhost:3350")
        await wait_for_exit_event()
        logging.info("Exit event received, shutting down server")
        server.close()
        await server.wait_closed()
    except Exception as e:
        logging.error(f"Failed to start WebSocket server: {e}", exc_info=True)

if __name__ == "__main__":
    try:
        start_tray_icon()
        asyncio.run(main())
    except Exception as e:
        logging.error(f"Unexpected error in main: {e}", exc_info=True)
