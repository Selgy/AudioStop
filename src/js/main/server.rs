use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, CoCreateInstance, CLSCTX_ALL};
use windows::Win32::Media::Audio::{
    IMMDeviceEnumerator, IMMDevice, MMDeviceEnumerator, eRender, eConsole, IAudioSessionManager2,
    IAudioSessionControl, IAudioSessionEnumerator, ISimpleAudioVolume
};
use windows::core::{ComInterface, PWSTR};
use std::ptr;
use serde::{Deserialize, Serialize};
use std::{fs};
use dirs::config_dir;
use std::slice;

#[derive(Deserialize, Serialize)]
struct Config {
    applications: Vec<String>,
}

fn load_config() -> Result<Config> {
    // Get the AppData (config) directory path and use "AudioStop"
    let mut config_path = config_dir().ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?;
    config_path.push("AudioStop");
    config_path.push("config.json");

    // Create the default config if it doesn't exist
    if !config_path.exists() {
        let default_config = Config {
            applications: vec!["spotify".to_string(), "chrome".to_string()],
        };
        fs::create_dir_all(config_path.parent().unwrap())?;
        fs::write(&config_path, serde_json::to_string_pretty(&default_config)?)?;
    }

    // Read the config file
    let config_data = fs::read_to_string(&config_path)?;
    let config: Config = serde_json::from_str(&config_data)?;
    Ok(config)
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load the configuration
    let config = load_config()?;
    println!("Loaded config: {:?}", config.applications);

    // Initialize COM once when the server starts
    unsafe {
        CoInitializeEx(Some(ptr::null_mut()), windows::Win32::System::Com::COINIT_MULTITHREADED)?;
    }

    let mute_state = Arc::new(Mutex::new(false));
    let addr = "127.0.0.1:3350";
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("Server running on {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        println!("New WebSocket connection accepted");
        let mute_state = Arc::clone(&mute_state);
        let applications = config.applications.clone();

        tokio::spawn(async move {
            let ws_stream = tokio_tungstenite::accept_async(stream)
                .await
                .expect("Error during websocket handshake");
            let (_ws_sender, mut ws_receiver) = ws_stream.split();

            while let Some(msg) = ws_receiver.next().await {
                if let Ok(msg) = msg {
                    if let Message::Text(text) = msg {
                        println!("Received message: {}", text);
                        let mut state = mute_state.lock().await;
                        *state = match text.as_str() {
                            "mute" => {
                                println!("Mute command received");
                                true
                            }
                            "unmute" => {
                                println!("Unmute command received");
                                false
                            }
                            "ping" => {
                                println!("Ping received");
                                continue;
                            }
                            _ => {
                                println!("Unknown command received: {}", text);
                                continue;
                            }
                        };
                        println!("Current mute state: {}", *state);

                        let should_mute = *state;
                        let apps = applications.clone();
                        tokio::task::spawn_blocking(move || {
                            match control_audio_session(should_mute, &apps) {
                                Ok(_) => println!("Audio control successful"),
                                Err(e) => eprintln!("Error controlling audio: {:?}", e),
                            }
                        })
                        .await
                        .unwrap();
                    }
                }
            }
            println!("WebSocket connection closed");
        });
    }

    // Uninitialize COM when the server shuts down
    unsafe {
        CoUninitialize();
    }

    Ok(())
}

// Convert PWSTR (wide string pointer) to Rust String
fn pwstr_to_string(pwstr: PWSTR) -> String {
    unsafe {
        let mut len = 0;
        let mut curr = pwstr.0;
        while *curr != 0 {
            len += 1;
            curr = curr.add(1);
        }
        let slice = slice::from_raw_parts(pwstr.0, len);
        String::from_utf16_lossy(slice)
    }
}

fn control_audio_session(should_mute: bool, apps: &Vec<String>) -> Result<()> {
    unsafe {
        let device_enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let default_device: IMMDevice = device_enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let audio_session_manager: IAudioSessionManager2 = default_device.Activate(CLSCTX_ALL, Some(ptr::null_mut()))?;
        let session_enumerator: IAudioSessionEnumerator = audio_session_manager.GetSessionEnumerator()?;
        let count = session_enumerator.GetCount()?;

        for i in 0..count {
            let session_control: IAudioSessionControl = session_enumerator.GetSession(i)?;
            let pwstr_name: PWSTR = session_control.GetDisplayName()?;

            // Convert PWSTR to Rust String
            let display_name = pwstr_to_string(pwstr_name).trim().to_string();

            // Handle empty or invalid session names
            if display_name.is_empty() {
                println!("Skipping session with empty or invalid display name");
                continue;
            }

            // Only mute/unmute applications from the config
            if apps.iter().any(|app| display_name.to_lowercase().contains(app)) {
                let simple_audio_volume: ISimpleAudioVolume = session_control.cast()?;
                simple_audio_volume.SetMute(should_mute, ptr::null())?;
                println!("{} session for application: {}", if should_mute { "Muted" } else { "Unmuted" }, display_name);
            } else {
                println!("Skipping session for application: {}", display_name);
            }
        }

        Ok(())
    }
}
