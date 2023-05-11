import "../../enableDevHmr"
import React from "react"
import ReactDOM from "react-dom/client"
import renderContent from "../renderContent"
import App from "./App"
import "../../../index.css"
import { initImageHovering } from "../image"
import $ from "jquery"
import Header from "./Header"

renderContent(import.meta.PLUGIN_WEB_EXT_CHUNK_CSS_PATHS, (appRoot) => {
	ReactDOM.createRoot(appRoot).render(
		<React.StrictMode>
			<App />
			<Header board="pol" />
		</React.StrictMode>
	)
})


// Initialize the image hovering functionality once the document is ready
$(document).ready(() => {
	console.log("Document is ready!")
	initImageHovering()
})