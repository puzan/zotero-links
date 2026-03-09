"use strict";

// Zotero, Services, Components are globals in bootstrap.js (Zotero 7/8)

var CollectionLinks;

// ── Lifecycle ────────────────────────────────────────────────────────────────

function install() {}
function uninstall() {}

function startup({ id, version, rootURI }) {
  CollectionLinks = {
    addedElementIDs: [],

    addToAllWindows() {
      for (let win of Zotero.getMainWindows()) {
        if (win.ZoteroPane) this.addToWindow(win);
      }
    },

    addToWindow(win) {
      const doc = win.document;
      const menu = doc.getElementById("zotero-collectionmenu");
      if (!menu) return;

      const sep = doc.createXULElement("menuseparator");
      sep.id = "copy-collection-link-sep";

      const item = doc.createXULElement("menuitem");
      item.id = "copy-collection-link-menuitem";
      item.setAttribute("label", "Copy Collection Link");

      menu.addEventListener("popupshowing", () => {
        item.disabled = !win.ZoteroPane.getSelectedCollection();
      });

      item.addEventListener("command", () => {
        const collection = win.ZoteroPane.getSelectedCollection();
        if (!collection) return;
        const link = _buildLink(collection);
        if (link) _copyToClipboard(link);
      });

      menu.appendChild(sep);
      menu.appendChild(item);
      this.addedElementIDs.push(sep.id, item.id);
    },

    removeFromWindow(win) {
      const doc = win.document;
      for (const id of this.addedElementIDs) {
        doc.getElementById(id)?.remove();
      }
    },

    removeFromAllWindows() {
      for (let win of Zotero.getMainWindows()) {
        if (win.ZoteroPane) this.removeFromWindow(win);
      }
    },
  };

  CollectionLinks.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  CollectionLinks?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  CollectionLinks?.removeFromWindow(window);
}

function shutdown() {
  CollectionLinks?.removeFromAllWindows();
  CollectionLinks = undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _buildLink(collection) {
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
  const helper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Components.interfaces.nsIClipboardHelper);
  helper.copyString(text);
}
