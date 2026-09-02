// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![cfg_attr(target_env = "msvc", allow(linker_messages))]

fn main() {
    fortuna_real_lib::run()
}
