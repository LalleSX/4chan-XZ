import Post from "./Post"

class Board {
    boardName: string
    apiUrl: string
    posts: Post[]

    constructor(boardName: string) {
        this.boardName = boardName
        this.apiUrl = `https://a.4cdn.org/${boardName}/threads.json`
        this.posts = []
    }

    async fetchThreads() {
        try {
            const response = await fetch(this.apiUrl)
            const data = await response.json()
            console.log(data)
            // Process data and populate this.posts
        } catch (error) {
            console.error("Error fetching threads:", error)
        }
    }
    // Add more methods to interact with the 4chan API and manage the data
}

export default Board
