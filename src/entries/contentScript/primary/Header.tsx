import React, { useState } from "react"
import SettingsPopup from "./SettingsPopup"
import $ from "jquery"



const Header = () => {
	// Get the board name from the URL (e.g. /g/ or /pol/)
	const board = window.location.pathname.split("/")[1]
	// Get the URL for the index page of the board
	const indexUrl = `https://boards.4chan.org/${board}/`
	// Get the URL for the catalog page of the board
	const catalogUrl = `https://boards.4chan.org/${board}/catalog`
	const [settingsVisible, setSettingsVisible] = useState<boolean>(false)
	// Remove the default header
	$("#boardNavDesktop").remove()
	$(".danbo-slot").remove()
	$("h4").remove()
	$(".abovePostForm").remove()
	$(".boardList").remove()
	$("#boardNavMobile").remove()

	const toggleSettingsPopup = () => {
		setSettingsVisible(!settingsVisible)
	}

	return (
		<div className=" bg-indigo-50 text-gray-900 py-2 px-4 flex justify-between items-center fixed top-0 left-0 w-full border-b border-gray-300 z-10">
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
					<SettingsPopup onClose={toggleSettingsPopup} />
				</div>
			)}
		</div>
	)
}

export default Header
