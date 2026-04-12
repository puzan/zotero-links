"use strict";

// Zotero, Services, Components are globals in bootstrap.js (Zotero 7/8)

var ZoteroLinks;
var _prefPaneID;

// ── Lifecycle ────────────────────────────────────────────────────────────────

function install() {}
function uninstall() {}

function startup({ id, version, rootURI }) {
  // Initialize preference defaults
  if (!Services.prefs.prefHasUserValue("extensions.zotero-links.excludedCollections")) {
    Services.prefs.setCharPref("extensions.zotero-links.excludedCollections", "00-inbox");
  }
  if (!Services.prefs.prefHasUserValue("extensions.zotero-links.claudeApiKey")) {
    Services.prefs.setCharPref("extensions.zotero-links.claudeApiKey", "");
  }
  if (!Services.prefs.prefHasUserValue("extensions.zotero-links.debugLogging")) {
    Services.prefs.setBoolPref("extensions.zotero-links.debugLogging", false);
  }

  // Register preferences pane in Zotero Settings window
  (async () => {
    await Zotero.initializationPromise;
    _prefPaneID = await Zotero.PreferencePanes.register({
      pluginID: "zotero-links@puzan.dev",
      src: rootURI + "preferences.xhtml",
      label: "Zotero Links",
    });
  })();

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
      this._addAutoAssignMenuItem(win);
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

    _addAutoAssignMenuItem(win) {
      const doc = win.document;
      const menu = doc.getElementById("zotero-itemmenu");
      if (!menu) return;

      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = "zotero-links-autoassign-menuitem";
      menuitem.setAttribute("label", "Auto-assign to collections");

      menu.addEventListener("popupshowing", () => {
        const items = win.ZoteroPane.getSelectedItems();
        menuitem.disabled = items.length !== 1;
      });

      menuitem.addEventListener("command", () => {
        const items = win.ZoteroPane.getSelectedItems();
        if (items.length !== 1) return;
        const item = items[0];
        const apiKey = Services.prefs.getCharPref("extensions.zotero-links.claudeApiKey", "");
        if (!apiKey) {
          Zotero.Utilities.Internal.openPreferences(_prefPaneID);
          return;
        }
        _autoAssignItem(item).catch(err => _notify("Unexpected error: " + err.message));
      });

      menu.appendChild(menuitem);
      this.addedElementIDs.push(menuitem.id);
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

function _log(msg) {
  if (Services.prefs.getBoolPref("extensions.zotero-links.debugLogging", false)) {
    Services.console.logStringMessage(`[zotero-links] ${msg}`);
  }
}

function _notify(msg) {
  const pw = new Zotero.ProgressWindow({ closeOnClick: true });
  pw.changeHeadline("Zotero Links");
  pw.addLines([msg]);
  pw.startCloseTimer(4000);
  pw.show();
}

function _buildMetadataBlock(item) {
  const lines = [];

  const title = item.getField("title");
  if (title) lines.push(`Title: ${title}`);

  const creators = item.getCreators()
    .filter(c => c.creatorType === "author")
    .map(c => c.fieldMode === 1 ? c.lastName : `${c.firstName} ${c.lastName}`.trim())
    .filter(Boolean);
  if (creators.length) lines.push(`Authors: ${creators.join(", ")}`);

  const abstract = item.getField("abstractNote");
  if (abstract) lines.push(`Abstract: ${abstract}`);

  const dateStr = item.getField("date");
  const yearMatch = dateStr && dateStr.match(/\d{4}/);
  if (yearMatch) lines.push(`Year: ${yearMatch[0]}`);

  const itemType = Zotero.ItemTypes.getName(item.itemTypeID);
  if (itemType) lines.push(`Item type: ${itemType}`);

  const journalPublisher = item.getField("publicationTitle") || item.getField("publisher");
  if (journalPublisher) lines.push(`Journal/Publisher: ${journalPublisher}`);

  const tags = item.getTags().map(t => t.tag).filter(Boolean);
  if (tags.length) lines.push(`Tags: ${tags.join(", ")}`);

  return lines.join("\n");
}

async function _autoAssignItem(item) {
  const apiKey = Services.prefs.getCharPref("extensions.zotero-links.claudeApiKey", "");
  if (!apiKey.trim()) {
    Zotero.Utilities.Internal.openPreferences(_prefPaneID);
    return;
  }

  const excludedRaw = Services.prefs.getCharPref("extensions.zotero-links.excludedCollections", "00-inbox");
  const excluded = excludedRaw.split(",").map(s => s.trim()).filter(Boolean);

  const collectionMap = new Map(); // full path -> collection id
  function _collectRecursive(cols, parentPath) {
    for (const col of cols) {
      const path = parentPath ? `${parentPath} / ${col.name}` : col.name;
      const pathParts = path.split(" / ");
      if (!pathParts.some(p => excluded.includes(p))) {
        collectionMap.set(path, col.id);
      }
      _collectRecursive(col.getChildCollections(), path);
    }
  }
  _collectRecursive(Zotero.Collections.getByLibrary(item.libraryID), "");

  const metadataBlock = _buildMetadataBlock(item);

  if (collectionMap.size === 0) {
    _notify("No matching collection found");
    return;
  }

  const collectionNames = [...collectionMap.keys()];
  const userMessage = `Collections:\n${collectionNames.join("\n")}\n\nItem metadata:\n${metadataBlock}`;
  _log(`Item context:\n${userMessage}`);
  const systemPrompt =
    "You are a library classification assistant. Given item metadata and a list of collection names, " +
    "pick up to 3 collection names from the list that best fit the item. " +
    "If no collection fits, return an empty array.";

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "structured-outputs-2025-11-13",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        tools: [{
          name: "assign_collections",
          description: "Return the collection names that best fit the item",
          input_schema: {
            type: "object",
            properties: {
              collections: {
                type: "array",
                items: { type: "string" },
                maxItems: 3,
                description: "Collection names from the provided list",
              },
            },
            required: ["collections"],
            additionalProperties: false,
          },
        }],
        tool_choice: { type: "tool", name: "assign_collections" },
      }),
    });
  } catch (e) {
    _notify("Could not reach Claude API — check your connection");
    return;
  }

  const responseText = await response.text();
  _log(`Claude raw response:\n${responseText}`);

  if (!response.ok) {
    _notify("Claude API returned an error — check your API key");
    return;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Claude API returned non-JSON response: ${responseText.slice(0, 200)}`);
  }

  const toolUse = data.content?.find(b => b.type === "tool_use");
  const names = toolUse?.input?.collections;
  if (!Array.isArray(names) || names.length === 0) {
    _notify("No matching collection found");
    return;
  }

  const validatedIDs = names
    .filter(n => collectionMap.has(n))
    .slice(0, 3)
    .map(n => collectionMap.get(n));

  if (validatedIDs.length === 0) {
    _notify("No matching collection found");
    return;
  }

  for (const id of validatedIDs) {
    item.addToCollection(id);
    await item.saveTx();
  }

  _notify(`Auto-assigned to ${validatedIDs.length} collection${validatedIDs.length > 1 ? "s" : ""}`);
}
