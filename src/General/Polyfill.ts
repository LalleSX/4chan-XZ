import $ from '../platform/$'

interface ElementWithMatches {
  mozMatchesSelector?: (selector: string) => boolean
  webkitMatchesSelector?: (selector: string) => boolean
}

const Polyfill = {
  init(): void {
    this.toBlob()
    $.global(this.toBlob)
    if (!Element.prototype.matches) {
      Element.prototype.matches =
        (Element.prototype as Element & ElementWithMatches)
          .mozMatchesSelector ||
        (Element.prototype as Element & ElementWithMatches)
          .webkitMatchesSelector
    }
  },
  toBlob(): void {
    if (HTMLCanvasElement.prototype.toBlob !== undefined) {
      return
    }
    HTMLCanvasElement.prototype.toBlob = function (
      cb: (blob: Blob) => void,
      type?: string,
      encoderOptions?: any
    ): void {
      const url = this.toDataURL(type, encoderOptions)
      const data = atob(url.slice(url.indexOf(',') + 1))
      const l = data.length
      const ui8a = new Uint8Array(l)
      for (let i = 0; i < l; i++) {
        ui8a[i] = data.charCodeAt(i)
      }
      cb(new Blob([ui8a], { type: type || 'image/png' }))
    }
  },
}

export default Polyfill
