declare const XPCNativeWrapper: any
export interface File {
    name: string
    isImage: boolean
    isVideo: boolean
    thumb: HTMLElement
    url: string
    dimensions: string
    index: number
    isExpanding: boolean
    isExpanded: boolean
    text: string,
    link: HTMLAnchorElement
    thumbLink: HTMLElement
    size: string
    sizeInBytes: number
    isDead: boolean
    docIndex: number
}