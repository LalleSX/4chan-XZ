import { Conf, g } from "../globals/globals"

const NormalizeURL = {
  init() {
    if (!Conf['Normalize URL']) { return }

    const pathname = location.pathname.split(/\/+/)
    if (g.SITE.software === 'yotsuba') {
      switch (g.VIEW) {
        case 'thread':
          pathname[2] = 'thread'
          pathname.slice(0, 4)
          break
        case 'index':
          pathname.slice(0, 3)
          break
      }
    }
    pathname.join('/')
    if (pathname !== pathname) {
      return history.replaceState(history.state, '', `${location.protocol}//${location.host}${pathname}${location.hash}`)
    }
  }
}
export default NormalizeURL
