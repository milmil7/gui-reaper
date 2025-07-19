use std::path::Path;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::{panic, thread};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use lazy_static::lazy_static;
use serde::Serialize;
use sysinfo::{System, Pid, ProcessesToUpdate, DiskUsage};

#[derive(Serialize)]
pub struct ProcessInfo {
    pid: u32,
    name: String,
    cmd: String,
    cpu: f32,
    memory: f64,
    uptime: u64,
    parent_pid: Option<u32>,
    children: Vec<u32>,
    exe: String,
    read_bytes:u64,
    written_bytes:u64,
    total_read_bytes:u64,
    total_written_bytes:u64,
}

lazy_static::lazy_static! {
    static ref SYS: Arc<Mutex<System>> = Arc::new(Mutex::new(System::new_all()));
}

#[tauri::command]
pub async fn list_processes() -> Vec<ProcessInfo> {
    let sys_clone = SYS.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut sys = sys_clone.lock().unwrap();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        // sleep NOT needed anymore because we keep state
        // just call refresh multiple times

        let mut processes = vec![];

        for (pid, process) in sys.processes() {
            let disk = process.disk_usage();
            let read_bytes = disk.read_bytes;
            let written_bytes = disk.written_bytes;
            let total_read_bytes = disk.total_read_bytes;
            let total_written_bytes = disk.total_written_bytes;
            processes.push(ProcessInfo {
                pid: pid.as_u32(),
                               name: process.name().to_str().unwrap().to_string(),
                               cmd: process.cmd().join(" ".as_ref()).into_string().unwrap(),
                               cpu: process.cpu_usage(),
                               memory: process.memory() as f64 / 1024.0,
                               uptime: process.run_time(),
                               exe: process.exe().unwrap_or(Path::new("")).to_str().unwrap().to_string(),
                               parent_pid: process.parent().map(|p| p.as_u32()),
                               read_bytes,
                               written_bytes,
                               total_read_bytes,
                               total_written_bytes,
                               children: sys.processes()
                                                   .iter()
                                                   .filter_map(|(cpid, cp)| if cp.parent() == Some(*pid) {
                                                       Some(cpid.as_u32())
                                                   } else { None })
                                                   .collect(),
            });
        }

        processes
    }).await.expect("thread panicked")
}

use tauri::{command, AppHandle, Listener, Manager, State};
use crate::kill_process::kill_process;

#[command]
pub fn set_process_priority(pid: u32, priority: i32,app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(unix)]
    unsafe {
        let result = libc::setpriority(libc::PRIO_PROCESS, pid as u32 as u32, priority);
        if result == 0 {
            Ok(format!("✅ Set PID {} nice level to {}", pid, priority))
        } else {
            Err(format!("❌ Failed to set nice level for PID {} (errno: {})", pid, *libc::__errno_location()))
        }
    }

    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Threading::{
            OpenProcess, SetPriorityClass, PROCESS_SET_INFORMATION, PROCESS_QUERY_INFORMATION,
            IDLE_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS,
            ABOVE_NORMAL_PRIORITY_CLASS, HIGH_PRIORITY_CLASS, REALTIME_PRIORITY_CLASS
        };
        use windows_sys::Win32::Foundation::CloseHandle;

        let priority_class = match priority {
            p if p <= -15 => REALTIME_PRIORITY_CLASS,
            p if p <= -10 => HIGH_PRIORITY_CLASS,
            p if p <= -5  => ABOVE_NORMAL_PRIORITY_CLASS,
            p if p <= 0   => NORMAL_PRIORITY_CLASS,
            p if p <= 5   => BELOW_NORMAL_PRIORITY_CLASS,
            _             => IDLE_PRIORITY_CLASS,
        };

        unsafe {
            let handle = OpenProcess(PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION, 0, pid);
            if handle == std::ptr::null_mut() {

                emit_log(app_handle,format!("❌ Failed to open PID {} for priority change", pid));
                return Err(format!("❌ Failed to open PID {} for priority change", pid));
            }
            let result = SetPriorityClass(handle, priority_class);
            CloseHandle(handle);

            if result != 0 {
                emit_log(app_handle,format!("✅ Set PID {} priority class", pid));
                Ok(format!("✅ Set PID {} priority class", pid))
            } else {
                emit_log(app_handle,format!("❌ Failed to set priority class for PID {}", pid));
                Err(format!("❌ Failed to set priority class for PID {}", pid))
            }
        }
    }
}
#[command]
pub fn restart_process(app_handle: tauri::AppHandle,exe_path: String, args: Vec<String>) -> Result<String, String> {
    use std::process::Command;

    let result = Command::new(&exe_path)
        .args(&args)
        .spawn();

    match result {
        Ok(child) => {
            emit_log(app_handle,format!("🚀 Restarted process {} with PID {}", exe_path, child.id()));
            Ok(format!("🚀 Restarted process {} with PID {}", exe_path, child.id()))
        },
        Err(e) => {
            emit_log(app_handle,format!("❌ Failed to restart process: {}", e));
            Err(format!("❌ Failed to restart process: {}", e))
        },
    }
}
#[command]
pub fn kill_and_restart(
    pid: u32,
    kill_children: bool,
    timeout_secs: u64,
    exe_path: String,
    args: Vec<String>,
    app_handle: tauri::AppHandle
) -> Result<String, String> {
    use rayon::prelude::*;
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        sys.refresh_all();

        let target_pid = Pid::from_u32(pid);
        let mut descendants = vec![];

        if kill_children {
            crate::kill_process::collect_descendants_with_depth(target_pid, &sys, &mut descendants, 1,app_handle.clone());
            descendants.sort_by(|a, b| b.1.cmp(&a.1)); // Deepest first
        }

        let results = Mutex::new(vec![]); // Mutex because Rayon is multithreaded

        // Parallel kill children
        descendants.par_iter().for_each(|(pid, depth)| {
            let res = crate::kill_process::try_graceful_kill(*pid, timeout_secs, Some(*depth),app_handle.clone());
            results.lock().unwrap().push(res);
        });

        // Kill the main parent process last (sequentially)
        let parent_result = crate::kill_process::try_graceful_kill(target_pid, timeout_secs, Some(0),app_handle.clone());
        results.lock().unwrap().push(parent_result);

        // Summary print
        let summary = results.lock().unwrap().join("\n");
        emit_log(app_handle.clone(),format!("📝 Kill results:\n{}", summary));
        println!("📝 Kill results:\n{}", summary);

        // You could emit to frontend here with: app.emit_all("kill_summary", summary).unwrap();
        let restart_report = restart_process(app_handle.clone(),exe_path, args);
        if restart_report.clone().is_ok() {
            emit_log(app_handle.clone(),format!("{}", restart_report.clone().unwrap()));
            println!("{}", restart_report.clone().unwrap())
        } else {
            emit_log(app_handle.clone(),format!("{}", "Restart failde",));
        }
    });
    Ok("".to_string())
}

use tauri::Window;
use tauri::Emitter;
use crossbeam_channel::{unbounded, Sender, Receiver};
use rayon::iter::IntoParallelRefIterator;

lazy_static! {
    static ref RESPAWN_CONTROLS: Arc<Mutex<HashMap<u32, Sender<()>>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[command]
pub fn auto_respawn(
    app_handle: tauri::AppHandle,
    exe_path: String,
    args: Vec<String>,
    pid: u32,
    check_interval: u64,
    restart_delay: u64,
    max_restarts: u32,
) -> Result<String, String> {
    let (tx, rx) = unbounded();

    // Clone once for the main thread
    let app_handle_main = app_handle.clone();
    RESPAWN_CONTROLS.lock().unwrap().insert(pid, tx);

    // Clone again for the spawned thread
    let app_handle_thread = app_handle.clone();
    thread::spawn(move || {
        let mut restarts = 0;
        loop {
            if rx.try_recv().is_ok() {
                emit_log(app_handle_thread.clone(), format!("🛑 Auto-respawn for PID {} stopped by user.", pid));
                println!("🛑 Auto-respawn for PID {} stopped by user.", pid);
                break;
            }

            println!("🚀 Starting process...");
            let mut child = Command::new(&exe_path)
                .args(&args)
                .spawn()
                .ok();
            let app_handle_inner = app_handle_thread.clone();
            loop {
                thread::sleep(Duration::from_secs(check_interval));
                if rx.try_recv().is_ok() {
                    emit_log(app_handle_inner.clone(), format!("🛑 Auto-respawn loop killed for PID {}", pid));
                    if let Some(mut c) = child {
                        let _ = c.kill();
                    }
                    return;
                }

                if let Some(ref mut c) = child {
                    if let Ok(Some(status)) = c.try_wait() {
                        emit_log(app_handle_inner.clone(), format!("⚰️ Process exited with {:?}", status));
                        println!("⚰️ Process exited with {:?}", status);
                        break;
                    }
                }
            }

            restarts += 1;
            if restarts >= max_restarts {
                break;
            }
            thread::sleep(Duration::from_secs(restart_delay));
        }
    });

    // Use the original clone to emit log
    emit_log(app_handle_main.clone(), format!("Auto-respawn started for pid {}", pid));
    Ok(format!("Auto-respawn started for pid {}", pid))
}


#[command]
pub fn stop_auto_respawn(pid: u32) -> Result<String, String> {
    let mut guard = RESPAWN_CONTROLS.lock().unwrap();
    if let Some(tx) = guard.remove(&pid) {
        let _ = tx.send(()); // signal the thread to shutdown
        Ok(format!("Stopped auto-respawn for PID {}", pid))
    } else {
        Err(format!("No auto-respawn running for PID {}", pid))
    }
}

#[command]
pub fn batch_set_priority(app_handle: tauri::AppHandle,pids: Vec<u32>, priority: i32) -> Result<String, String> {
    let mut results = vec![];
    for pid in pids {
        let result = set_process_priority(pid, priority,app_handle.clone());
        results.push(format!("PID {}: {}", pid, result.unwrap_or_else(|e| e)));
    }
    emit_log(app_handle,results.join("\n"));
    Ok(results.join("\n"))
}

#[command]
pub fn pid_to_proc(pid:u32,app_handle: tauri::AppHandle) -> Result<ProcessInfo,String> {
    let mut sys = SYS.lock().unwrap();
    sys.refresh_all();
    let proc = sys.process(Pid::from_u32(pid));
    if let Some(p) = proc {
        Ok(ProcessInfo {
            pid:pid,
            name: p.name().to_str().unwrap().to_string(),
            cmd: p.cmd().join(" ".as_ref()).into_string().unwrap(),
            cpu: p.cpu_usage(),
            memory: p.memory() as f64 / 1024.0,
            uptime: p.run_time(),
            exe: p.exe().unwrap_or(Path::new("")).to_str().unwrap().to_string(),
            read_bytes:p.disk_usage().read_bytes,
            written_bytes:p.disk_usage().written_bytes,
            total_read_bytes:p.disk_usage().total_read_bytes,
            total_written_bytes:p.disk_usage().total_written_bytes,
            parent_pid: p.parent().map(|p| p.as_u32()),
            children: sys.processes()
                .iter()
                .filter_map(|(cpid, cp)| if cp.parent() == Some(Pid::from_u32(pid)) {
                    Some(cpid.as_u32())
                } else { None })
                .collect(),
        })

    } else {
        emit_log(app_handle, String::from("No such process"));
        Err("No such process".to_string())
    }
}

pub fn emit_log(app_handle: tauri::AppHandle, message: String) -> Result<(), String> {
    app_handle
        .emit("log", message.clone())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}