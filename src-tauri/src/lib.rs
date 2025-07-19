use std::ptr;
use tauri::Manager;
use crate::kill_process::kill_process;
use crate::list_process::{auto_respawn, batch_set_priority, kill_and_restart, list_processes, pid_to_proc, restart_process, stop_auto_respawn};
use crate::list_process::set_process_priority;
use crate::kill_process::batch_kill_processes;
mod list_process;
mod kill_process;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| { // 'app' here is a short-lived reference
            // Get the AppHandle from the app reference
            let app_handle = app.handle();

            // CLONE THE APP_HANDLE HERE before managing it.
            // This creates a new AppHandle instance that is 'static
            // and can be safely managed by the application's global state.
            app.manage(app_handle.clone()); // <--- The fix is .clone() here!

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_processes,
            batch_kill_processes,
            set_process_priority,
            kill_process,
            auto_respawn,
            kill_and_restart,
            restart_process,
            stop_auto_respawn,
            batch_set_priority,
            set_process_limits,
            pid_to_proc
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
use serde::Deserialize;
use thiserror::Error;
use windows::core::imp::HANDLE;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::JobObjects::{AssignProcessToJobObject, JobObjectExtendedLimitInformation, SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_PROCESS_MEMORY};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_ALL_ACCESS};

#[derive(Debug, Deserialize)]
struct ProcessLimits {
    pid: u32,
    max_memory_mb: Option<u64>,
    max_open_files: Option<u64>,
}

#[tauri::command]
async fn set_process_limits(limits: ProcessLimits) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        set_process_limits_linux(limits).map_err(|e| e.to_string())
    }

    #[cfg(target_os = "windows")]
    {
        set_process_limits_windows(limits).map_err(|e| e.to_string())
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Err("Unsupported platform".to_string())
    }
}
#[cfg(target_os = "linux")]
fn set_process_limits_linux(limits: ProcessLimits) -> Result<(), LimitsError> {
    use nix::sys::resource::{Resource, setrlimit, Rlim};

    if let Some(mem_mb) = limits.max_memory_mb {
        let mem_bytes = mem_mb * 1024 * 1024;
        setrlimit(Resource::RLIMIT_AS, Rlim::from_raw(mem_bytes), Rlim::from_raw(mem_bytes))?;
    }

    if let Some(files) = limits.max_open_files {
        setrlimit(Resource::RLIMIT_NOFILE, Rlim::from_raw(files), Rlim::from_raw(files))?;
    }

    // If you want to do per-PID specifically, can use `prlimit` via libc/syscall or run `prlimit` cmd.

    Ok(())
}
#[cfg(target_os = "windows")]
fn set_process_limits_windows(limits: ProcessLimits) -> Result<(), String> {
    use windows::Win32::System::JobObjects::CreateJobObjectW;
    unsafe {
        let job = CreateJobObjectW(None, None);
        if job.is_err() {
            return Err("CreateJobObject failed".into());
        }

        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        if let Some(mem_mb) = limits.max_memory_mb {
            info.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_PROCESS_MEMORY;
            info.ProcessMemoryLimit = (mem_mb * 1024 * 1024) as usize;
        }
        let job = job.unwrap();
        let ok = SetInformationJobObject(
            job.clone(),
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );

        if !ok.is_ok() {
            return Err("SetInformationJobObject failed".into());
        }

        let h_process = OpenProcess(PROCESS_ALL_ACCESS, false, limits.pid);
        if h_process.is_err() {
            return Err("OpenProcess failed".into());
        }

        if !AssignProcessToJobObject(job.clone(), h_process.unwrap()).is_ok() {
            return Err("AssignProcessToJobObject failed".into());
        }
    }

    Ok(())
}
