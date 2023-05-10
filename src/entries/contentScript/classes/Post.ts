export default class Post {
    postId: number
    author: string
    content: string
    timestamp: Date

    constructor(postId: number, author: string, content: string, timestamp: Date) {
        this.postId = postId
        this.author = author
        this.content = content
        this.timestamp = timestamp
    }
}