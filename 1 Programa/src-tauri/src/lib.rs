#![cfg_attr(target_env = "msvc", allow(linker_messages))]

mod tts;

use tauri::{path::BaseDirectory, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let model_directory = app.path().resolve(
                "resources/tts/vits-piper-es_AR-daniela-high",
                BaseDirectory::Resource,
            )?;
            app.manage(tts::TtsState::new(model_directory));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tts::offline_tts_status,
            tts::synthesize_offline_speech
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Fortuna Real");
}
