import React from "react"
import $ from "jquery"
import Board from "../classes/Board"

const Catalog = () => {
	const catalogText = "Hello world"
	new Board("g")
	return (
		<div className="flex flex-col items-center justify-center">
			<div className="flex flex-row items-center justify-center">
				<p className="text-black font-bold">{catalogText}</p>
			</div>
		</div>
	)
}

export default Catalog