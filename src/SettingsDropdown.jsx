import React, { createContext, useContext, useEffect, useState } from 'react';

const defaultSettings = {
    rb: true,
    wb: true,
    trb: true,
    twb: true,
    cpu: true,
    mem: true,
    prio: true,
    ar: true,
};

const ChartSettingsContext = createContext({
    settings: defaultSettings,
    toggleSetting: () => {},
});

export const useChartSettings = () => useContext(ChartSettingsContext);

export const ChartSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const stored = localStorage.getItem('chartSettings');
        return stored ? JSON.parse(stored) : defaultSettings;
    });

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
        <ChartSettingsContext.Provider value={{ settings, toggleSetting }}>
            {children}
        </ChartSettingsContext.Provider>
    );
};



const settingLabels = {
    rb: 'RB',
    wb: 'WB',
    trb: 'TRB',
    twb: 'TWB',
    cpu: 'CPU',
    mem: 'Memory',
    prio: 'Priority',
    ar: 'AR',
};

export const ChartDropdown = () => {
    const { settings, toggleSetting } = useChartSettings();
    const [open, setOpen] = useState(false);

    return (
        <div className="relative font-extrabold">
            <button
                className="flex items-center gap-2 text-sm bg-gray-800 text-white border-black border-2 px-3 py-1 rounded hover:bg-gray-700"
                onClick={() => setOpen((prev) => !prev)}
            >
                Chart
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-black shadow-lg rounded p-3 z-50">

                    <div className="flex flex-col gap-2">
                        {Object.entries(settingLabels).map(([key, label]) => (
                            <label key={key} className="flex items-center text-sm gap-2">
                                <input
                                    type="checkbox"
                                    checked={settings[key]}
                                    onChange={() => toggleSetting(key)}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
