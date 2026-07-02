// DLsite RJ Link Converter - Popup
// chrome.storage.local に保存されたクリック履歴を一覧表示する。

const STORAGE_KEY = "clickHistory";

/**
 * タイムスタンプを「YYYY/MM/DD HH:mm」形式にする。
 */
function formatDate(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * 履歴1件分の <li> を生成する。
 * textContent / DOM API で組み立て、HTML インジェクションを避ける。
 */
function createItem(entry) {
  const li = document.createElement("li");

  const titleLink = document.createElement("a");
  titleLink.className = "title";
  titleLink.href = entry.url;
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = entry.title || entry.rjNumber;
  li.appendChild(titleLink);

  const meta = document.createElement("div");
  meta.className = "meta";
  const rj = document.createElement("span");
  rj.className = "rj";
  rj.textContent = entry.rjNumber;
  meta.appendChild(rj);
  const when = document.createTextNode(
    `　${formatDate(entry.timestamp)}` +
      (entry.count > 1 ? `（${entry.count}回）` : "")
  );
  meta.appendChild(when);
  li.appendChild(meta);

  if (entry.pageTitle || entry.pageUrl) {
    const source = document.createElement("span");
    source.className = "source";
    source.textContent = `↪ ${entry.pageTitle || entry.pageUrl}`;
    source.title = entry.pageUrl || "";
    li.appendChild(source);
  }

  return li;
}

async function render() {
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const history = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];

  list.textContent = "";
  if (history.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const fragment = document.createDocumentFragment();
  for (const entry of history) {
    fragment.appendChild(createItem(entry));
  }
  list.appendChild(fragment);
}

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("クリック履歴をすべて削除しますか？")) {
    return;
  }
  await chrome.storage.local.remove(STORAGE_KEY);
  render();
});

render();
