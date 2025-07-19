import React, {useEffect, useRef, useState} from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {Line} from "react-chartjs-2";
import {
    Chart as ChartJS,
    LineElement,
    BarElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Title,
} from "chart.js";

import {
    ActionDropdown, Actions_ICON,
    Alert,
    BatchActionsDropdown, Close_ICON, colorCpu, colorMem, formatBytes,
    killProcess, Log_ICON, parseBytes,
    PriorityDialog, Respawn_ICON, RespawnListDropdown, SelectAll_ICON, SortableHeader, Tooltip_,
    useLocalStorage,
    WatchListDropdown
} from "./utils.jsx";
import TitleBar from "./TitleBar.jsx";
import {useTheme} from "./ThemeChanger.jsx";


ChartJS.register(
    LineElement,
    BarElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Title
);
import themes from "./styles.js";
import {useChartSettings} from "./SettingsDropdown.jsx";

export default function ProcessTable({alertVisible,alertMessage,setAlertMessage,setAlertVisible}) {
    const [processes, setProcesses] = useState([]);
    const [autoRespawns, setAutoRespawns] = useLocalStorage("autoRespawns", []);
    const [sortConfig, setSortConfig] = useState({ key: "pid", direction: "ascending" });
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPids, setSelectedPids] = useState([]);
    const [expandedPids, setExpandedPids] = useState([]);
    const {theme, setTheme} = useTheme();
    const showAlert = (message) => {
        setAlertMessage(message);
        setAlertVisible(true);
        setTimeout(() => setAlertVisible(false), 5000);
    };
    const toggleExpanded = (pid) => {
        setExpandedPids((prev) =>
            prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
        );
    };
    useEffect(() => {
        const fetchProcesses = async () => {
            const procs = await invoke("list_processes");
            setProcesses(procs);

        };
        fetchProcesses();
        const interval = setInterval(fetchProcesses, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unlisten = listen("log", (event) => {
            setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${event.payload}`, ...prev.slice(0, 200)]);
        });
        return () => { unlisten.then(f => f()) };
    }, []);

    const requestSort = (key) => {
        let direction = "ascending";
        if (sortConfig.key === key && sortConfig.direction === "ascending") {
            direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    const toggleSelectPid = (pid) => {
        setSelectedPids(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
    };

    const selectAllVisible = () => {
        const visible = sortedProcesses.map(proc => proc.pid);
        setSelectedPids(visible);
    };

    const clearSelection = () => setSelectedPids([]);

    const sortedProcesses = [...processes].sort((a, b) => {
        if (sortConfig.key === "read_bytes" ||sortConfig.key === "written_bytes" ||sortConfig.key === "total_read_bytes" ||sortConfig.key === "total_written_bytes") {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "ascending" ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "ascending" ? 1 : -1;
            return 0
        }
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "ascending" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
    }).filter(proc =>
        proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proc.pid.toString().includes(searchTerm)
    );
    const [limitDialog, setLimitDialog] = useState({ open: false, proc: null });

    function openLimitDialog(proc) {
        setLimitDialog({ open: true, proc });
    }

    function closeLimitDialog() {
        setLimitDialog({ open: false, proc: null });
    }

    async function setProcessLimits(pid, mem, files) {
        await invoke("set_process_limits",{limits: {
                pid: pid,
                max_memory_mb: mem,
                max_open_files: files
            }
        });
    }

    async function applyLimits() {
        const mem = parseInt(document.getElementById("limit-mem").value) || 0;
        const files = parseInt(document.getElementById("limit-files").value) || 0;
        await setProcessLimits(limitDialog.proc.pid, mem, files);
        closeLimitDialog();
    }

    function MiniProcessChart({ label,
                                  data_,
                                  borderColor,
                                  backgroundColor, labels }) {
        const chartRef = useRef(null);

        const data = {
            labels,
            datasets: [
                {
                    label: label,
                    data: data_,
                    borderColor: borderColor,
                    backgroundColor: backgroundColor,
                    tension: 0.4,
                },
            ],
        };

        const options = {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'category' },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Usage' },
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
            },
        };

        return (
            <div className="h-40 w-[100%]">
                <Line ref={chartRef} data={data} options={options} />
            </div>
        );
    }

    const [historyMap, setHistoryMap] = useState(new Map());

    useEffect(() => {
        const now = new Date().toLocaleTimeString();

        const newMap = new Map(historyMap);

        for (const proc of processes) {
            const existing = newMap.get(proc.pid) || { cpuData: [], ramData: [], labels: [] };
            existing.cpuData.push(proc.cpu);
            existing.ramData.push(proc.memory / 1024);
            existing.labels.push(now);

            if (existing.cpuData.length > 20) {
                existing.cpuData.shift();
                existing.ramData.shift();
                existing.labels.shift();
            }

            newMap.set(proc.pid, existing);
        }

        setHistoryMap(newMap);
    }, [processes]);

    const [watchList, setWatchList] = useState([]);
    const watchInterval = useRef(null);

    useEffect(() => {
        if (watchList.length === 0) {

            if (watchInterval.current) {

                clearInterval(watchInterval.current);
                watchInterval.current = null;
            }
            return;
        }

        watchInterval.current = setInterval(() => {

            for (const proc of processes) {

                if (watchList.includes(proc.name)) {
                    killProcess(proc.pid);
                    console.log(`Killed ${proc.name} (pid: ${proc.pid})`);
                }
            }
        }, 1000);

        return () => {
            if (watchInterval.current) clearInterval(watchInterval.current);
        };
    }, [watchList, processes]);

    const [batch, setBatch] = useState(false);
    const [showPriorityDialog, setShowPriorityDialog] = useState(false);
    const [targetPid, setTargetPid] = useState(null);

    const handleSetPriority = (pid) => {
        setTargetPid(pid);
        setShowPriorityDialog(true);
    };

    const submitPriority = (priority) => {
        if (targetPid !== null) {
            invoke("set_process_priority", { pid: targetPid, priority });
        }
    };



    async function batchSetPriority(pids,priority,setShow) {
        if (pids.length === 0) {
            showAlert("No processes selected.")
            return
        };
        setShow(true);
    }
    async function batchAutoRespawn(pids,setAutoRespawns) {
        if (pids.length === 0) {
            showAlert("No processes selected.")
            return
        };
        const args = [];
        for (const pid of pids) {
            const exePath = (await invoke("pid_to_proc", { pid: pid })).exe;
            if (!exePath) return;

            await invoke("auto_respawn", { pid, exePath, args, checkInterval: 2, restartDelay: 3, maxRestarts: 777 });
        }
        setAutoRespawns(prev => [...new Set([...prev, ...pids])]);
        showAlert(`Started auto-respawn on ${pids.length} processes.`);
    }


    const { settings, setSettings } = useChartSettings();

    useEffect(() => {
        localStorage.setItem('chartSettings', JSON.stringify(settings));
    }, [settings]);

    const toggleSetting = (key) => {
        setSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };



    return (
        <div className="bg-gray-100 h-[calc(100vh-4px)] overflow-clip text-gray-100">
            <TitleBar/>
        <div className={"p-2 pb-4 overflow-auto h-[calc(100vh-47px)] "}>

            <PriorityDialog
                batch={batch}
                showAlert={showAlert}
                selected={selectedPids}
                isOpen={showPriorityDialog}
                onClose={() => setShowPriorityDialog(false)}
                onSubmit={submitPriority}
            />
            <Alert message={alertMessage} visible={alertVisible} />
            {limitDialog.open && (
                <div className="fixed inset-0 flex items-center justify-center bg-[#000000aa] bg-opacity-50 z-40">
                    <div className={`bg-purple-200 p-6 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} w-96 text-purple-900 `}>
                        <h2 className="text-xl mb-4 font-bold">
                            Set Limits for {limitDialog.proc.name} (PID {limitDialog.proc.pid})
                        </h2>
                        <input
                            id="limit-mem"
                            type="number"
                            placeholder="Max Memory MB"
                            className={`w-full mb-2 p-2 ${themes[theme].BORDER} bg-purple-100 text-black `}
                        />
                        <input
                            id="limit-files"
                            type="number"
                            placeholder="Max Open Files"
                            className={`w-full mb-2 p-2 ${themes[theme].BORDER} bg-purple-100 text-purple-900 `}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                className={`${themes[theme].SUCCESS_C} px-4 py-2 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}   `}
                                onClick={applyLimits}
                            >
                                Apply
                            </button>
                            <button
                                className={`${themes[theme].ERROR_C} px-4 py-2 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} text-white `}
                                onClick={closeLimitDialog}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex w-full gap-2  mb-4">
                <div className={`relative w-full ${themes[theme].SHADOW_HOVER}`}>
                    <input
                        className={`p-2 pr-10 w-full ${themes[theme].BORDER} ${themes[theme].PRIMARY_C} ${themes[theme].SHADOW} hover:shadow-none transition-all duration-300  `}
                        type="text"
                        placeholder="Search by name or PID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
                            onClick={() => setSearchTerm('')}
                        >
                            {Close_ICON}
                        </button>
                    )}
                </div>

                <Tooltip_ text={"Select All"}>
                    <button className={`${themes[theme].INFO_C} max-md:text-xs w-fit p-1 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}   `} onClick={selectAllVisible}>{SelectAll_ICON}</button>
                </Tooltip_>
                <Tooltip_ text={"Clear Selection"}>
                <button className={`${themes[theme].NEUTRAL_C} max-md:text-xs w-fit p-1 ${themes[theme].BORDER} ${themes[theme].SHADOW}  ${themes[theme].SHADOW_HOVER} `} onClick={clearSelection}>{Close_ICON}</button>
                </Tooltip_>
                <Tooltip_ text={"Batch Operations"}>
                    <BatchActionsDropdown showAlert={showAlert} batchAutoRespawn={batchAutoRespawn} batch={setBatch} show={setShowPriorityDialog} selectedPids={selectedPids} setAutoRespawns={setAutoRespawns} />
                </Tooltip_>
                <Tooltip_ text={"Watchlist"}>
                    <WatchListDropdown setWatchedPids={setWatchList} watchedPids={watchList} />
                </Tooltip_>
                <Tooltip_ text={"Respawn List"}>
                    <RespawnListDropdown respawns={autoRespawns} setRespawns={setAutoRespawns} />
                </Tooltip_>
            </div>
            <div>

            <table className={`w-full  font-extrabold border-collapse ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].PRIMARY_C} `}>
                <thead>
                <tr className={`${themes[theme].BORDER}`}>
                    <th className={`w-1 p-2 ${themes[theme].BORDER} ${themes[theme].INFO_C} `}></th>
                    <SortableHeader
                        extra_class={" w-1  "}
                        title={
                            <Tooltip_ text="Process ID">PID</Tooltip_>
                        }
                        sortKey="pid"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />

                    <SortableHeader
                        title={
                            <Tooltip_ text="Process Name">Name</Tooltip_>
                        }
                        sortKey="name"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />
                    {/*read_bytes*/}
                    {
                        settings.rb &&
                            <SortableHeader
                                extra_class={" w-20 px-2 "}
                                title={
                                    <Tooltip_ text="Read Bytes">RB</Tooltip_>
                                }
                                sortKey="read_bytes"
                                requestSort={requestSort}
                                sortConfig={sortConfig}
                            />
                    }

                    {/*written_bytes*/}
                    {
                        settings.wb &&
                            <SortableHeader
                                extra_class={" w-20 px-2 "}
                                title={
                                    <Tooltip_ text="Written Bytes">WB</Tooltip_>
                                }
                                sortKey="written_bytes"
                                requestSort={requestSort}
                                sortConfig={sortConfig}
                            />
                    }
                    {/*total_read_bytes*/}
                    {
                        settings.trb &&
                    <SortableHeader
                        extra_class={" w-20 px-2 "}
                        title={
                            <Tooltip_ text="Total Read Bytes">TRB</Tooltip_>
                        }
                        sortKey="total_read_bytes"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />
                    }

                    {/*total_written_bytes*/}
                    {
                        settings.twb &&
                    <SortableHeader
                        extra_class={" w-20 px-2 "}
                        title={
                            <Tooltip_ text="Total Written Bytes">TWB</Tooltip_>
                        }
                        sortKey="total_written_bytes"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />
                    }
                    {
                        settings.cpu &&
                            <SortableHeader
                                extra_class={" w-20 px-2 "}
                                title={
                                    <Tooltip_ text="CPU Usage (%)">CPU</Tooltip_>
                                }
                                sortKey="cpu"
                                requestSort={requestSort}
                                sortConfig={sortConfig}
                            />
                    }
                    {
                        settings.mem &&
                    <SortableHeader
                        extra_class={" w-20 px-2 "}
                        title={
                            <Tooltip_ text="Memory Usage (MB)">Mem</Tooltip_>
                        }
                        sortKey="memory"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />
                    }
                    {
                        settings.prio &&
                    <SortableHeader
                        title={
                            <Tooltip_ text="Process Priority">Prio</Tooltip_>
                        }
                        sortKey="priority"
                        requestSort={requestSort}
                        sortConfig={sortConfig}
                    />
                    }

                    <th className={`w-1 p-2 ${themes[theme].BORDER} ${themes[theme].INFO_C} `}>
                        <Tooltip_ text="Available Actions">{Actions_ICON}</Tooltip_>
                    </th>
                    {
                        settings.ar &&
                    <th className={`w-1 p-2 ${themes[theme].BORDER} ${themes[theme].INFO_C} `}>
                        <Tooltip_ text="Auto Respawn">{Respawn_ICON}</Tooltip_>
                    </th>
                    }


                </tr>
                </thead>
                <tbody>
                {sortedProcesses.map((proc) => (
                    <React.Fragment key={proc.pid}>
                        <tr
                            className={`border-b ${themes[theme].BORDER} hover:bg-blue-100 cursor-pointer `}
                            onClick={() => toggleExpanded(proc.pid)}>
                            <td className={"p-2"}>
                                <input
                                    type="checkbox"
                                    checked={selectedPids.includes(proc.pid)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleSelectPid(proc.pid);
                                    }}
                                    onClick={(e)=>{
                                        e.preventDefault();
                                        e.stopPropagation();

                                    }}
                                    className="form-checkbox h-4 w-4 "
                                />
                            </td>
                            <td className={"p-2"}>{proc.pid}</td>
                            <td className="p-2">
                                <div
                                    className="break-all text-wrap overflow-hidden"
                                    title={proc.name}
                                >
                                    {proc.name}
                                </div>
                            </td>

                            {
                                settings.rb &&
                            <td className="text-center py-2">{formatBytes(proc.read_bytes)}</td>
                            }
                            {
                                settings.wb &&
                            <td className="text-center py-2">{formatBytes(proc.written_bytes)}</td>
                            }
                            {
                                settings.trb &&
                            <td className="text-center py-2">{formatBytes(proc.total_read_bytes)}</td>
                            }
                            {
                                settings.twb &&
                            <>
                                <td className="text-center py-2">{formatBytes(proc.total_written_bytes)}</td>
                            </>
                            }
                            {
                                settings.cpu &&
                                <td className={" text-center py-2 " + colorCpu(proc.cpu)}>{proc.cpu.toFixed(1)}</td>
                            }
                            {
                                settings.mem &&
                            <td className={" text-center py-2 " + colorMem(proc.memory)}>{(proc.memory / 1024).toFixed(1)}</td>
                            }
                            {
                                settings.prio &&
                                <td className={"py-2"}>{proc.priority}</td>
                            }
                            <td className="space-x-2 py-2">
                                <ActionDropdown
                                    handlePriority={handleSetPriority}
                                    watchList={watchList}
                                    setWatchList={setWatchList}
                                    proc={proc}
                                    autoRespawns={autoRespawns}
                                    setAutoRespawns={setAutoRespawns}
                                    openLimitDialog={() => openLimitDialog(proc)}
                                />
                            </td>
                        {
                            settings.ar &&
                            <td>
                                {autoRespawns.includes(proc.pid) && (
                                    <span className={`${themes[theme].SUCCESS_C} ${themes[theme].BORDER} px-2 py-1 text-xs font-bold ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} `}>✅</span>
                                )}
                            </td>
                        }
                        </tr>

                        {expandedPids.includes(proc.pid) && (
                            <tr>
                                <td className={"p-2"} colSpan={12}>
                                    <MiniProcessChart
                                        data_={historyMap.get(proc.pid)?.cpuData || []}
                                        label={"CPU"}
                                        backgroundColor={"#e0f7fa"}
                                        borderColor={"#00bcd4"}
                                        labels={historyMap.get(proc.pid)?.labels || []}
                                    />
                                    <MiniProcessChart
                                        data_={historyMap.get(proc.pid)?.ramData || []}
                                        label={"RAM"}
                                        backgroundColor={"#e8f5e9"}
                                        borderColor={"#4caf50"}
                                        labels={historyMap.get(proc.pid)?.labels || []}
                                    />
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}

                </tbody>
            </table>
            </div>

            <div className={`mt-6 p-4 ${themes[theme].EVENT_C} ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} h-64 overflow-y-scroll  `}>
                <h2 className="text-lg font-bold mb-2 flex">{Log_ICON} Event Log</h2>
                <pre className="text-sm">
                    {logs.map((line, idx) => <div key={idx}>{line}</div>)}
                </pre>
            </div>
        </div>
        </div>
    );
}
