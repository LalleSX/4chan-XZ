import { Conf, doc, g } from '../globals/globals'
import Main from '../main/Main'
import $ from '../platform/$'
import { dict } from '../platform/helpers'
import SW from './SW'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const Site = {
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
      for (const software in SW) {
        var changes: { [key: string]: string }
        if ((changes = SW[software].detect?.())) {
          changes.software = software
          hostname = location.hostname.replace(/^www\./, '')
          const properties =
            Conf['siteProperties'][hostname] ||
            (Conf['siteProperties'][hostname] = dict())
          let changed = 0
          for (const key in changes) {
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

  resolve(url = location): string {
    let { hostname } = url
    while (hostname && !$.hasOwn(Conf['siteProperties'], hostname)) {
      hostname = hostname.replace(/^[^.]*\.?/, '')
    }
    if (hostname) {
      let canonical
      if ((canonical = Conf['siteProperties'][hostname].canonical)) {
        hostname = canonical
      }
    }
    return hostname
  },

  parseURL(url: Location): ReturnType<typeof Main.parseURL> {
    const siteID = Site.resolve(url)
    return siteID ? g.sites[siteID].parseURL(url) : null
  },

  set(hostname: string): typeof g.SITE {
    for (const ID in Conf['siteProperties']) {
      let site: typeof g.SITE
      const properties = Conf['siteProperties'][ID]
      if (properties.canonical) {
        continue
      }
      const { software } = properties
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
