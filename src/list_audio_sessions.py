"""
Utility script to list all audio sessions
Useful for finding process names to add to the config
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pycaw.pycaw import AudioUtilities
import comtypes

def list_audio_sessions():
    """List all active audio sessions"""
    print("=" * 60)
    print("AudioStop - Liste des Sessions Audio Actives")
    print("=" * 60)
    print()
    
    comtypes.CoInitialize()
    try:
        sessions = AudioUtilities.GetAllSessions()
        
        active_sessions = []
        for session in sessions:
            if session.Process:
                volume = session.SimpleAudioVolume
                current_volume = volume.GetMasterVolume()
                is_muted = volume.GetMute()
                
                active_sessions.append({
                    'name': session.Process.name(),
                    'pid': session.Process.pid,
                    'volume': current_volume,
                    'muted': is_muted
                })
        
        if not active_sessions:
            print("Aucune session audio active trouvée.")
            print()
            print("Astuce: Lancez une application avec du son")
            print("        (ex: Chrome, Spotify, YouTube)")
        else:
            print(f"Trouvé {len(active_sessions)} session(s) audio:\n")
            
            for i, session in enumerate(active_sessions, 1):
                print(f"{i}. {session['name']}")
                print(f"   PID:    {session['pid']}")
                print(f"   Volume: {session['volume']:.0%}")
                print(f"   Muted:  {'Oui' if session['muted'] else 'Non'}")
                print()
            
            print("-" * 60)
            print("\nPour ajouter une application à AudioStop:")
            print("1. Copiez le nom du processus (ex: chrome.exe)")
            print("2. Faites un clic droit sur l'icône système tray")
            print("3. Sélectionnez 'Edit muted applications'")
            print("4. Ajoutez le nom du processus")
            
    except Exception as e:
        print(f"Erreur: {e}")
    finally:
        comtypes.CoUninitialize()
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    list_audio_sessions()
    input("\nAppuyez sur Entrée pour fermer...")

