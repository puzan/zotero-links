"use strict";

// Zotero, Services, Components are globals in bootstrap.js (Zotero 7/8)

var ZoteroLinks;

// ── Lifecycle ────────────────────────────────────────────────────────────────

function install() {}
function uninstall() {}

function startup({ id, version, rootURI }) {
  ZoteroLinks = {
    addedElementIDs: [],

    addToAllWindows() {
      for (let win of Zotero.getMainWindows()) {
        if (win.ZoteroPane) this.addToWindow(win);
      }
    },

    addToWindow(win) {
      this._addCollectionMenuItem(win);
      this._addItemMenuItem(win);
    },

    _addCollectionMenuItem(win) {
      const doc = win.document;
      const menu = doc.getElementById("zotero-collectionmenu");
      if (!menu) return;

      const sep = doc.createXULElement("menuseparator");
      sep.id = "copy-collection-link-sep";

      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = "copy-collection-link-menuitem";
      menuitem.setAttribute("label", "Copy Collection Link");

      menu.addEventListener("popupshowing", () => {
        menuitem.disabled = !win.ZoteroPane.getSelectedCollection();
      });

      menuitem.addEventListener("command", () => {
        const collection = win.ZoteroPane.getSelectedCollection();
        if (!collection) return;
        _copyToClipboard(_buildCollectionLink(collection));
      });

      menu.appendChild(sep);
      menu.appendChild(menuitem);
      this.addedElementIDs.push(sep.id, menuitem.id);
    },

    _addItemMenuItem(win) {
      const doc = win.document;
      const menu = doc.getElementById("zotero-itemmenu");
      if (!menu) return;

      const sep = doc.createXULElement("menuseparator");
      sep.id = "copy-item-link-sep";

      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = "copy-item-link-menuitem";
      menuitem.setAttribute("label", "Copy Item Link");

      menu.addEventListener("popupshowing", () => {
        const items = win.ZoteroPane.getSelectedItems();
        menuitem.disabled = items.length !== 1;
      });

      menuitem.addEventListener("command", () => {
        const items = win.ZoteroPane.getSelectedItems();
        if (items.length !== 1) return;
        _copyToClipboard(_buildItemLink(items[0]));
      });

      menu.appendChild(sep);
      menu.appendChild(menuitem);
      this.addedElementIDs.push(sep.id, menuitem.id);
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

  ZoteroLinks.addToAllWindows();
}

function onMainWindowLoad({ window }) {
  ZoteroLinks?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
  ZoteroLinks?.removeFromWindow(window);
}

function shutdown() {
  ZoteroLinks?.removeFromAllWindows();
  ZoteroLinks = undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _buildCollectionLink(collection) {
  const library = Zotero.Libraries.get(collection.libraryID);
  if (library.libraryType === "user") {
    return `zotero://select/library/collections/${collection.key}`;
  }
  if (library.libraryType === "group") {
    return `zotero://select/groups/${library.groupID}/collections/${collection.key}`;
  }
  return null;
}

function _buildItemLink(item) {
  return `zotero://select/items/${item.libraryID}_${item.key}`;
}

function _copyToClipboard(text) {
  if (!text) return;
  const helper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Components.interfaces.nsIClipboardHelper);
  helper.copyString(text);
}
