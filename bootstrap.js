"use strict";

const { Cc, Ci, Services } = globalThis;

var windowListener;
var zoteroObserver;

// ── Entry points ────────────────────────────────────────────────────────────

function install() {}
function uninstall() {}

function startup({ rootURI }, reason) {
  // Zotero may not be ready yet — wait for it
  zoteroObserver = {
    observe(subject, topic) {
      Services.obs.removeObserver(zoteroObserver, "zotero-loaded");
      const Zotero = subject.wrappedJSObject || subject;
      _init(Zotero);
    },
  };
  Services.obs.addObserver(zoteroObserver, "zotero-loaded", false);
}

function shutdown(data, reason) {
  if (zoteroObserver) {
    try { Services.obs.removeObserver(zoteroObserver, "zotero-loaded"); } catch (_) {}
  }
  if (windowListener) {
    Services.wm.removeListener(windowListener);
  }
  // Remove menu items from all open windows
  const enumerator = Services.wm.getEnumerator("zotero:main");
  while (enumerator.hasMoreElements()) {
    _removeFromWindow(enumerator.getNext());
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

function _init(Zotero) {
  // Add to already-open windows
  const enumerator = Services.wm.getEnumerator("zotero:main");
  while (enumerator.hasMoreElements()) {
    _addToWindow(enumerator.getNext(), Zotero);
  }

  // Add to windows opened in the future
  windowListener = {
    onOpenWindow(xulWindow) {
      const win = xulWindow
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindow);
      win.addEventListener("load", () => {
        if (
          win.document.documentElement.getAttribute("windowtype") === "zotero:main"
        ) {
          _addToWindow(win, Zotero);
        }
      });
    },
    onCloseWindow() {},
    onStatusChange() {},
  };
  Services.wm.addListener(windowListener);
}

// ── Per-window logic ────────────────────────────────────────────────────────

function _addToWindow(win, Zotero) {
  const doc = win.document;
  const menu = doc.getElementById("zotero-collectionmenu");
  if (!menu) return;

  const sep = doc.createXULElement("menuseparator");
  sep.id = "copy-collection-link-sep";

  const item = doc.createXULElement("menuitem");
  item.id = "copy-collection-link-menuitem";
  item.setAttribute("label", "Copy Collection Link");

  // Disable the item if no collection is selected (e.g. right-click on root)
  menu.addEventListener("popupshowing", function onPopup() {
    const collection = win.ZoteroPane.getSelectedCollection();
    item.disabled = !collection;
  });

  item.addEventListener("command", function () {
    const collection = win.ZoteroPane.getSelectedCollection();
    if (!collection) return;

    const link = _buildLink(collection, Zotero);
    if (link) {
      _copyToClipboard(link);
    }
  });

  menu.appendChild(sep);
  menu.appendChild(item);
}

function _removeFromWindow(win) {
  const doc = win.document;
  doc.getElementById("copy-collection-link-sep")?.remove();
  doc.getElementById("copy-collection-link-menuitem")?.remove();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _buildLink(collection, Zotero) {
  const key = collection.key;
  const library = Zotero.Libraries.get(collection.libraryID);

  if (library.libraryType === "user") {
    return `zotero://select/library/collections/${key}`;
  }
  if (library.libraryType === "group") {
    return `zotero://select/groups/${library.groupID}/collections/${key}`;
  }
  return null;
}

function _copyToClipboard(text) {
  const helper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
    Ci.nsIClipboardHelper
  );
  helper.copyString(text);
}
