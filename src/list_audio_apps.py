#!/usr/bin/env python3
"""
Utility script to list all applications currently playing audio
"""
import json
import sys
from pycaw.pycaw import AudioUtilities
import comtypes
import psutil

def get_audio_applications():
    """Get list of applications currently playing audio"""
    comtypes.CoInitialize()
    try:
        sessions = AudioUtilities.GetAllSessions()
        audio_apps = []
        seen_processes = set()
        
        # List of processes to ignore
        ignored_processes = [
            'audiodg.exe', 
            'System', 
            'svchost.exe',
            'Adobe Premiere Pro.exe',
            'AfterFX.exe',
            'Photoshop.exe'
        ]
        
        # Priority apps (will be sorted first)
        priority_apps = [
            'Spotify.exe',
            'chrome.exe',
            'firefox.exe',
            'msedge.exe',
            'brave.exe',
            'opera.exe',
            'Discord.exe',
            'Deezer.exe',
            'iTunes.exe',
            'vlc.exe',
            'AIMP.exe',
            'foobar2000.exe'
        ]
        
        for session in sessions:
            if session.Process and session.Process.name():
                process_name = session.Process.name()
                
                # Skip ignored processes and duplicates
                if process_name not in seen_processes and process_name not in ignored_processes:
                    try:
                        # Get process info
                        process = psutil.Process(session.Process.pid)
                        
                        # Determine priority
                        is_priority = process_name in priority_apps
                        
                        audio_apps.append({
                            'name': process_name,
                            'exe': process_name,
                            'fullPath': process.exe() if hasattr(process, 'exe') else '',
                            'pid': session.Process.pid,
                            'priority': is_priority
                        })
                        seen_processes.add(process_name)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
        
        # Sort: priority apps first, then alphabetically
        audio_apps.sort(key=lambda x: (not x['priority'], x['name'].lower()))
        
        return audio_apps
    finally:
        comtypes.CoUninitialize()

if __name__ == '__main__':
    try:
        apps = get_audio_applications()
        # Output as JSON
        print(json.dumps({'success': True, 'apps': apps}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

