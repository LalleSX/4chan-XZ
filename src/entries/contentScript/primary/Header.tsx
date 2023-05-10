import React from "react"
import $ from "jquery"

const Header = () => {
	const headerText = "Hello world"
	return (
		<header className="fixed top-0 left-0 w-full flex items-center shadow-md h-5 bg-indigo-50">
			<a href=".">
				<p className="text-black font-bold">{headerText}</p></a>
		</header>
	)
}

export default Header
