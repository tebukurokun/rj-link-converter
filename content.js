// DLsite RJ Link Converter Content Script

(function () {
  "use strict";

  // 設定オブジェクト
  const CONFIG = {
    RJ_PATTERN: /\bRJ\d{6,}\b/g,
    DLSITE_BASE_URL: "https://www.dlsite.com/maniax/work/=/product_id/",
    PROCESSED_CLASS: "dlsite-rj-converted",
    EXCLUDED_TAGS: ["A", "SCRIPT", "STYLE", "NOSCRIPT"],
    LINK_STYLES: {
      color: "#0066cc",
      textDecoration: "underline",
    },
    DELAYS: {
      // 動的に追加されたノードをまとめて処理するためのデバウンス時間
      MUTATION_DEBOUNCE: 200,
    },
  };

  /**
   * RJ番号用のリンク要素を作成
   */
  function createRJLink(rjNumber) {
    const link = document.createElement("a");
    link.href = `${CONFIG.DLSITE_BASE_URL}${rjNumber}.html`;
    link.textContent = rjNumber;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `DLsiteで${rjNumber}を開く`;

    // スタイルを適用
    Object.assign(link.style, CONFIG.LINK_STYLES);

    return link;
  }

  /**
   * テキストノードが処理対象かどうかを判定
   */
  function shouldProcessTextNode(textNode) {
    const text = textNode.textContent;

    // RJ番号が含まれているかチェック
    // （グローバル正規表現の lastIndex を汚さない search を使用）
    if (text.search(CONFIG.RJ_PATTERN) === -1) {
      return false;
    }

    const parentNode = textNode.parentNode;
    if (!parentNode) {
      return false;
    }

    // 親要素がすでに処理済みの場合はスキップ
    if (parentNode.classList?.contains(CONFIG.PROCESSED_CLASS)) {
      return false;
    }

    // 除外タグ内のテキストは処理しない
    const parentTag = parentNode.tagName;
    if (parentTag && CONFIG.EXCLUDED_TAGS.includes(parentTag)) {
      return false;
    }

    return true;
  }

  /**
   * テキストノードを処理してRJ番号をリンクに変換
   */
  function convertRJNumbers(textNode) {
    try {
      if (!shouldProcessTextNode(textNode)) {
        return;
      }

      const text = textNode.textContent;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      for (const match of text.matchAll(CONFIG.RJ_PATTERN)) {
        // マッチ前のテキストを追加
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, match.index))
          );
        }

        // リンク要素を作成して追加
        const rjNumber = match[0];
        fragment.appendChild(createRJLink(rjNumber));
        lastIndex = match.index + rjNumber.length;
      }

      // 残りのテキストを追加
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      // 元のテキストノードをフラグメントで置換
      textNode.parentNode.replaceChild(fragment, textNode);
    } catch (error) {
      console.error("RJ番号変換エラー:", error, textNode);
    }
  }

  /**
   * テキストノードを収集
   */
  function collectTextNodes(element) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          // 空白のみのノードはスキップ
          return node.textContent.trim() === ""
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    return textNodes;
  }

  /**
   * 指定された要素以下のテキストノードを再帰的に処理
   */
  function processTextNodes(element) {
    try {
      const textNodes = collectTextNodes(element);

      // テキストノードを処理（逆順で処理してDOM変更の影響を最小化）
      for (let i = textNodes.length - 1; i >= 0; i--) {
        convertRJNumbers(textNodes[i]);
      }
    } catch (error) {
      console.error("テキストノード処理エラー:", error);
    }
  }

  /**
   * ページ全体を処理
   */
  function processPage() {
    try {
      if (!document.body) {
        console.warn("document.bodyが見つかりません");
        return;
      }

      processTextNodes(document.body);
      document.body.classList.add(CONFIG.PROCESSED_CLASS);
    } catch (error) {
      console.error("DLsite RJ Link Converter Error:", error);
    }
  }

  /**
   * 動的に追加されるコンテンツを監視
   */
  function setupMutationObserver() {
    if (!document.body) {
      return;
    }

    // 追加されたノードをバッファし、デバウンスしてまとめて処理する
    let pendingNodes = new Set();
    let debounceTimer = null;

    const flush = () => {
      debounceTimer = null;
      const nodes = pendingNodes;
      pendingNodes = new Set();

      // 親が同じバッチ内の別ノードに含まれる場合は重複処理を避ける
      for (const node of nodes) {
        if (!node.isConnected) {
          continue;
        }
        processTextNodes(node);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingNodes.add(node);
          }
        }
      }

      if (pendingNodes.size > 0 && debounceTimer === null) {
        debounceTimer = setTimeout(flush, CONFIG.DELAYS.MUTATION_DEBOUNCE);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  /**
   * 初期化処理
   */
  function init() {
    const processAndObserve = () => {
      processPage();
      setupMutationObserver();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", processAndObserve);
    } else {
      processAndObserve();
    }
  }

  // 実行
  init();
})();
