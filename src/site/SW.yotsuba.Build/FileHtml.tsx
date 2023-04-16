import h, { EscapedHtml, isEscaped } from '../../globals/jsx'

type File = {
  MD5: string
  name: string
  size: string
  dimensions: string
  tag: string
  width: number
  height: number
  twidth: number
  theight: number
  hasDownscale: boolean
  isSpoiler: boolean
}

export default function generateFileHtml(
  file: File | null,
  ID: number,
  boardID: string,
  fileURL: string,
  shortFilename: string,
  fileThumb: string,
  o: any,
  staticPath: string,
  gifIcon: string,
): EscapedHtml {
  if (file) {
    const fileContent: (EscapedHtml | string)[] = []
    if (boardID === 'f') {
      fileContent.push(
        <div class="fileInfo" data-md5={file.MD5}>
          <span class="fileText" id={`fT${ID}`}>
            {'File: '}
            <a
              data-width={file.width}
              data-height={file.height}
              href={fileURL}
              target="_blank"
            >
              {file.name}
            </a>
            -({file.size}, {file.dimensions}
            {file.tag ? ', ' + file.tag : ''})
          </span>
        </div>,
      )
    } else {
      fileContent.push(
        <div
          class="fileText"
          id={`fT${ID}`}
          title={file.isSpoiler ? file.name : null}
        >
          {'File: '}
          <a
            title={
              file.name === shortFilename || file.isSpoiler ? null : file.name
            }
            href={fileURL}
            target="_blank"
          >
            {file.isSpoiler ? 'Spoiler Image' : shortFilename}
          </a>
          {` (${file.size}, ${file.dimensions || 'PDF'})`}
        </div>,
        <a
          class={`fileThumb${file.isSpoiler ? ' imgspoiler' : ''}`}
          href={fileURL}
          target="_blank"
          data-m={file.hasDownscale ? '' : null}
        >
          <img
            src={fileThumb}
            alt={file.size}
            data-md5={file.MD5}
            style={`height: ${
              file.isSpoiler ? '100' : file.theight
            }px; width: ${file.isSpoiler ? '100' : file.twidth}px;`}
            loading="lazy"
          />
        </a>,
      )
    }
    return (
      <div class="file" id={`f${ID}`}>
        {...fileContent}
      </div>
    )
  } else if (o.fileDeleted) {
    return (
      <div class="file" id={`f${ID}`}>
        <span class="fileThumb">
          <img
            src={`${staticPath}filedeleted-res${gifIcon}`}
            alt="File deleted."
            class="fileDeletedRes retina"
          />
        </span>
      </div>
    )
  }
  return { innerHTML: '', [isEscaped]: true }
}
