// server.rs
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;
use futures_util::StreamExt;
use windows::Win32::Media::Audio::{
    ISimpleAudioVolume, IAudioSessionControl2, IMMDeviceEnumerator, IMMDevice, IAudioSessionManager2,
    MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoInitializeEx, CoUninitialize, CoCreateInstance, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::Foundation::BOOL;
use windows::core::ComInterface;
use sysinfo::{System, SystemExt, ProcessExt, Pid};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Rust server starting...");

    let mute_state = Arc::new(Mutex::new(false));

    let addr = "127.0.0.1:3350";
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("Server running on {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        println!("New WebSocket connection accepted");
        let mute_state = Arc::clone(&mute_state);
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
                        let target_processes = vec!["Spotify.exe", "Chrome.exe"];
                        println!("Current mute state: {}", *state);

                        for target_process in target_processes {
                            let target_process = target_process.to_string();
                            let mute_state = *state;
                            tokio::task::spawn_blocking(move || {
                                match control_audio(&target_process, mute_state) {
                                    Ok(_) => println!("Audio control successful for {}", target_process),
                                    Err(e) => eprintln!(
                                        "Error controlling audio for {}: {:?}",
                                        target_process, e
                                    ),
                                }
                            })
                            .await
                            .unwrap();
                        }
                    }
                }
            }
            println!("WebSocket connection closed");
        });
    }

    Ok(())
}

fn control_audio(target_process: &str, should_mute: bool) -> windows::core::Result<()> {
    println!("Attempting to control audio for process: {}", target_process);
    unsafe {
        // Initialize COM on this thread
        if let Err(e) = CoInitializeEx(Some(std::ptr::null()), COINIT_MULTITHREADED) {
            println!("Failed to initialize COM: {:?}", e);
            return Err(e);
        }
        println!("COM initialized");

        // Create device enumerator
        let device_enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        println!("Device enumerator created");

        // Get default audio device
        let default_device: IMMDevice = device_enumerator.GetDefaultAudioEndpoint(
            windows::Win32::Media::Audio::eRender,
            windows::Win32::Media::Audio::eConsole,
        )?;
        println!("Default audio device retrieved");

        // Get audio session manager
        let session_manager: IAudioSessionManager2 = default_device.cast()?;
        println!("Session manager created");

        // Get session enumerator
        let session_enumerator = session_manager.GetSessionEnumerator()?;
        println!("Session enumerator created");

        // Get number of sessions
        let session_count = session_enumerator.GetCount()?;
        println!("Total audio sessions: {}", session_count);

        // Iterate through sessions to find target process
        let mut found_any = false;
        for i in 0..session_count {
            let session: IAudioSessionControl2 = match session_enumerator.GetSession(i)?.cast() {
                Ok(s) => s,
                Err(e) => {
                    println!("Failed to cast session {}: {:?}", i, e);
                    continue;
                }
            };
            let process_id = match session.GetProcessId() {
                Ok(pid) => pid,
                Err(e) => {
                    println!("Failed to get Process ID for session {}: {:?}", i, e);
                    continue;
                }
            };

            if let Some(process_name) = get_process_name(process_id) {
                println!("Session {}: Process Name: {} (PID: {})", i, process_name, process_id);
                if process_name.to_lowercase() == target_process.to_lowercase() {
                    println!("Target process found: {}", target_process);
                    match session.cast::<ISimpleAudioVolume>() {
                        Ok(volume) => {
                            println!("ISimpleAudioVolume interface supported for {}", process_name);
                            match volume.SetMute(BOOL::from(should_mute), std::ptr::null()) {
                                Ok(_) => println!("{} mute state changed to: {}", target_process, should_mute),
                                Err(e) => println!("Failed to set mute for {}: {:?}", target_process, e),
                            }
                            found_any = true;
                        },
                        Err(e) => {
                            println!("ISimpleAudioVolume not supported for {}: {:?}", process_name, e);
                        }
                    }
                }
            }
        }

        if !found_any {
            println!("Target process not found: {}", target_process);
        }

        // Uninitialize COM before returning
        CoUninitialize();
        println!("COM uninitialized");
    }
    Ok(())
}

fn get_process_name(pid: u32) -> Option<String> {
    let mut system = System::new_all();
    system.refresh_all();
    system
        .process(Pid::from(pid as usize))
        .map(|process| {
            let name = process.name().to_string();
            println!("Process name for PID {}: {}", pid, name);
            name
        })
}
