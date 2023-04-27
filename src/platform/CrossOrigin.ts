import { Options } from '../../node_modules/@vitejs/plugin-react/dist/index'
import QR from '../Posting/QR'
import $ from './$'
import { dict, platform } from './helpers'

type Callback = (response: any, responseHeaderString?: string) => void
type GMXhrCallback = (xhr: XMLHttpRequestResponseType) => void

let eventPageRequest: ((params: any, cb: Callback) => void) | undefined
if (platform === 'crx') {
  eventPageRequest = (function () {
    const callbacks: { [id: string]: Callback } = {}
    chrome.runtime.onMessage.addListener(function (response) {
      callbacks[response.id](response.data)
      return delete callbacks[response.id]
    })
    return (params: any, cb: Callback) =>
      chrome.runtime.sendMessage(params, id => (callbacks[id] = cb))
  })()
}

interface ICrossOrigin {
  binary(url: string, cb: Callback, headers?: typeof dict): void
  file(url: string, cb: Callback): void
  Request: Request
  ajax(url: string, options?: any): any
  cache(url: string, cb: Callback): void
  permission(cb: () => void, cbFail: () => void, origins?: any): void
}

const CrossOrigin: ICrossOrigin = {
  binary(url, cb, headers = dict()) {
    url = url.replace(
      /^((?:https?:)?\/\/(?:\w+\.)?(?:4chan|4channel|4cdn)\.org)\/adv\//,
      '$1//adv/'
    )
    if (platform === 'crx') {
      eventPageRequest?.(
        { type: 'ajax', url, headers, responseType: 'arraybuffer' },
        function ({ response, responseHeaderString }) {
          if (response) {
            response = new Uint8Array(response)
          }
          return cb(response, responseHeaderString)
        }
      )
    } else {
      const fallback = function () {
        return $.ajax(url, {
          headers,
          responseType: 'arraybuffer',
          onloadend() {
            if (this.status && this.response) {
              return cb(
                new Uint8Array(this.response),
                this.getAllResponseHeaders()
              )
            } else {
              return cb(null)
            }
          },
        })
      }
      if (
        typeof window.GM_xmlhttpRequest === 'undefined' ||
        window.GM_xmlhttpRequest === null
      ) {
        fallback()
        return
      }
      const gmOptions: any = {
        method: 'GET',
        url,
        headers,
        responseType: 'arraybuffer',
        overrideMimeType: 'text/plain; charset=x-user-defined',
        onload: xhr => {
          let data
          if (xhr.response instanceof ArrayBuffer) {
            data = new Uint8Array(xhr.response)
          } else {
            const r = xhr.responseText
            data = new Uint8Array(r.length)
            let i = 0
            while (i < r.length) {
              data[i] = r.charCodeAt(i)
              i++
            }
          }
          return cb(data, xhr.responseHeaders)
        },
        onerror: () => cb(null),
        onabort: () => cb(null),
      }
      try {
        return window.GM_xmlhttpRequest(gmOptions)
      } catch (error) {
        return fallback()
      }
    }
  },
  file(url, cb) {
    return CrossOrigin.binary(url, function (data, headers) {
      if (data == null) {
        return cb(null)
      }
      let name = url.match(/([^\/?#]+)\/*(?:$|[?#])/)?.[1]
      const contentType = headers.match(/Content-Type:\s*(.*)/i)?.[1]
      const contentDisposition = headers.match(
        /Content-Disposition:\s*(.*)/i
      )?.[1]
      let mime = contentType?.match(/[^;]*/)[0] || 'application/octet-stream'
      const match =
        contentDisposition?.match(/\bfilename\s*=\s*"((\\"|[^"])+)"/i)?.[1] ||
        contentType?.match(/\bname\s*=\s*"((\\"|[^"])+)"/i)?.[1]
      if (match) {
        name = match.replace(/\\"/g, '"')
      }
      if (/^text\/plain;\s*charset=x-user-defined$/i.test(mime)) {
        mime =
          $.getOwn(
            QR.typeFromExtension,
            name.match(/[^.]*$/)[0].toLowerCase()
          ) || 'application/octet-stream'
      }
      const blob = new Blob([data], { type: mime })
      return cb({ name, blob })
    })
  },
  Request: (function () {
    class Request {
      status: number
      statusText: string
      response: any
      responseHeaders: string

      constructor() {
        this.status = 0
        this.statusText = ''
        this.response = null
        this.responseHeaders = ''
      }
      getResponseHeader(headerName: string) {
        const match = this.getResponseHeader
          .toString()
          .match(new RegExp(`^${headerName}: (.*)`, 'im'))
        return match?.[1]
      }
      abort() { }

      onloadend() { }
    }
    return Request
  })(),
  ajax(url, options: any = {}) {
    let gmReq: any
    let { onloadend, timeout, responseType, headers } = options
    if (responseType == null) {
      responseType = 'json'
    }
    if (onloadend == null) {
      onloadend = function () { }
    } else {
      onloadend = onloadend.bind(this)
    }
    const req = new CrossOrigin.Request()
    req.onloadend = onloadend
    if (platform === 'userscript') {
      const gmOptions: any = {
        method: 'GET',
        url,
        headers,
        timeout,
        onload: xhr => {
          try {
            const response = (() => {
              switch (responseType) {
                case 'json':
                  if (xhr.responseText) {
                    return JSON.parse(xhr.responseText)
                  } else {
                    return null
                  }
                default:
                  return xhr.responseText
              }
            })()
            Object.assign(req, {
              response,
              status: xhr.status,
              statusText: xhr.statusText,
              responseHeaderString: xhr.responseHeaders,
            })
          } catch (error) { null }
          return req.onloadend()
        },
        onerror: () => req.onloadend(),
        onabort: () => req.onloadend(),
        ontimeout: () => req.onloadend(),
      }
      try {
        gmReq = (GM?.xmlHttpRequest || GM_xmlhttpRequest)(gmOptions)
      } catch (error) {
        return $.ajax(url, options)
      }

      if (gmReq && typeof gmReq.abort === 'function') {
        req.abort = function () {
          try {
            return gmReq.abort()
          } catch (error1) { }
        }
      }
    } else {
      eventPageRequest?.(
        { type: 'ajax', url, headers, responseType, timeout },
        function ({ response, responseHeaderString }) {
          Object.assign(req, {
            response,
            status: 200,
            statusText: 'OK',
            responseHeaderString,
          })
          return req.onloadend()
        }
      )
    }
    return req
  },
  cache(url, cb) {
    const cached = CrossOrigin.cache[url]
    if (cached) {
      return cb(cached)
    } else {
      return CrossOrigin.binary(url, function (data) {
        if (data == null) {
          return cb(null)
        }
        const blob = new Blob([data])
        CrossOrigin.cache[url] = blob
        return cb(blob)
      })
    }
  },
  permission(cb, cbFail, origins) {
    if (platform === 'crx') {
      return eventPageRequest(
        { type: 'permission', origins },
        function (result) {
          if (result) {
            return cb()
          } else {
            return cbFail()
          }
        }
      )
    } else {
      return cb()
    }
  },
}

export default CrossOrigin
