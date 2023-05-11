import React, { useState } from "react"
import Header from "./Header"

interface ConfigProps {
    main: {
        ImageHover: boolean;
    };
}

const defaultConfig: ConfigProps = {
    main: {
        ImageHover: true,
    },
}

const SettingsPopup: React.FC = () => {
    const [config, setConfig] = useState<ConfigProps>(defaultConfig)
    const [activeTab, setActiveTab] = useState<string>("Main")

    const handleImageHoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, main: { ...config.main, ImageHover: e.target.checked } })
    }

    return (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center">
            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-semibold">Settings</h1>

                    <button
                        className="text-red-500 hover:text-red-600"
                        onClick={() => {
                            chrome.storage.sync.set({ config })
                            window.location.reload()
                        }}
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            ></path>
                        </svg>
                    </button>

                </div>
                <div className="flex mb-4">
                    <button
                        className={`mr-4 ${activeTab === "Main" ? "font-semibold" : ""}`}
                        onClick={() => setActiveTab("Main")}
                    >
                        Main
                    </button>
                    <button
                        className={`${activeTab === "Advanced" ? "font-semibold" : ""}`}
                        onClick={() => setActiveTab("Advanced")}
                    >
                        Advanced
                    </button>
                </div>
                {activeTab === "Main" && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="image-hover" className="flex items-center">
                                <input
                                    id="image-hover"
                                    type="checkbox"
                                    className="mr-2"
                                    checked={config.main.ImageHover}
                                    onChange={handleImageHoverChange}
                                />
                                Image Hover
                            </label>
                        </div>
                    </div>
                )}
                {activeTab === "Advanced" && (
                    <div>
                        {/* Add advanced settings here */}
                        <p>Advanced settings will be added here.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SettingsPopup
