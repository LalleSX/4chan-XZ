import $ from "jquery"
import { Config } from "../options/Conf"

/**

    Initializes the image hovering functionality for 4chan.
    */
export function initImageHovering(): void {
    // Get the user's configuration
    const config = Config.main.ImageHover

    // If the user has disabled image hovering, do nothing
    if (!config.valueOf()) {
        return
    }

    // Find all thumbnail images on the page
    const thumbnails = $("a.fileThumb")

    // Attach hover events to each thumbnail image
    thumbnails.each(function () {
        const thumbnail = $(this)
        const imageUrl = thumbnail.attr("href") as string

        // Create a new image element to be displayed on hover
        const hoverImage = $("<img>")
            .attr("src", imageUrl)
            .css({
                position: "fixed",
                display: "none",
                border: "none",
                maxWidth: "100%",
                maxHeight: "100%",
            })
            .appendTo("body")

        // Show the image on mouseover and hide it on mouseout
        thumbnail
            .on("mouseover", () => {
                hoverImage.show()
            })
            .on("mouseout", () => {
                hoverImage.hide()
            })

        // Update the hover image position based on the mouse cursor
        thumbnail.on("mousemove", (event) => {
            const offsetX = 10
            const offsetY = 10

            const imageWidth = hoverImage.width() as number
            const imageHeight = hoverImage.height() as number

            const windowWidth = $(window).width() as number
            const windowHeight = $(window).height() as number

            const left = Math.min(event.pageX + offsetX, windowWidth - imageWidth - offsetX)
            const top = Math.min(event.pageY + offsetY, windowHeight - imageHeight - offsetY)

            hoverImage.css({
                left: left + "px",
                top: top + "px",
            })
        })
    })
}
