import "../../enableDevHmr"
import React from "react"
import ReactDOM from "react-dom/client"
import renderContent from "../renderContent"
import App from "./App"
import "../../../index.css"
import { initImageHovering } from "../image"
import $ from "jquery"
import Header from "./Header"
import { Thread } from "~/types/thread"




renderContent(import.meta.PLUGIN_WEB_EXT_CHUNK_CSS_PATHS, (appRoot) => {
	ReactDOM.createRoot(appRoot).render(
		<React.StrictMode>
			<App />
			<Header />
		</React.StrictMode>
	)
})


// Initialize the image hovering functionality once the document is ready
$(document).ready(() => {
	console.log("Document is ready!")
	initImageHovering()
	// Assume the 4chan API URL is like this
	const apiUrl = "https://a.4cdn.org/{board}/catalog.json"

	// Replace {board} with the actual board name
	const boardName = window.location.pathname.split("/")[1]
	const boardApiUrl = apiUrl.replace("{board}", boardName)

	$.getJSON(boardApiUrl, (data) => {
		const threads = data.flatMap((page: { threads: Thread[] }) => page.threads)
		threads.forEach((thread: Thread) => {
			const threadId = thread.no
			const comment = thread.com
			const subject = thread.sub

			// Assuming each thread teaser has an id like `thread-{id}`
			const threadTeaser = $(`#thread-${threadId} > .teaser`)
			if (threadTeaser.length > 0) {
				// Replace the teaser with the comment
				threadTeaser.html(comment)
				// Add the subject to the top of the comment if it exists
				if (subject) {
					threadTeaser.prepend(`<span class= "subject">${subject}</span> <br>`)
					threadTeaser.find(".subject").css("color", "#0f0c5d").css("font-weight", "700")
				}
				// Add css to the class "quote" and make the text green #789922
				threadTeaser.find(".quote").css("color", "#789922")
			}
		})
	})
})