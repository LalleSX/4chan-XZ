import { Conf, doc, g } from '../globals/globals'
import Main from '../main/Main'
import $ from '../platform/$'
import { dict } from '../platform/helpers'
import SW from './SW'

var Site = {
  defaultProperties: {
    '4chan.org': { software: 'yotsuba' },
    '4channel.org': { canonical: '4chan.org' },
    '4cdn.org': { canonical: '4chan.org' },
    'notso.smuglo.li': { canonical: 'smuglo.li' },
    'smugloli.net': { canonical: 'smuglo.li' },
    'smug.nepu.moe': { canonical: 'smuglo.li' },
  },

  init(cb: () => void): void {
    $.extend(Conf['siteProperties'], Site.defaultProperties)
    let hostname = Site.resolve()
    if (hostname && $.hasOwn(SW, Conf['siteProperties'][hostname].software)) {
      this.set(hostname)
      cb()
    }
    return $.onExists(doc, 'body', () => {
      for (var software in SW) {
        var changes = null
        if ((changes = SW[software].detect?.())) {
          changes.software = software
          hostname = location.hostname.replace(/^www\./, '')
          var properties =
            Conf['siteProperties'][hostname] ||
            (Conf['siteProperties'][hostname] = dict())
          var changed = 0
          for (var key in changes) {
            if (properties[key] !== changes[key]) {
              properties[key] = changes[key]
              changed++
            }
          }
          if (changed) {
            $.set('siteProperties', Conf['siteProperties'])
          }
          if (!g.SITE) {
            this.set(hostname)
            cb()
          }
          return
        }
      }
    })
  },

  resolve(url = location.href): string {
    let { hostname: hostname } = new URL(url)
    while (hostname && !$.hasOwn(Conf['siteProperties'], hostname)) {
      hostname = hostname.replace(/^[^.]*\.?/, '')
    }
    if (hostname) {
      let canonical: string
      if ((canonical = Conf['siteProperties'][hostname].canonical)) {
        hostname = canonical
      }
    }
    return hostname
  },

  parseURL(url: any): any {
    const siteID = Site.resolve(url)
    return Main.parseURL(g.sites[siteID], url)
  },
  set(hostname: string) {
    for (var ID in Conf['siteProperties']) {
      var site: HTMLElement
      var properties = Conf['siteProperties'][ID]
      if (properties.canonical) {
        continue
      }
      var { software } = properties
      if (!software || !$.hasOwn(SW, software)) {
        continue
      }
      g.sites[ID] = site = Object.create(SW[software])
      $.extend(site, { ID, siteID: ID, properties, software })
    }
    return (g.SITE = g.sites[hostname])
  },
}
export default Site
