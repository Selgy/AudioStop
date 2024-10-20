use anyhow::Result;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, CoCreateInstance, CLSCTX_ALL};
use windows::Win32::Media::Audio::{
    IMMDeviceEnumerator, IMMDevice, MMDeviceEnumerator, eRender, eConsole, IAudioSessionManager2,
    IAudioSessionControl, IAudioSessionEnumerator, ISimpleAudioVolume, IAudioSessionControl2
};
use windows::core::Interface;  // Correct use of Interface and casting
use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use windows::Win32::System::ProcessStatus::GetProcessImageFileNameW;
use std::ptr;
use serde::{Deserialize, Serialize};
use std::{fs};
use dirs::config_dir;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

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
            applications: vec!["spotify".to_string(), "chrome".to_string(), "brave".to_string(), "edge".to_string()],
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

// Helper function to get the process name from the process ID
fn get_process_name_from_pid(pid: u32) -> String {
    unsafe {
        let process_handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid).unwrap();
        let mut image_name = vec![0; 1024];
        let length = GetProcessImageFileNameW(process_handle, &mut image_name) as usize;

        // Close the process handle
        let _ = windows::Win32::Foundation::CloseHandle(process_handle);

        if length > 0 {
            // Convert the wide string to a Rust string and return only the executable name (last part of the path)
            let os_string = OsString::from_wide(&image_name[..length]);
            let process_path = os_string.to_string_lossy().to_string();
            return process_path.split('\\').last().unwrap_or("").to_string();
        }

        String::new()  // Return empty string if no process name found
    }
}

fn control_audio_session(should_mute: bool, apps: &Vec<String>) -> Result<()> {
    unsafe {
        let device_enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let default_device: IMMDevice = device_enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;

        // Manually activate the IAudioSessionManager2 interface using the COM method
        let audio_session_manager: IAudioSessionManager2 = activate_audio_session_manager(&default_device)?;

        let session_enumerator = audio_session_manager.GetSessionEnumerator()?;
        let count = session_enumerator.GetCount()?;

        for i in 0..count {
            let session_control = session_enumerator.GetSession(i)?;
            let session_control2: IAudioSessionControl2 = session_control.cast()?;  // Use the `cast` method correctly

            // Get the process ID associated with the session
            let pid = session_control2.GetProcessId()?;
            let process_name = get_process_name_from_pid(pid);

            if process_name.is_empty() {
                println!("Skipping session with empty or invalid process name");
                continue;
            }

            println!("Detected process: {}", process_name);

            // Check if the process matches any of the applications from the config
            if apps.iter().any(|app| process_name.to_lowercase().contains(app)) {
                let simple_audio_volume: ISimpleAudioVolume = session_control.cast()?;  // Use `cast` method here as well
                simple_audio_volume.SetMute(should_mute, ptr::null())?;
                println!("{} session for application: {}", if should_mute { "Muted" } else { "Unmuted" }, process_name);
            } else {
                println!("Skipping session for application: {}", process_name);
            }
        }

        Ok(())
    }
}

// Manual activation of IAudioSessionManager2 using COM interface
fn activate_audio_session_manager(device: &IMMDevice) -> Result<IAudioSessionManager2> {
    unsafe {
        let mut session_manager: Option<IAudioSessionManager2> = None;
        let hr = device.as_raw().Activate(
            &IAudioSessionManager2::IID,
            CLSCTX_ALL,
            std::ptr::null_mut(),
            &mut session_manager as *mut _ as *mut _,
        );

        if hr.is_err() {
            return Err(anyhow::anyhow!("Failed to activate IAudioSessionManager2"));
        }

        Ok(session_manager.unwrap())
    }
}
