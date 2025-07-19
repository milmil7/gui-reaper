use sysinfo::{System, Pid};
use tauri::command;
use std::{thread, time::Duration};
use rayon::prelude::*;
use std::sync::Mutex;
use crate::list_process::emit_log;

#[tauri::command]
pub fn kill_process(pid: u32, kill_children: bool, timeout_secs: u64,app_handle: tauri::AppHandle) -> Result<(), String> {
    std::thread::spawn(move || {
        let mut sys = System::new_all();
        sys.refresh_all();

        let target_pid = Pid::from_u32(pid);
        let mut descendants = vec![];

        if kill_children {
            collect_descendants_with_depth(target_pid, &sys, &mut descendants, 1,app_handle.clone());
            descendants.sort_by(|a, b| b.1.cmp(&a.1)); // Deepest first
        }

        let results = Mutex::new(vec![]); // Mutex because Rayon is multithreaded

        // Parallel kill children
        descendants.par_iter().for_each(|(cpid, depth)| {
            let res = try_graceful_kill(*cpid, timeout_secs, Some(*depth),app_handle.clone());
            results.lock().unwrap().push(res);
        });

        // Kill the main parent process last (sequentially)
        let parent_result = try_graceful_kill(target_pid, timeout_secs, Some(0),app_handle.clone());
        results.lock().unwrap().push(parent_result);

        // Summary print
        let summary = results.lock().unwrap().join("\n");
        emit_log(app_handle.clone(),format!("📝 Kill results:\n{}", summary));
        println!("📝 Kill results:\n{}", summary);

        // You could emit to frontend here with: app.emit_all("kill_summary", summary).unwrap();
    });

    Ok(())
}

pub(crate) fn collect_descendants_with_depth(
    pid: Pid,
    sys: &System,
    collected: &mut Vec<(Pid, usize)>,
    depth: usize,
    app_handle: tauri::AppHandle
) {
    for (cpid, proc) in sys.processes() {
        if let Some(parent) = proc.parent() {
            if parent == pid {
                collected.push((*cpid, depth));
                collect_descendants_with_depth(*cpid, sys, collected, depth + 1,app_handle.clone());
            }
        }
    }
}

pub(crate) fn try_graceful_kill(pid: Pid, timeout_secs: u64, depth: Option<usize>,app_handle: tauri::AppHandle) -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let indent = match depth {
        Some(d) => "  ".repeat(d),
        None => "".to_string(),
    };

    #[cfg(unix)]
    unsafe {
        libc::kill(pid.as_i32(), libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        if let Some(proc) = sys.process(pid) {
            proc.kill();
        }
    }

    let mut elapsed = 0;
    let interval = 200;
    let mut killed_softly = false;

    while elapsed < timeout_secs * 1000 {
        thread::sleep(Duration::from_millis(interval));
        elapsed += interval;
        sys.refresh_all();
        if sys.process(pid).is_none() {
            killed_softly = true;
            break;
        }
    }

    if killed_softly {
        emit_log(app_handle.clone(),format!("{}✅ PID {} killed gracefully (SIGTERM)", indent, pid.as_u32()));
        return format!("{}✅ PID {} killed gracefully (SIGTERM)", indent, pid.as_u32());
    }

    #[cfg(unix)]
    unsafe {
        libc::kill(pid.as_i32(), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        if let Some(proc) = sys.process(pid) {
            proc.kill();
        }
    }

    thread::sleep(Duration::from_millis(300));
    sys.refresh_all();

    if sys.process(pid).is_none() {
        emit_log(app_handle.clone(),format!("{}⚠️ PID {} required force kill (SIGKILL)", indent, pid.as_u32()));
        format!("{}⚠️ PID {} required force kill (SIGKILL)", indent, pid.as_u32())
    } else {
        emit_log(app_handle.clone(),format!("{}❌ PID {} could not be killed", indent, pid.as_u32()));
        format!("{}❌ PID {} could not be killed", indent, pid.as_u32())
    }
}


#[command]
pub fn batch_kill_processes(
    pids: Vec<u32>,
    kill_children: bool,
    timeout_secs: u64,
    app_handle: tauri::AppHandle
) -> Result<(), String> {
    std::thread::spawn(move || {
    let mut final_report = vec![];

    for pid_u32 in pids {
        let target_pid = Pid::from_u32(pid_u32);
        let mut sys = System::new_all();
        sys.refresh_all();

        let mut descendants = vec![];

        if kill_children {
            collect_descendants_with_depth(target_pid, &sys, &mut descendants, 1,app_handle.clone());
            descendants.sort_by(|a, b| b.1.cmp(&a.1));
        }

        let mut results = vec![format!("🔸 Killing PID {}", pid_u32)];

        for (cpid, depth) in &descendants {
            results.push(try_graceful_kill(*cpid, timeout_secs, Some(*depth),app_handle.clone()));
        }

        results.push(try_graceful_kill(target_pid, timeout_secs, Some(0),app_handle.clone()));

        final_report.push(results.join("\n"));
    }
    emit_log(app_handle.clone(),format!("📝 Batch Kill Report:\n{}", final_report.join("\n\n")));
    println!("📝 Batch Kill Report:\n{}", final_report.join("\n\n"))
    });
    Ok(())
}
