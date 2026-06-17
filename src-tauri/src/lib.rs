// Spine — Tauri backend. Kept deliberately minimal: the model lives in SQLite
// and almost all logic lives in the web frontend (see the concept doc, §8).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
