import Callbacks from '../classes/Callbacks'
import { Conf,g } from '../globals/globals'
import $ from '../platform/$'

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
var Time = {
  init(): VoidFunction {
    if (
      !['index', 'thread', 'archive'].includes(g.VIEW) ||
      !Conf['Time Formatting']
    ) {
      return
    }

    return Callbacks.Post.push({
      name: 'Time Formatting',
      cb: this.node,
    })
  },

  node(): any {
    if (!this.info.date || this.isClone) {
      return
    }
    const { textContent } = this.nodes.date
    return (this.nodes.date.textContent =
      textContent.match(/^\s*/)[0] +
      Time.format(Conf['time'], this.info.date) +
      textContent.match(/\s*$/)[0])
  },

  format(formatString: string, date: Date): string {
    return formatString.replace(/%(.)/g, function (s, c) {
      if ($.hasOwn(Time.formatters, c)) {
        return Time.formatters[c].call(date)
      } else {
        return s
      }
    })
  },

  day: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ],

  month: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],

  localeFormat(date: Date, options: any, defaultValue: string): string {
    if (Conf['timeLocale']) {
      try {
        return Intl.DateTimeFormat(Conf['timeLocale'], options).format(date)
      } catch (error) {}
    }
    return defaultValue
  },

  localeFormatPart(
    date: Date,
    options: any,
    part: string,
    defaultValue: string
  ): string {
    if (Conf['timeLocale']) {
      try {
        const parts = Intl.DateTimeFormat(
          Conf['timeLocale'],
          options
        ).formatToParts(date)
        return parts
          .map(function (x) {
            if (x.type === part) {
              return x.value
            } else {
              return ''
            }
          })
          .join('')
      } catch (error) {}
    }
    return defaultValue
  },

  zeroPad(n: number): number | string {
    if (n < 10) {
      return `0${n}`
    } else {
      return n
    }
  },

  formatters: {
    a(): string {
      return Time.localeFormat(
        this,
        { weekday: 'short' },
        Time.day[this.getDay()].slice(0, 3)
      )
    },
    A(): string {
      return Time.localeFormat(
        this,
        { weekday: 'long' },
        Time.day[this.getDay()]
      )
    },
    b(): string {
      return Time.localeFormat(
        this,
        { month: 'short' },
        Time.month[this.getMonth()].slice(0, 3)
      )
    },
    B(): string {
      return Time.localeFormat(
        this,
        { month: 'long' },
        Time.month[this.getMonth()]
      )
    },
    d(): string | number {
      return Time.zeroPad(this.getDate())
    },
    e(): number {
      return this.getDate()
    },
    H(): string | number {
      return Time.zeroPad(this.getHours())
    },
    I(): string | number {
      return Time.zeroPad(this.getHours() % 12 || 12)
    },
    k(): number {
      return this.getHours()
    },
    l(): number {
      return this.getHours() % 12 || 12
    },
    m(): string | number {
      return Time.zeroPad(this.getMonth() + 1)
    },
    M(): string | number {
      return Time.zeroPad(this.getMinutes())
    },
    p(): string {
      return Time.localeFormatPart(
        this,
        { hour: 'numeric', hour12: true },
        'dayperiod',
        this.getHours() < 12 ? 'AM' : 'PM'
      )
    },
    P(): string {
      return Time.formatters.p.call(this).toLowerCase()
    },
    S(): string | number {
      return Time.zeroPad(this.getSeconds())
    },
    y(): string {
      return this.getFullYear().toString().slice(2)
    },
    Y(): number {
      return this.getFullYear()
    },
    '%'(): string {
      return '%'
    },
  },
}
export default Time
