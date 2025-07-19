import {webview, webviewWindow} from "@tauri-apps/api";
import {Close_ICON} from "./utils.jsx";
import {ThemeSelector, useTheme} from "./ThemeChanger.jsx";
import themes from "./styles.js"
import {ChartDropdown} from "./SettingsDropdown.jsx";
const TitleBar = () => {
    const { theme, setTheme } = useTheme();
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
    };
    return (
        <div data-tauri-drag-region className={` ${themes[theme].TITLEBAR_C} flex justify-center items-start box-border rounded-none`}>
            <div data-tauri-drag-region className={`w-full rounded-none border-t-0 border-x-0 `}>
                <div data-tauri-drag-region className={"flex items-center justify-between p-2 "}>
                    <div data-tauri-drag-region className="flex items-center">
                        <span className={"text-lg font-extrabold  tracking-tight uppercase mr-4"}>
                            GUI Reaper
                        </span>
                        <div data-tauri-drag-region className={"w-4 h-4 bg-red-500 border-2 border-black rounded-full"}></div>
                    </div>

                    <div data-tauri-drag-region className="flex space-x-2">
                        <ChartDropdown />
                        <ThemeSelector currentTheme={theme} onChange={handleThemeChange} />

                        <button
                            onClick={()=>{webviewWindow.getCurrentWebviewWindow().minimize()}}
                            className={`w-[27px] h-[27px]  flex items-center justify-center bg-white text-black border-2 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER}  transition-all duration-150 ease-in-out active:shadow-none active:translate-x-[4px] active:translate-y-[4px]`}>
                            <svg className="w-4 h-4 " fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4"></path>
                            </svg>
                        </button>
                        <button
                            onClick={()=>{webviewWindow.getCurrentWebviewWindow().toggleMaximize()}}
                            className={`w-[27px] h-[27px] flex items-center justify-center bg-white text-black border-2 ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} transition-all duration-150 ease-in-out active:shadow-none active:translate-x-[4px] active:translate-y-[4px]`}>
                            <svg className={"w-4 h-4 "} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M200 32H56c-13.3 0-24 10.7-24 24v144c0 9.7 5.8 18.5 14.8 22.2s19.3 1.7 26.2-5.2l40-40l79 79l-79 79l-40-40c-6.9-6.9-17.2-8.9-26.2-5.2S32 302.3 32 312v144c0 13.3 10.7 24 24 24h144c9.7 0 18.5-5.8 22.2-14.8s1.7-19.3-5.2-26.2l-40-40l79-79l79 79l-40 40c-6.9 6.9-8.9 17.2-5.2 26.2S302.3 480 312 480h144c13.3 0 24-10.7 24-24V312c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2l-40 40l-79-79l79-79l40 40c6.9 6.9 17.2 8.9 26.2 5.2S480 209.7 480 200V56c0-13.3-10.7-24-24-24H312c-9.7 0-18.5 5.8-22.2 14.8S288.1 66.1 295 73l40 40l-79 79l-79-79l40-40c6.9-6.9 8.9-17.2 5.2-26.2S209.7 32 200 32"></path></svg>
                        </button>
                        <button
                            onClick={()=>{webviewWindow.getCurrentWebviewWindow().close()}}
                            className={`w-[27px] h-[27px] flex items-center justify-center ${themes[theme].ERROR_C} ${themes[theme].BORDER} ${themes[theme].SHADOW} ${themes[theme].SHADOW_HOVER} transition-all duration-150 ease-in-out active:shadow-none active:translate-x-[4px] active:translate-y-[4px]`}>
                            {Close_ICON}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TitleBar;
