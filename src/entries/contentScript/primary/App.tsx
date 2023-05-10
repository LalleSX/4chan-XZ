import React from "react"
import logo from "~/assets/logo.svg"


function App() {
	const logoImageUrl = new URL(logo, import.meta.url).href

	return (
		<div className="
			z-50
			fixed
			bottom-0
			right-0
			w-16
			h-16
			flex
			justify-center
			items-center
			border-4
			border-red-500
			rounded-full
			bg-white
			">
			<img src={logoImageUrl} height="50" alt="" className="position-absolute top-0 left-0" />
		</div>
	)
}

export default App
