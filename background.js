// DLsite RJ Link Converter - Background Service Worker
// クリック履歴の保存と、DLsite からの作品タイトル取得を担当する。

const STORAGE_KEY = "clickHistory";
const MAX_ENTRIES = 300;

/**
 * DLsite の商品情報 API から作品タイトルを取得する。
 * 取得に失敗した場合は null を返す（履歴自体はタイトルなしで保存する）。
 */
async function fetchWorkTitle(rjNumber) {
  try {
    const endpoint =
      "https://www.dlsite.com/maniax/api/=/product.json?locale=ja_JP&workno=" +
      encodeURIComponent(rjNumber);
    const response = await fetch(endpoint, { credentials: "omit" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    // API はマッチした作品オブジェクトの配列を返す
    const work = Array.isArray(data) ? data[0] : null;
    return work?.work_name ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * クリック履歴を chrome.storage.local に保存する。
 * 同じ RJ 番号が既にある場合は先頭へ移動し、クリック回数を加算する。
 */
async function saveHistory(entry) {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const history = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];

  const existingIndex = history.findIndex(
    (item) => item.rjNumber === entry.rjNumber
  );
  const prevCount =
    existingIndex >= 0 ? history[existingIndex].count || 1 : 0;
  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }

  history.unshift({ ...entry, count: prevCount + 1 });

  // 上限を超えた分は古いものから削除
  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "recordClick") {
    return;
  }

  // タイトル取得は非同期。取得を待ってから保存する。
  (async () => {
    const title = await fetchWorkTitle(message.rjNumber);
    await saveHistory({
      rjNumber: message.rjNumber,
      url: message.url,
      title,
      pageUrl: message.pageUrl,
      pageTitle: message.pageTitle,
      timestamp: message.timestamp || Date.now(),
    });
  })();

  // 応答は返さないので false（同期的にリスナー終了）
  return false;
});
