/**
 * The bridge script injected into the canvas iframe's document. It runs
 * in the sandboxed page (no same-origin access to the parent) and talks
 * to the editor purely via postMessage.
 *
 * Responsibilities:
 *   - Resolve the nearest widget-tree node for any pointer target by
 *     reading the `vs-{id}` class the codegen stamps on every node.
 *   - Report hover and click/select with the target's bounding rect.
 *   - Re-report rects on scroll/resize so overlays stay aligned.
 *   - Neutralize navigation (anchor clicks) so selecting a button/link
 *     doesn't navigate the canvas away.
 *   - Inline text editing: turn a re-clicked/double-clicked editable
 *     node into a contentEditable region, stream debounced plain-text
 *     input to the parent, strip formatting on paste, and commit on
 *     Enter / blur / Escape.
 *
 * Exported as a string and inlined into the generated page's <head>.
 * `window.parent.postMessage(msg, '*')` is safe here: the payloads carry
 * no secrets (just node ids + geometry + text), and the parent validates
 * the `source` field before trusting any message.
 */
export const CANVAS_BRIDGE_SCRIPT = `
(function () {
  var CANVAS_SOURCE = 'vs-canvas';
  var EDITOR_SOURCE = 'vs-editor';
  var INPUT_DEBOUNCE_MS = 180;
  var hoverId = null;
  var selectedId = null;

  // Inline-edit state.
  var editingId = null;
  var editingEl = null;
  var originalText = '';
  var inputTimer = null;

  // Ids the parent wants override-badge rects for; re-reported on
  // scroll/resize so badges track the elements.
  var badgeIds = [];

  function nodeIdOf(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.classList) {
        for (var i = 0; i < node.classList.length; i++) {
          var c = node.classList[i];
          if (c.indexOf('vs-') === 0) return c.slice(3);
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function elementFor(nodeId) {
    var els = document.getElementsByClassName('vs-' + nodeId);
    return els.length > 0 ? els[0] : null;
  }

  function rectOf(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  function send(msg) {
    msg.source = CANVAS_SOURCE;
    window.parent.postMessage(msg, '*');
  }

  function plainText(el) {
    // innerText collapses markup to rendered text; trim trailing newline.
    return (el.innerText || '').replace(/\\n+$/, '');
  }

  // ---- inline editing -----------------------------------------------------

  function startEditing(nodeId) {
    var el = elementFor(nodeId);
    if (!el) return;
    editingId = nodeId;
    editingEl = el;
    originalText = plainText(el);
    el.setAttribute('contenteditable', 'plaintext-only');
    // Some engines don't support plaintext-only; fall back to true.
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.style.cursor = 'text';
    el.focus();
    // Place caret at the end by selecting the contents then collapsing.
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    send({ type: 'edit-begin', nodeId: nodeId });
  }

  function flushInput() {
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }
    if (editingEl) send({ type: 'edit-input', nodeId: editingId, text: plainText(editingEl) });
  }

  function stopEditing(commit) {
    if (!editingEl) return;
    var el = editingEl;
    var id = editingId;
    var text = plainText(el);
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }
    el.removeAttribute('contenteditable');
    el.style.cursor = '';
    if (!commit) el.innerText = originalText; // Escape → revert visible text
    editingId = null;
    editingEl = null;
    send({ type: 'edit-commit', nodeId: id, text: commit ? text : originalText, commit: commit });
  }

  // ---- pointer + selection ------------------------------------------------

  document.addEventListener(
    'mousemove',
    function (e) {
      if (editingId) return; // no hover flicker while editing
      var id = nodeIdOf(e.target);
      if (id === hoverId) return;
      hoverId = id;
      var el = id ? elementFor(id) : null;
      send({ type: 'hover', nodeId: id, rect: rectOf(el) });
    },
    true,
  );

  document.addEventListener(
    'mouseleave',
    function () {
      if (editingId) return;
      hoverId = null;
      send({ type: 'hover', nodeId: null, rect: null });
    },
    true,
  );

  document.addEventListener(
    'click',
    function (e) {
      // While editing, let clicks place the caret normally.
      if (editingId) {
        if (nodeIdOf(e.target) === editingId) return;
        // Click outside the editing node commits, then falls through to
        // reselect the clicked target.
        stopEditing(true);
      }
      e.preventDefault();
      e.stopPropagation();
      var id = (e.target === document.body || e.target === document.documentElement)
        ? null
        : nodeIdOf(e.target);
      // Re-click on the already-selected node → ask the parent whether it
      // is editable (the parent owns widget-type knowledge).
      if (id && id === selectedId) {
        send({ type: 'request-edit', nodeId: id });
        return;
      }
      selectedId = id;
      var el = id ? elementFor(id) : null;
      send({ type: 'select', nodeId: id, rect: rectOf(el) });
    },
    true,
  );

  // Double-click is a direct edit trigger (also selects first if needed).
  document.addEventListener(
    'dblclick',
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = nodeIdOf(e.target);
      if (id) {
        selectedId = id;
        send({ type: 'request-edit', nodeId: id });
      }
    },
    true,
  );

  // ---- editing input handling ---------------------------------------------

  document.addEventListener('input', function () {
    if (!editingEl) return;
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(flushInput, INPUT_DEBOUNCE_MS);
  });

  // Paste as plain text: strip all formatting.
  document.addEventListener('paste', function (e) {
    if (!editingEl) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    // Insert at caret without introducing markup.
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(flushInput, INPUT_DEBOUNCE_MS);
  });

  document.addEventListener('keydown', function (e) {
    if (editingId) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        stopEditing(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing(false);
      }
      return;
    }
    if (e.key === 'Escape') {
      selectedId = null;
      send({ type: 'select', nodeId: null, rect: null });
    }
  });

  document.addEventListener(
    'blur',
    function () {
      if (editingId) stopEditing(true);
    },
    true,
  );

  // ---- live geometry ------------------------------------------------------

  function reportBadges() {
    if (!badgeIds.length) return;
    var map = {};
    for (var i = 0; i < badgeIds.length; i++) {
      var r = rectOf(elementFor(badgeIds[i]));
      if (r) map[badgeIds[i]] = r;
    }
    send({ type: 'rects', rects: map });
  }

  function reportLive() {
    send({
      type: 'scroll-or-resize',
      hoverRect: hoverId ? rectOf(elementFor(hoverId)) : null,
      selectedRect: selectedId ? rectOf(elementFor(selectedId)) : null,
    });
    reportBadges();
  }
  window.addEventListener('scroll', reportLive, true);
  window.addEventListener('resize', reportLive);

  // ---- parent → canvas ----------------------------------------------------

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data.source !== EDITOR_SOURCE) return;
    if (data.type === 'select') {
      selectedId = data.nodeId;
      var el = data.nodeId ? elementFor(data.nodeId) : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      send({ type: 'select', nodeId: data.nodeId, rect: rectOf(el) });
    } else if (data.type === 'request-rect') {
      send({ type: 'rect', nodeId: data.nodeId, rect: rectOf(elementFor(data.nodeId)) });
    } else if (data.type === 'request-rects') {
      badgeIds = data.nodeIds || [];
      reportBadges();
    } else if (data.type === 'drop-probe') {
      var hit = document.elementFromPoint(data.x, data.y);
      var dropId = hit ? nodeIdOf(hit) : null;
      var dropEl = dropId ? elementFor(dropId) : null;
      var dropRect = rectOf(dropEl);
      var edge = 'inside';
      if (dropRect) {
        // Top/bottom thirds → before/after; middle → inside (containers).
        var rel = (data.y - dropRect.y) / (dropRect.height || 1);
        if (rel < 0.33) edge = 'before';
        else if (rel > 0.67) edge = 'after';
        else edge = 'inside';
      }
      send({ type: 'drop-target', nodeId: dropId, rect: dropRect, edge: edge });
    } else if (data.type === 'enter-edit') {
      startEditing(data.nodeId);
    } else if (data.type === 'exit-edit') {
      if (editingId === data.nodeId) stopEditing(data.commit);
    }
  });

  send({ type: 'ready' });
})();
`;
