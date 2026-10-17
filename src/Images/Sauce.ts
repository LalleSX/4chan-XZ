
import Callbacks from "../classes/Callbacks";
import Notice from "../classes/Notice";
import Filter from "../Filtering/Filter";
import { g, Conf, doc } from "../globals/globals";
import $ from "../platform/$";

type SauceFormatter =
  | "TURL"
  | "URL"
  | "IMG"
  | "MD5"
  | "sMD5"
  | "hMD5"
  | "board"
  | "name"
  | "%"
  | "semi";

interface SauceFile {
  url: string;
  thumbURL?: string;
  name: string;
  MD5?: string;
  text: HTMLElement;
}

interface SaucePost {
  siteID: string;
  boardID: string;
  board: { ID: string };
  files: SauceFile[];
  isClone?: boolean;
}

interface SauceLink {
  url: string;
  text: string;
  boards?: Record<string, boolean>;
  types?: ReadonlySet<string>;
  regexp?: RegExp;
}

type Formatter = (
  post: SaucePost,
  file: SauceFile,
  ext: string
) => string | undefined;

const IMAGE_EXTENSIONS = new Set([
  "gif",
  "jpg",
  "jpeg",
  "png"
]);

const PLACEHOLDER_RE =
  /%(T?URL|IMG|[sh]?MD5|board|name|%|semi|\$\d+)/g;

const OPTION_SPLIT_RE =
  /;(?=(?:text|boards|types|regexp|sandbox):?)/;

const JAVASCRIPT_RE = /^javascript:/i;

const MD5_ONLY_RE = /^[sh]?MD5$/;

const HEX_TABLE = Array.from(
  { length: 256 },
  (_, i) => i.toString(16).padStart(2, "0")
);

const FORMATTERS: Record<SauceFormatter, Formatter> = {
  TURL: (_, file) => file.thumbURL,
  URL: (_, file) => file.url,

  IMG: (_, file, ext) =>
    IMAGE_EXTENSIONS.has(ext) ? file.url : file.thumbURL,

  MD5: (_, file) => file.MD5,

  sMD5: (_, file) =>
    file.MD5?.replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, ""),

  hMD5: (_, file) => {
    if (!file.MD5) return undefined;

    return Array.from(
      atob(file.MD5),
      char => HEX_TABLE[char.charCodeAt(0)]
    ).join("");
  },

  board: post => post.board.ID,
  name: (_, file) => file.name,
  "%": () => "%",
  semi: () => ";"
};

const getExtension = (url: string): string => {
  const pathname = url.split(/[?#]/, 1)[0];
  const dot = pathname.lastIndexOf(".");

  return dot === -1
    ? ""
    : pathname.slice(dot + 1).toLowerCase();
};

const isFormatter = (value: string): value is SauceFormatter =>
  Object.prototype.hasOwnProperty.call(FORMATTERS, value);

const reportInvalidRegexp = (
  link: string,
  error: unknown
): void => {
  const message =
    error instanceof Error ? error.message : String(error);

  new Notice("warning", [
    $.tn("Invalid regexp for Sauce link:"),
    $.el("br"),
    $.tn(link),
    $.el("br"),
    $.tn(message)
  ], 60);
};

const Sauce = {
  links: [] as SauceLink[],
  link: null as HTMLAnchorElement | null,

  init(): void {
    if (
      !["index", "thread"].includes(g.VIEW) ||
      !Conf["Sauce"]
    ) {
      return;
    }

    $.addClass(doc, "show-sauce");

    this.links = Conf["sauces"]
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"))
      .map(line => this.parseLink(line))
      .filter((link): link is SauceLink => link !== null);

    if (this.links.length === 0) return;

    this.link = $.el("a", {
      target: "_blank",
      className: "sauce"
    }) as HTMLAnchorElement;

    Callbacks.Post.push({
      name: "Sauce",
      cb: this.node
    });
  },

  parseLink(input: string): SauceLink | null {
    const line = input.trim();
    if (!line) return null;

    const [url, ...options] = line.split(OPTION_SPLIT_RE);
    if (!url) return null;

    const parts: Record<string, string> =
      Object.create(null);

    parts.url = url;

    for (const option of options) {
      const match = /^(\w*):?(.*)$/.exec(option);
      if (!match) continue;

      parts[match[1]] = match[2];
    }

    const text =
      parts.text ||
      url.match(/(\w+)\.\w+\//)?.[1] ||
      "?";

    const result: SauceLink = {
      url,
      text
    };

    if ("boards" in parts) {
      result.boards = Filter.parseBoards(
        parts.boards
      ) as Record<string, boolean>;
    }

    if (parts.types) {
      result.types = new Set(
        parts.types
          .split(",")
          .map(type => type.trim().toLowerCase())
      );
    }

    if ("regexp" in parts) {
      try {
        const source = parts.regexp;
        const match = /^\/(.*)\/(\w*)$/.exec(source);

        result.regexp = match
          ? new RegExp(match[1], match[2])
          : new RegExp(source);
      } catch (error) {
        reportInvalidRegexp(line, error);
        return null;
      }
    }

    return result;
  },

  createSauceLink(
    link: SauceLink,
    post: SaucePost,
    file: SauceFile
  ): HTMLAnchorElement | null {
    if (!this.link) return null;

    const ext = getExtension(file.url);

    if (link.boards) {
      const board = `${post.siteID}/${post.boardID}`;
      const wildcard = `${post.siteID}/*`;

      if (!link.boards[board] && !link.boards[wildcard]) {
        return null;
      }
    }

    if (link.types && !link.types.has(ext)) {
      return null;
    }

    // Reset lastIndex for global or sticky expressions.
    if (link.regexp) {
      link.regexp.lastIndex = 0;
    }

    const matches = link.regexp
      ? link.regexp.exec(file.name)
      : null;

    if (link.regexp && !matches) {
      return null;
    }

    const missing = new Set<string>();
    const isJavaScript = JAVASCRIPT_RE.test(link.url);

    const format = (
      template: string,
      isURL: boolean
    ): string =>
      template.replace(
        PLACEHOLDER_RE,
        (original, parameter: string) => {
          let value: string | undefined;

          if (parameter.startsWith("$")) {
            if (!matches) return original;

            value =
              matches[Number(parameter.slice(1))] ?? "";
          } else if (isFormatter(parameter)) {
            value = FORMATTERS[parameter](
              post,
              file,
              ext
            );

            if (value == null) {
              missing.add(parameter);
              return "";
            }
          } else {
            return original;
          }

          if (
            isURL &&
            parameter !== "%" &&
            parameter !== "semi"
          ) {
            if (isJavaScript) {
              value = JSON.stringify(value);
            }

            return encodeURIComponent(value);
          }

          return value;
        }
      );

    const href = format(link.url, true);
    const text = format(link.text, false);

    const anchor = this.link.cloneNode(
      false
    ) as HTMLAnchorElement;

    if (missing.size > 0) {
      const deferred =
        g.SITE.areMD5sDeferred?.(post.board) &&
        [...missing].every(key => MD5_ONLY_RE.test(key));

      if (!deferred) return null;

      anchor.dataset.skip = "1";
      return anchor;
    }

    anchor.href = href;
    anchor.textContent = text;

    if (isJavaScript) {
      anchor.removeAttribute("target");
    }

    return anchor;
  },

  node(this: SaucePost): void {
    if (this.isClone) return;

    for (const file of this.files) {
      Sauce.file(this, file);
    }
  },

  file(post: SaucePost, file: SauceFile): void {
    const nodes: Node[] = [];
    const skipped: Array<{
      link: SauceLink;
      node: HTMLAnchorElement;
    }> = [];

    for (const link of this.links) {
      const anchor = this.createSauceLink(
        link,
        post,
        file
      );

      if (!anchor) continue;

      nodes.push(
        $.tn(" "),
        anchor
      );

      if (anchor.dataset.skip) {
        skipped.push({
          link,
          node: anchor
        });
      }
    }

    if (nodes.length === 0) return;

    $.add(file.text, nodes);

    if (skipped.length === 0) return;

    const observer = new MutationObserver(() => {
      if (!file.text.dataset.md5) return;

      observer.disconnect();

      for (const { link, node } of skipped) {
        const replacement = this.createSauceLink(
          link,
          post,
          file
        );

        if (replacement && !replacement.dataset.skip) {
          $.replace(node, replacement);
        }
      }
    });

    observer.observe(file.text, {
      attributes: true,
      attributeFilter: ["data-md5"]
    });
  }
};

export default Sauce;
