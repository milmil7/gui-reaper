import {createContext, useContext, useEffect, useState} from "react";

const themes = [
    {
        name: 'Phantom',
        key: 'phantom',
        colors: ['#1e293b', '#3b82f6', '#818cf8', '#f9fafb', '#b45309'],
    },
    {
        name: 'Reaper',
        key: 'reaper',
        colors: ['#0f0f0f', '#1c1c1c', '#6b0f0f', '#999999', '#f8fafc'],
    },
    {
        name: 'Void',
        key: 'void',
        colors: ['#ffffff', '#000000', '#cccccc', '#999999', '#f5f5f5'],
    },
    {
        name: 'Gore',
        key: 'gore',
        colors: ['#7f1d1d', '#312e81', '#581c87', '#facc15', '#dc2626'],
    },
    {
        name: 'Pop',
        key: 'pop',
        colors: ['#6EE7B7', '#93C5FD', '#FBBF24', '#F472B6', '#C4B5FD'],
    },
];

export const ThemeSelector = () => {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);

    const selected = themes.find((t) => t.key === theme);

    return (
        <div className="relative font-extrabold inline-block text-left text-black">
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1 bg-white border-2 border-black rounded-md hover:bg-gray-100 transition"
            >
                {selected?.colors.map((color, i) => (
                    <span
                        key={i}
                        className="w-3 h-3 rounded-full border border-black"
                        style={{ backgroundColor: color }}
                    />
                ))}
                <span className="text-sm ml-1">{selected?.name ?? 'Theme'}</span>
                <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute z-[1111] mt-1 w-48 bg-white border-2 border-black rounded-md shadow-lg">
                    {themes.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => {
                                setTheme(t.key);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 ${
                                theme === t.key ? 'bg-gray-200' : ''
                            }`}
                        >
                            {t.colors.map((color, i) => (
                                <span
                                    key={i}
                                    className="w-3 h-3 rounded-full border border-black"
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            <span className="text-sm ml-1">{t.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return (localStorage.getItem('theme') || 'pop')
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};
