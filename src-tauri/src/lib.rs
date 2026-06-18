// Spine — Tauri backend. Kept deliberately minimal: the model lives in SQLite
// and almost all logic lives in the web frontend (see the concept doc, §8).
// The two file commands back Save/Open at a user-chosen path (picked via the
// dialog plugin); writing arbitrary paths this way avoids fs-plugin scoping.

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
