import Callbacks from '../classes/Callbacks'
import { g, Conf } from '../globals/globals'
import $ from '../platform/$'
import { dict } from '../platform/helpers'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var IDColor = {
  init() {
    if (!['index', 'thread'].includes(g.VIEW) || !Conf['Color User IDs']) {
      return
    }
    this.ids = dict()
    this.ids['Heaven'] = [0, 0, 0, '#fff']

    return Callbacks.Post.push({
      name: 'Color User IDs',
      cb: this.node,
    })
  },

  node() {
    let span, uid
    if (
      this.isClone ||
      !((uid = this.info.uniqueID) && (span = this.nodes.uniqueID))
    ) {
      return
    }

    const rgb = IDColor.ids[uid] || IDColor.compute(uid)

    // Style the damn node.
    const { style } = span
    style.color = rgb[3]
    style.backgroundColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    return $.addClass(span, 'painted')
  },

  compute(uid) {
    // Convert chars to integers, bitshift and math to create a larger integer
    // Create a nice string of binary
    let hash;
    if (typeof g !== 'undefined' && g.SITE && g.SITE.uidColor) {
      hash = g.SITE.uidColor(uid);
    } else {
      hash = parseInt(uid, 16);
    }
  
    // Convert binary string to numerical values with bitshift and '&' truncation.
    const rgb = [(hash >> 16) & 0xff, (hash >> 8) & 0xff, hash & 0xff];
  
    // Weight color luminance values, assign a font color that should be readable.
    const fontColor = $.luma ? ($.luma(rgb) > 125 ? '#000' : '#fff') : '#000';
  
    // Cache color and font color.
    const colorCode = `rgb(${rgb.join(',')})`;
    this.ids[uid] = {
      color: colorCode,
      fontColor: fontColor
    };
  
    // Return only the color.
    return colorCode;
  },
}
export default IDColor
