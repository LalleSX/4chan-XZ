import Post from "./Post"


export default class Thread {
    threadId: number
    title: string
    opPost: Post
    replies: Post[]

    constructor(threadId: number, title: string, opPost: Post) {
        this.threadId = threadId
        this.title = title
        this.opPost = opPost
        this.replies = []
    }

    addReply(reply: Post): void {
        this.replies.push(reply)
    }

    getReplyCount(): number {
        return this.replies.length
    }
}