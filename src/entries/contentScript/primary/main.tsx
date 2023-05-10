import "../../enableDevHmr"
import React from "react"
import ReactDOM from "react-dom/client"
import renderContent from "../renderContent"
import App from "./App"
import "../../../index.css"
import Header from "./Header"
import Catalog from "./Catalog"
import Post from "../classes/Post"
import Thread from "../classes/Thread"

renderContent(import.meta.PLUGIN_WEB_EXT_CHUNK_CSS_PATHS, (appRoot) => {
	ReactDOM.createRoot(appRoot).render(
		<React.StrictMode>
			<App />
			<Header />
			<Catalog />
		</React.StrictMode>
	)
})


// Usage example:

const opPost = new Post(1, "Anonymous", "Hello, this is the first post in the thread!", new Date())
const thread = new Thread(12345, "Example Thread", opPost)

const reply1 = new Post(2, "Anonymous", "Nice thread!", new Date())
thread.addReply(reply1)

console.log("Thread ID:", thread.threadId)
console.log("Thread Title:", thread.title)
console.log("Number of Replies:", thread.getReplyCount())