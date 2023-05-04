import Callbacks from "../classes/Callbacks"
import { Conf, g } from "../globals/globals"
import $ from "../platform/$"

interface TimeFormatters {
  a(): string;
  A(): string;
  b(): string;
  B(): string;
  d(): string;
  e(): number;
  H(): string;
  I(): string;
  k(): number;
  l(): number;
  m(): string;
  M(): string;
  p(): string;
  P(): string;
  S(): string;
  y(): string;
  Y(): number;
  '%'(): string;
}

const Time = {
  init(): void {
    if (!['index', 'thread', 'archive'].includes(g.VIEW) || !Conf['Time Formatting']) {
      return
    }

    Callbacks.Post.push({
      name: 'Time Formatting',
      cb: this.node,
    })
  },

  node(): void {
    if (!this.info.date || this.isClone) {
      return
    }
    const { textContent } = this.nodes.date
    this.nodes.date.textContent =
      textContent.match(/^\s*/)[0] +
      Time.format(Conf['time'], this.info.date) +
      textContent.match(/\s*$/)[0]
  },

  format(formatString: string, date: Date): string {
    return formatString.replace(/%(.)/g, (s: string, c: string): string => {
      if ($.hasOwn(Time.formatters, c)) {
        return (Time.formatters as TimeFormatters)[c].call(date)
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

  localeFormat(date: Date, options: Intl.DateTimeFormatOptions, defaultValue: string): string {
    if (Conf['timeLocale']) {
      try {
        return Intl.DateTimeFormat(Conf['timeLocale'], options).format(date)
      } catch (error) {/* empty */ }
    }
    return defaultValue
  },

  localeFormatPart(
    date: Date,
    options: Intl.DateTimeFormatOptions,
    part: string,
    defaultValue: string,
  ): string {
    if (Conf['timeLocale']) {
      try {
        const parts = Intl.DateTimeFormat(Conf['timeLocale'], options).formatToParts(date)
        return parts
          .map((x) => (x.type === part ? x.value : ''))
          .join('')
      } catch (error) { /* empty */ }
    }
    return defaultValue
  },

  zeroPad(n: number): string | number {
    return n < 10 ? `0${n}` : n
  },

  formatters: {
    a(): string {
      return Time.localeFormat(this, { weekday: 'short' }, Time.day[this.getDay()].slice(0, 3))
    },
    A(): string {
      return Time.localeFormat(this, { weekday: 'long' }, Time.day[this.getDay()])
    },
    b(): string {
      return Time.localeFormat(this, { month: 'short' }, Time.month[this.getMonth()].slice(0, 3))
    },
    B(): string {
      return Time.localeFormat(this, { month: 'long' }, Time.month[this.getMonth()])
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
      return Time.zeroPad((this.getHours() % 12) || 12)
    },
    k(): number {
      return this.getHours()
    },
    l(): number {
      return (this.getHours() % 12) || 12
    },
    m(): string | number {
      return Time.zeroPad(this.getMonth() + 1)
    },
    M(): string | number {
      return Time.zeroPad(this.getMinutes())
    },
    p(): string {
      return Time.localeFormatPart(this, { hour: 'numeric', hour12: true }, 'dayperiod', this.getHours() < 12 ? 'AM' : 'PM')
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