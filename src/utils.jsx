import {invoke} from "@tauri-apps/api/core";
import {useEffect, useRef, useState} from "react";
import themes from "./styles.js";
import {useTheme} from "./ThemeChanger.jsx";

export function SortableHeader({ title, sortKey, requestSort, sortConfig, extra_class="" }) {
    const { theme, setTheme } = useTheme();
    return (
        <th onClick={() => requestSort(sortKey)}
            className={`p-2 cursor-pointer text-left ${themes[theme].BORDER} ${themes[theme].INFO_C} ${extra_class} `}
        >
            <div className="flex items-center">
                {title}{" "}
                {sortConfig.key === sortKey ? (
                    sortConfig.direction === "ascending" ? "▲" : "▼"
                ) : ""}
            </div>
        </th>
    );
}

export const colorCpu = (cpu) => {
    if (cpu > 80) return 'text-red-600 font-bold';
    if (cpu > 50) return 'text-yellow-600';
    return 'text-green-600';
};

export const colorMem = (mem) => {
    if (mem > 1500) return 'text-red-600 font-bold';
    if (mem > 800) return 'text-yellow-600';
    return 'text-green-600';
};

export async function killProcess(pid) {
    await invoke("kill_process", { pid, killChildren: true, timeoutSecs: 5 });
}


export async function killAndRestart(proc) {
    const exePath = proc.exe;
    const args = [];
    await invoke("kill_and_restart", { pid: proc.pid, killChildren: true, timeoutSecs: 5, exePath, args });
}



export async function autoRespawnHandler(proc, autoRespawns, setAutoRespawns) {
    if (autoRespawns.includes(proc.pid)) {
        await invoke("stop_auto_respawn", { pid: proc.pid });
        setAutoRespawns(prev => prev.filter(p => p !== proc.pid));
    } else {
        const exePath = proc.exe;
        const args = [];
        await invoke("auto_respawn", { pid: proc.pid, exePath, args, checkInterval: 2, restartDelay: 3, maxRestarts: 777 });
        setAutoRespawns(prev => [...new Set([...prev, proc.pid])]);
    }
}

export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(storedValue));
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}


export function ActionDropdown({ proc, autoRespawns, handlePriority, setAutoRespawns, openLimitDialog, setWatchList, watchList }) {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    const { theme, setTheme } = useTheme();
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && ref.current !== e.target) {
                setTimeout(() => setOpen(false), 300);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative inline-block text-left" ref={ref}>
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setTimeout(() => setOpen(!open), 300);
                }}
                className={`px-2 py-1 ${themes[theme].ACCENT_C} ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}  text-xs hover:translate-x-0.5 hover:translate-y-0.5 `}
            >
                {_3dot_ICON}
            </button>

            {open && (
                <div className={`absolute right-0 mt-2 w-48 bg-white text-gray-900 ${themes[theme].BORDER} ${themes[theme].SHADOW} z-10  `}>
                    <div className="py-1">
                        <button
                            onClick={() => { killProcess(proc.pid);  }}
                            className=" w-full text-left px-4 py-2 text-sm flex gap-1 hover:bg-gray-100"
                        >{Scythe_ICON} Kill</button>
                        <button
                            onClick={() => handlePriority(proc.pid)}
                            className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >
                            {Priority_ICON} Set Priority
                        </button>
                        <button
                            onClick={() => { killAndRestart(proc);  }}
                            className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >{Restart_ICON} Restart</button>
                        <button
                            onClick={() => { autoRespawnHandler(proc, autoRespawns, setAutoRespawns);  }}
                            className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >
                            {autoRespawns.includes(proc.pid) ? Stop_ICON : Respawn_ICON}
                            {autoRespawns.includes(proc.pid) ? ` Stop Respawn` :` Auto Respawn`}
                        </button>
                        <button
                            onClick={() => { openLimitDialog(proc);  }}
                            className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                        >{Limit_ICON} Limits
                        </button>
                        <button
                            className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                            onClick={() => {
                                setWatchList((prev) =>
                                    prev.includes(proc.name)
                                        ? prev.filter((name) => name !== proc.name)
                                        : [...prev, proc.name]
                                );
                            }}
                        >
                            {Watch_ICON} {watchList.includes(proc.name) ? 'Unwatch' : 'Watch'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function BatchActionsDropdown({ show, batch, selectedPids, setAutoRespawns,batchAutoRespawn, showAlert }) {
    const [open, setOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    return (
        <div className="relative inline-block text-left">
            <button
                className={`${themes[theme].WARNING_C} max-md:text-xs w-fit p-1 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} hover:translate-x-0.5 hover:translate-y-0.5 `}
                onClick={() => setOpen(!open)}
                disabled={selectedPids.length === 0}
            >
                {Batch_ICON}
            </button>

            {open && (
                <div className={`absolute right-0 mt-2 w-48  ${themes[theme].BASE_C} ${themes[theme].BORDER} ${themes[theme].SHADOW} z-10  `}>
                    <button
                        onClick={() => {
                            batchKill(selectedPids,showAlert);
                            setOpen(false);
                        }}
                        className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                        {Scythe_ICON} Batch Kill
                    </button>
                    <button
                        onClick={() => {
                            show(true)
                            batch(true)
                            setOpen(false);
                        }}
                        className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                        {Priority_ICON}️ Batch Set Priority
                    </button>
                    <button
                        onClick={() => {
                            batchAutoRespawn(selectedPids, setAutoRespawns);
                            setOpen(false);
                        }}
                        className="flex gap-1 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                        {Respawn_ICON} Batch Auto-Respawn
                    </button>
                </div>
            )}
        </div>
    );
}
export function WatchListDropdown({ watchedPids, setWatchedPids }) {
    const [open, setOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const unwatch = (pid) => {
        setWatchedPids(prev => prev.filter(p => p !== pid));
    };

    return (
        <div className="relative inline-block text-left">
            <button
                className={`${themes[theme].SUCCESS_C} flex gap-1 max-md:text-xs w-fit p-1 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} hover:translate-x-0.5 hover:translate-y-0.5 `}
                onClick={() => setOpen(!open)}
            >
                {Watchlist_ICON} ({watchedPids.length})
            </button>

            {open && (
                <div className={`absolute right-0 mt-2 w-48 ${themes[theme].BASE_C} ${themes[theme].BORDER} ${themes[theme].SHADOW} z-10  `}>
                    {watchedPids.length === 0 ? (
                        <div className="p-2 text-gray-500">No watched processes</div>
                    ) : (
                        watchedPids.map(pid => (
                            <div
                                key={pid}
                                className="flex justify-between items-center p-2 hover:bg-gray-100"
                            >
                                <span className="text-sm text-gray-800">PID: {pid}</span>
                                <button
                                    onClick={() => unwatch(pid)}
                                    className="text-red-500 text-sm hover:underline"
                                >
                                    Unwatch
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
export function RespawnListDropdown({ respawns, setRespawns }) {
    const [open, setOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const unwatch = (pid) => {
        setRespawns(prev => prev.filter(p => p !== pid));
    };

    return (
        <div className="relative inline-block text-left">
            <button
                onClick={() => setOpen(prev => !prev)}
                className={` flex gap-1 max-md:text-xs w-fit p-1 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}  hover:translate-x-0.5 hover:translate-y-0.5  ${themes[theme].SECONDARY_C}`}
            >
                {Respawn_ICON} ({respawns.length})
            </button>

            {open && (
                <div className={`absolute right-0 mt-2 w-48 bg-white ${themes[theme].BORDER} ${themes[theme].SHADOW} z-10 text-gray-900 `}>
                    {respawns.length === 0 ? (
                        <div className="p-2 text-gray-500">No respawnable processes</div>
                    ) : (
                        respawns.map(pid => (
                            <div
                                key={pid}
                                className="text-red-500 hover:text-red-700 "
                            >
                                <span className="text-sm text-gray-800">PID: {pid}</span>
                                <button
                                    onClick={async () => {
                                        await invoke("stop_auto_respawn", { pid: pid });
                                        setRespawns(prev => prev.filter(p => p !== pid));
                                    }}
                                    className="text-red-500 text-sm hover:underline"
                                >
                                    Unspawn
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
export function Tooltip_({ children, text }) {
    return (
        <div className="relative flex items-center group">
            {children}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 z-10 whitespace-nowrap">
                {text}
            </div>
        </div>
    );
}
export function PriorityDialog({ isOpen, onClose, onSubmit, batch,selected, showAlert }) {
    const [value, setValue] = useState("0");
    const {theme, setTheme} = useTheme()

    const handleSubmit = () => {
        const parsed = parseInt(value);
        if (batch) {
            invoke("batch_set_priority", { pids:selected, priority:parsed });

            onClose();
            return
        }
        if (!isNaN(parsed) && parsed >= -20 && parsed <= 19) {
            onSubmit(parsed);
            onClose();
        } else {
            showAlert("Nice level must be between -20 and 19");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-[#000000aa]  flex items-center justify-center">
            <div className={`bg-gray-300 p-6  w-72 shadow-lg ${themes[theme].BORDER} ${themes[theme].SHADOW}`}>
                <h2 className="text-black text-lg font-semibold mb-4">Set Nice Level</h2>
                <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`w-full p-2 bg-gray-800 text-white ${themes[theme].BORDER}  mb-4`}
                    min={-20}
                    max={19}
                />
                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className={`px-3 py-1 text-sm ${themes[theme].NEUTRAL_C}  hover:bg-gray-600 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={`px-3 py-1 text-sm ${themes[theme].INFO_C} hover:bg-blue-500 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}`}
                    >
                        Set
                    </button>
                </div>
            </div>
        </div>
    );
}
export function Alert({ message, visible }) {
    const {theme, setTheme}= useTheme();
    return (
        <div
            className={`fixed bottom-4 right-4 z-50 transform transition-all duration-500 ease-in-out 
        ${visible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"} 
        ${themes[theme].SUCCESS_C} px-4 py-2 rounded shadow-lg`}
        >
            {message}
        </div>
    );
}
export async function batchKill(pids,showAlert) {
    if (pids.length === 0) {
        showAlert("No processes selected.");
        return
    }
    await invoke("batch_kill_processes", { pids, killChildren: true, timeoutSecs: 5 });
    showAlert(`Batch killed ${pids.length} processes.`);
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = bytes / Math.pow(k, i);
    return value.toFixed(1) + ' ' + sizes[i];
}

export function parseBytes(value) {



    //

    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const match = value.match(/^([\d.]+)\s*(\w+)$/i);
    if (!match) return 0;

    const number = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const index = units.indexOf(unit);
    if (index === -1) return 0;

    return number * Math.pow(1024, index);
}

export const Close_ICON      =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" fillRule="evenodd"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"></path><path fill="currentColor" d="m12 14.122l5.303 5.303a1.5 1.5 0 0 0 2.122-2.122L14.12 12l5.304-5.303a1.5 1.5 0 1 0-2.122-2.121L12 9.879L6.697 4.576a1.5 1.5 0 1 0-2.122 2.12L9.88 12l-5.304 5.304a1.5 1.5 0 1 0 2.122 2.12z"></path></g></svg>
export const Actions_ICON    =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M4 3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10 0a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm2-2V8h-3V6h3V3h2v3h3v2h-3v3z"></path></svg>
export const Respawn_ICON    =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={"currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2v4" /><path d="M12 12l4-4" /><path d="M12 12l-4 4" /><path d="M12 12v6" /></svg>;
export const Log_ICON        =     <svg xmlns="http://www.w3.org/2000/svg" width={30} height={30} viewBox="0 0 48 48"><defs><mask id="ipTLog0"><g fill="none" stroke="#fff" strokeLinejoin="round" strokeWidth={4}><path fill="#555555" d="M13 10h28v34H13z"></path><path strokeLinecap="round" d="M35 10V4H8a1 1 0 0 0-1 1v33h6m8-16h12m-12 8h12"></path></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#ipTLog0)"></path></svg>
export const Scythe_ICON     =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 512 512"><path fill="currentColor" d="M296.625 25.406c-63.794.388-135.81 14.683-206.03 32.844c-3.472 34.08 2.226 68.906 14.03 104.25C181.175 75.936 393.65 44.825 486.72 128C456.02 50.466 384.046 24.874 296.624 25.406zM65.655 61.438L27.906 71c5.643 78.022 28.546 132.393 60.44 174.47c-16.54 10.348-40.693 19.673-68.782 26.843c5.664 6.597 14.25 16.18 30.53 18.53c24.846-4.33 39.912-14.982 53.75-26.593c76.24 85.145 190.22 118.955 253.126 224.22l49.436-.126C290.996 275.316 81.01 364.804 65.656 61.438z"></path></svg>
export const Priority_ICON   =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M14 5h8v2h-8zm0 5.5h8v2h-8zm0 5.5h8v2h-8zM2 11.5C2 15.08 4.92 18 8.5 18H9v2l3-3l-3-3v2h-.5C6.02 16 4 13.98 4 11.5S6.02 7 8.5 7H12V5H8.5C4.92 5 2 7.92 2 11.5"></path></svg>
export const Restart_ICON    =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M11 20.95q-3.025-.375-5.012-2.637T4 13q0-1.65.65-3.162T6.5 7.2l1.425 1.425q-.95.85-1.437 1.975T6 13q0 2.2 1.4 3.888T11 18.95zm2 0v-2q2.175-.4 3.588-2.075T18 13q0-2.5-1.75-4.25T12 7h-.075l1.1 1.1l-1.4 1.4l-3.5-3.5l3.5-3.5l1.4 1.4l-1.1 1.1H12q3.35 0 5.675 2.325T20 13q0 3.025-1.987 5.288T13 20.95"></path></svg>
export const Limit_ICON      =     <svg xmlns="http://www.w3.org/2000/svg" width={26} height={26} viewBox="0 0 26 26"><path fill="currentColor" d="M23.633 5.028a1.07 1.07 0 0 0-.777-.366c-2.295-.06-5.199-2.514-7.119-3.477C14.551.592 13.768.201 13.18.098a1.2 1.2 0 0 0-.36.001c-.588.103-1.371.494-2.556 1.087c-1.92.962-4.824 3.417-7.119 3.476a1.08 1.08 0 0 0-.778.366a1.17 1.17 0 0 0-.291.834c.493 10.023 4.088 16.226 10.396 19.831c.164.093.346.141.527.141s.363-.048.528-.141c6.308-3.605 9.902-9.808 10.396-19.831a1.16 1.16 0 0 0-.29-.834M13 18.057a6.057 6.057 0 1 1 0-12.114a6.057 6.057 0 0 1 0 12.114m2.48-9.548L9.509 14.48A4.26 4.26 0 0 1 8.707 12A4.3 4.3 0 0 1 13 7.707c.926 0 1.777.301 2.48.802m1.01 1.011c.501.702.803 1.555.803 2.48A4.3 4.3 0 0 1 13 16.293a4.26 4.26 0 0 1-2.48-.802z"></path></svg>
export const Watch_ICON      =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 512 512"><path fill="currentColor" d="M218 19c-1 0-2.76.52-5.502 3.107c-2.742 2.589-6.006 7.021-9.191 12.76c-6.37 11.478-12.527 28.033-17.666 45.653c-4.33 14.844-7.91 30.457-10.616 44.601c54.351 24.019 107.599 24.019 161.95 0c-2.706-14.144-6.286-29.757-10.616-44.601c-5.139-17.62-11.295-34.175-17.666-45.653c-3.185-5.739-6.45-10.171-9.191-12.76C296.76 19.52 295 19 294 19c-6.5 0-9.092 1.375-10.822 2.85c-1.73 1.474-3.02 3.81-4.358 7.34s-2.397 8.024-5.55 12.783C270.116 46.73 263.367 51 256 51c-7.433 0-14.24-4.195-17.455-8.988c-3.214-4.794-4.26-9.335-5.576-12.881s-2.575-5.867-4.254-7.315C227.035 20.37 224.5 19 218 19m-46.111 124.334c-1.41 9.278-2.296 17.16-2.57 22.602c6.61 5.087 17.736 10.007 31.742 13.302C217.18 183.031 236.6 185 256 185s38.82-1.969 54.94-5.762c14.005-3.295 25.13-8.215 31.742-13.302c-.275-5.443-1.161-13.324-2.57-22.602c-55.757 23.332-112.467 23.332-168.223 0M151.945 155.1c-19.206 3.36-36.706 7.385-51.918 11.63c-19.879 5.548-35.905 11.489-46.545 16.57c-5.32 2.542-9.312 4.915-11.494 6.57c-.37.28-.247.306-.445.546c.333.677.82 1.456 1.73 2.479c1.973 2.216 5.564 4.992 10.627 7.744c10.127 5.504 25.944 10.958 45.725 15.506C139.187 225.24 194.703 231 256 231s116.813-5.76 156.375-14.855c19.78-4.548 35.598-10.002 45.725-15.506c5.063-2.752 8.653-5.528 10.627-7.744c.91-1.023 1.397-1.802 1.73-2.479c-.198-.24-.075-.266-.445-.547c-2.182-1.654-6.174-4.027-11.494-6.568c-10.64-5.082-26.666-11.023-46.545-16.57c-15.212-4.246-32.712-8.272-51.918-11.631c.608 5.787.945 10.866.945 14.9v3.729l-2.637 2.634c-10.121 10.122-25.422 16.191-43.302 20.399C297.18 200.969 276.6 203 256 203s-41.18-2.031-59.06-6.238s-33.182-10.277-43.303-20.399L151 173.73V170c0-4.034.337-9.113.945-14.9m1.094 88.205C154.558 308.17 200.64 359 256 359s101.442-50.83 102.96-115.695a749 749 0 0 1-19.284 2.013c-1.33 5.252-6.884 25.248-15.676 30.682c-13.61 8.412-34.006 7.756-48 0c-7.986-4.426-14.865-19.196-18.064-27.012c-.648.002-1.287.012-1.936.012c-.65 0-1.288-.01-1.936-.012c-3.2 7.816-10.078 22.586-18.064 27.012c-13.994 7.756-34.39 8.412-48 0c-8.792-5.434-14.346-25.43-15.676-30.682a749 749 0 0 1-19.285-2.013M137.4 267.209c-47.432 13.23-77.243 32.253-113.546 61.082c42.575 4.442 67.486 21.318 101.265 48.719l16.928 13.732l-21.686 2.211c-13.663 1.393-28.446 8.622-39.3 17.3c-5.925 4.738-10.178 10.06-12.957 14.356c44.68 5.864 73.463 10.086 98.011 20.147c18.603 7.624 34.81 18.89 53.737 35.781l5.304-23.576c-1.838-9.734-4.134-19.884-6.879-30.3c-5.12-7.23-9.698-14.866-13.136-22.007C201.612 397.326 199 391 199 384c0-3.283.936-6.396 2.428-9.133a480 480 0 0 0-6.942-16.863c-29.083-19.498-50.217-52.359-57.086-90.795m237.2 0c-6.87 38.436-28.003 71.297-57.086 90.795a481 481 0 0 0-6.942 16.861c1.493 2.737 2.428 5.851 2.428 9.135c0 7-2.612 13.326-6.14 20.654c-3.44 7.142-8.019 14.78-13.14 22.01c-2.778 10.547-5.099 20.82-6.949 30.666l5.14 23.42c19.03-17.01 35.293-28.338 53.974-35.994c24.548-10.06 53.33-14.283 98.011-20.147c-2.78-4.297-7.032-9.618-12.957-14.355c-10.854-8.679-25.637-15.908-39.3-17.3l-21.686-2.212l16.928-13.732c33.779-27.4 58.69-44.277 101.265-48.719c-36.303-28.829-66.114-47.851-113.546-61.082M256 377c-8 0-19.592.098-28.234 1.826c-4.321.864-7.8 2.222-9.393 3.324c-1.592 1.103-1.373.85-1.373 1.85s1.388 6.674 4.36 12.846c2.971 6.172 7.247 13.32 11.964 19.924s9.925 12.699 14.465 16.806c4.075 3.687 7.842 5.121 8.211 5.377c.37-.256 4.136-1.69 8.21-5.377c4.54-4.107 9.749-10.202 14.466-16.806s8.993-13.752 11.965-19.924S295 385 295 384s.22-.747-1.373-1.85c-1.593-1.102-5.072-2.46-9.393-3.324C275.592 377.098 264 377 256 377m0 61.953c-.042.03-.051.047 0 .047s.042-.018 0-.047m-11.648 14.701L235.047 495h41.56l-9.058-41.285C264.162 455.71 260.449 457 256 457c-4.492 0-8.235-1.316-11.648-3.346"></path></svg>
export const _3dot_ICON      =     <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0m7 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0"></path></svg>
export const Stop_ICON       =     <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1M6 5.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5z" clipRule="evenodd"></path></svg>
export const Batch_ICON      =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M4.5 2a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5zM2 4v9.5a.5.5 0 0 0 .5.5H12v-1H3V4zm6.5.5v2h-2v1h2v2h1v-2h2v-1h-2v-2z" clipRule="evenodd"></path></svg>
export const Watchlist_ICON  =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M5 18q-.425 0-.712-.288T4 17v-.95q-1.35-.8-2.175-2.137T1 11q0-2.575 1.925-4.288T7.5 5t4.575 1.713T14 11q0 1.575-.825 2.913T11 16.05V17q0 .425-.288.713T10 18zm.5-6q.425 0 .713-.288T6.5 11t-.288-.712T5.5 10t-.712.288T4.5 11t.288.713T5.5 12m1.4 2h1.2q.125 0 .2-.112t.025-.238l-.6-1.2q-.075-.125-.225-.125t-.225.125l-.6 1.2q-.05.125.025.237t.2.113m2.6-2q.425 0 .713-.288T10.5 11t-.288-.712T9.5 10t-.712.288T8.5 11t.288.713T9.5 12M21 13h-5q-.425 0-.712-.288T15 12t.288-.712T16 11h5q.425 0 .713.288T22 12t-.288.713T21 13m0 4h-5q-.425 0-.712-.288T15 16t.288-.712T16 15h5q.425 0 .713.288T22 16t-.288.713T21 17m0-8h-5q-.425 0-.712-.288T15 8t.288-.712T16 7h5q.425 0 .713.288T22 8t-.288.713T21 9"></path></svg>
export const SelectAll_ICON  =     <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M3 6.25A3.25 3.25 0 0 1 6.25 3h9.5A3.25 3.25 0 0 1 19 6.25v9.5A3.25 3.25 0 0 1 15.75 19h-9.5A3.25 3.25 0 0 1 3 15.75zm12.28 2.78a.75.75 0 0 0-1.06-1.06L10 12.19l-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0zM6.5 20a3.25 3.25 0 0 0 2.741 1.5h7.005a5.254 5.254 0 0 0 5.254-5.254V9.241A3.25 3.25 0 0 0 19.999 6.5v9.746A3.753 3.753 0 0 1 16.246 20z"></path></svg>

