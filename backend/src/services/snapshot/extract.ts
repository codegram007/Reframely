/**
 * In-page extraction script, executed inside Chromium via
 * `page.evaluate`. Kept as a source string so the backend tsconfig does
 * not need the DOM lib; the return value is validated by shape at the
 * call site (see index.ts).
 *
 * Captures, per element: tag / id / classes / attrs, direct text (plus
 * interleaved text runs when text mixes with element children), computed
 * styles (the caller passes the property list), bounding box, pre-order
 * index (for cross-viewport diffing), and direct-child <script> refs. "Opaque" elements (svg, canvas, iframe, media, custom
 * elements) additionally keep their verbatim outerHTML and are not
 * descended into — the classifier preserves them as custom-html/embed
 * widgets. Also collects page-level script refs (with DOM paths, parent
 * pre-order index, and inline source) and same-origin internal links.
 */

export interface ExtractArgs {
  styleProps: readonly string[];
  maxElements: number;
  maxTextLength: number;
  /** Cap on verbatim outerHTML kept for opaque elements. */
  maxHtmlLength: number;
  /** Cap on inline <script> source captured for behaviors mapping. */
  maxScriptLength: number;
}

const EXTRACT_FN = `
(function extract(args) {
  var styleProps = args.styleProps;
  var maxElements = args.maxElements;
  var maxTextLength = args.maxTextLength;
  var maxHtmlLength = args.maxHtmlLength;
  var maxScriptLength = args.maxScriptLength;
  var count = 0;
  var truncated = false;
  var scripts = [];

  // Elements whose internals are meaningless as individual nodes: keep
  // verbatim markup, skip descent. Custom elements (tag with a dash)
  // are treated the same way.
  var OPAQUE = { svg: 1, canvas: 1, iframe: 1, video: 1, audio: 1, object: 1, embed: 1 };
  function isOpaque(tag) {
    return OPAQUE[tag] === 1 || tag.indexOf('-') !== -1;
  }

  function elementPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 32) {
      var part = node.tagName.toLowerCase();
      if (node.id) part += '#' + node.id;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function directText(el) {
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) text += n.textContent;
    }
    text = text.replace(/\\s+/g, ' ').trim();
    if (text.length > maxTextLength) text = text.slice(0, maxTextLength);
    return text;
  }

  function serialize(el) {
    if (count >= maxElements) {
      truncated = true;
      return null;
    }
    var index = count;
    count++;

    var tag = el.tagName.toLowerCase();
    var computed = getComputedStyle(el);
    var styles = {};
    for (var i = 0; i < styleProps.length; i++) {
      styles[styleProps[i]] = computed.getPropertyValue(styleProps[i]);
    }

    var rect = el.getBoundingClientRect();
    var attrs = {};
    for (var a = 0; a < el.attributes.length; a++) {
      var attr = el.attributes[a];
      if (attr.name !== 'class' && attr.name !== 'id') {
        attrs[attr.name] = attr.value;
      }
    }

    var opaque = isOpaque(tag);
    var scriptRefs = [];
    var children = [];
    // Text runs interleaved with the children we actually keep:
    // runs[i] precedes children[i]; the last run trails all children.
    var runs = [''];
    var sawRunText = false;
    if (!opaque) {
      for (var c = 0; c < el.childNodes.length; c++) {
        var childNode = el.childNodes[c];
        if (childNode.nodeType === 3) {
          var chunk = childNode.textContent.replace(/\\s+/g, ' ');
          if (chunk.trim()) sawRunText = true;
          runs[runs.length - 1] += chunk;
          continue;
        }
        if (childNode.nodeType !== 1) continue;
        var child = childNode;
        var childTag = child.tagName.toLowerCase();
        if (childTag === 'script') {
          var src = child.getAttribute('src');
          scriptRefs.push(src ? child.src : 'inline');
          var ref = {
            src: src ? child.src : undefined,
            inline: !src,
            parentPath: elementPath(el),
            parentIndex: index,
          };
          if (!src && child.textContent) {
            ref.content = child.textContent.slice(0, maxScriptLength);
          }
          scripts.push(ref);
          continue;
        }
        var serialized = serialize(child);
        if (serialized) {
          children.push(serialized);
          runs.push('');
        }
      }
    }

    var node = {
      index: index,
      tag: tag,
      classes: el.className && typeof el.className === 'string'
        ? el.className.split(/\\s+/).filter(Boolean)
        : [],
      attrs: attrs,
      styles: styles,
      bbox: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
      scriptRefs: scriptRefs,
      children: children,
    };
    if (el.id) node.id = el.id;
    if (opaque) node.html = el.outerHTML.slice(0, maxHtmlLength);
    var text = directText(el);
    if (text) node.text = text;
    if (sawRunText && children.length > 0) {
      var capped = [];
      for (var r = 0; r < runs.length; r++) capped.push(runs[r].slice(0, maxTextLength));
      node.textRuns = capped;
    }
    return node;
  }

  var dom = serialize(document.documentElement);

  var links = [];
  var seen = {};
  var anchors = document.querySelectorAll('a[href]');
  for (var i = 0; i < anchors.length; i++) {
    var href = anchors[i].getAttribute('href');
    if (!href) continue;
    var url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      continue;
    }
    if (url.origin !== location.origin) continue;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    var path = url.pathname + url.search;
    if (!seen[path]) {
      seen[path] = true;
      links.push(path);
    }
  }

  return {
    title: document.title,
    renderedHtml: '<!DOCTYPE html>' + document.documentElement.outerHTML,
    dom: dom,
    scripts: scripts,
    internalLinks: links,
    domTruncated: truncated,
  };
})
`;

/** Builds the evaluate expression with args baked in. */
export function buildExtractExpression(args: ExtractArgs): string {
  return `(${EXTRACT_FN})(${JSON.stringify(args)})`;
}
