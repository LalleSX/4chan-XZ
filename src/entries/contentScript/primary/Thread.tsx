// Thread.tsx
import React from "react"

interface ThreadProps {
  threadId: number;
  imageUrl: string;
  replies: number;
  teaser: string;
  board: string;
  customImageUrl: string;
}

const Thread: React.FC<ThreadProps> = ({
  threadId,
  imageUrl,
  replies,
  teaser,
  board,
  customImageUrl,
}) => {
  const newImageUrl = customImageUrl || imageUrl

  return (
    <div id={`thread-${threadId}`} className="thread">
      <a href={`//boards.4channel.org/${board}/thread/${threadId}`}>
        <img
          loading="lazy"
          alt=""
          id={`thumb-${threadId}`}
          className="thumb"
          src={newImageUrl}
          data-id={threadId}
        />
      </a>
      <div title="(R)eplies / (I)mage Replies" id={`meta-${threadId}`} className="meta">
        R: <b>{replies}</b>
        <a href="#" className="postMenuBtn" title="Thread Menu" data-post-menu={threadId}>
          ▶
        </a>
      </div>
      <div className="teaser">{teaser}</div>
    </div>
  )
}

export default Thread
