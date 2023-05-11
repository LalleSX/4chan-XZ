import React, { useState } from "react"
import SettingsPopup from "./SettingsPopup"

interface HeaderBarProps {
	board: string;
}

const Header: React.FC<HeaderBarProps> = ({ board }) => {
	const indexUrl = `https://boards.4chan.org/${board}/`
	const catalogUrl = `https://boards.4chan.org/${board}/catalog`
	const [settingsVisible, setSettingsVisible] = useState<boolean>(false)

	const toggleSettingsPopup = () => {
		setSettingsVisible(!settingsVisible)
	}

	return (
		<div className=" bg-indigo-50 text-gray-900 py-2 px-4 flex justify-between items-center fixed top-0 left-0 w-full">
			<div className="flex">
				<a href={indexUrl} className="mx-2 hover:text-red-500">
					Index
				</a>
				<a href={catalogUrl} className="mx-2 hover:text-red-500">
					Catalog
				</a>
			</div>
			<button
				onClick={toggleSettingsPopup}
				className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-1.5 rounded"
			>
				Settings
			</button>
			{settingsVisible && (
				<div className="absolute right-0 mt-2">
					<SettingsPopup />
				</div>
			)}
		</div>
	)
}

export default Header
