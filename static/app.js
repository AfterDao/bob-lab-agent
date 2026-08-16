const tasks = [
  "安裝並設定 VS Code",
  "學會使用終端機",
  "完成 Git 基礎操作",
  "理解 branch 與 merge",
  "建立 Python 虛擬環境",
  "管理專案套件與版本",
  "閱讀並維護 README",
  "學會保存完整錯誤資訊",
];

const saved = JSON.parse(localStorage.getItem("labmate-progress") || "[]");
const checklist = document.querySelector("#checklist");
tasks.forEach((task, index) => {
  const label = document.createElement("label");
  label.innerHTML = `<input type="checkbox" ${saved[index] ? "checked" : ""}><span></span>`;
  label.querySelector("span").textContent = task;
  label.querySelector("input").addEventListener("change", saveProgress);
  checklist.appendChild(label);
});

function saveProgress() {
  const state = [...checklist.querySelectorAll("input")].map((item) => item.checked);
  localStorage.setItem("labmate-progress", JSON.stringify(state));
  const completed = state.filter(Boolean).length;
  document.querySelector("#progressText").textContent = `${completed} / ${tasks.length}`;
  document.querySelector("#progressBar").style.width = `${(completed / tasks.length) * 100}%`;
}
saveProgress();

const status = document.querySelector("#status");
const modelSelect = document.querySelector("#model");
const knowledgeStatus = document.querySelector("#knowledgeStatus");
fetch("/api/health").then((response) => response.json()).then((data) => {
  if (!data.ollama) {
    status.textContent = "Ollama 尚未連線";
    status.className = "status offline";
    return;
  }
  status.textContent = "Ollama 本機連線正常";
  status.className = "status";
  modelSelect.innerHTML = "";
  const models = data.models.length ? data.models : [data.default];
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = option.textContent = model;
    if (model === data.default) option.selected = true;
    modelSelect.appendChild(option);
  });
}).catch(() => {
  status.textContent = "服務狀態無法取得";
  status.className = "status offline";
});

fetch("/api/knowledge/status").then((response) => response.json()).then((data) => {
  updateKnowledgeStatus(data);
}).catch(() => {
  knowledgeStatus.textContent = "知識庫狀態無法取得";
});

function updateKnowledgeStatus(data) {
  const versions = data.versions ? ` · ${data.versions} 個舊版本` : "";
  knowledgeStatus.textContent = `知識庫：${data.documents} 份文件 · ${data.sections} 個段落${versions}`;
}

const knowledgeDialog = document.querySelector("#knowledgeDialog");
const documentList = document.querySelector("#documentList");
const documentName = document.querySelector("#documentName");
const documentContent = document.querySelector("#documentContent");
const documentSaveStatus = document.querySelector("#documentSaveStatus");
let activeDocument = "";

function startNewDocument() {
  activeDocument = "";
  documentName.value = "";
  documentContent.value = "# 新文件\n\n## 說明\n\n請在這裡補充實驗室知識。\n";
  documentSaveStatus.textContent = "新文件儲存後會立即加入搜尋。";
  documentList.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  documentName.focus();
}

function selectDocument(doc, button) {
  activeDocument = doc.file;
  documentName.value = doc.file;
  documentContent.value = doc.content;
  documentSaveStatus.textContent = "修改後儲存，系統會自動保留舊版本。";
  documentList.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
  button?.classList.add("active");
}

async function loadDocuments(selectFile = "") {
  const response = await fetch("/api/documents");
  const documents = await response.json();
  documentList.innerHTML = "";
  documents.forEach((doc) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = doc.file;
    button.addEventListener("click", () => selectDocument(doc, button));
    documentList.appendChild(button);
    if (doc.file === selectFile) selectDocument(doc, button);
  });
  if (!selectFile && documents.length) selectDocument(documents[0], documentList.firstElementChild);
  if (!documents.length) startNewDocument();
}

document.querySelector("#manageKnowledge").addEventListener("click", async () => {
  knowledgeDialog.showModal();
  documentSaveStatus.textContent = "正在讀取文件…";
  try {
    await loadDocuments();
  } catch {
    documentSaveStatus.textContent = "無法讀取知識庫。";
  }
});
document.querySelector("#closeKnowledge").addEventListener("click", () => knowledgeDialog.close());
document.querySelector("#newDocument").addEventListener("click", startNewDocument);
document.querySelector("#saveDocument").addEventListener("click", async () => {
  const button = document.querySelector("#saveDocument");
  button.disabled = true;
  documentSaveStatus.textContent = "正在儲存…";
  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: documentName.value, content: documentContent.value, original_file: activeDocument }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "儲存失敗");
    activeDocument = data.file;
    updateKnowledgeStatus(data.status);
    await loadDocuments(data.file);
    documentSaveStatus.textContent = data.created ? "新文件已建立並加入搜尋。" : "文件已更新，舊版本已備份。";
  } catch (error) {
    documentSaveStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

const messages = document.querySelector("#messages");
const HISTORY_KEY = "bob-lab-chat-history";
let conversation = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

function saveConversation() {
  conversation = conversation.slice(-20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(conversation));
}

function appendInlineMarkdown(container, text) {
  const cleanedText = text.replace(/```[\w+-]*/g, "").trimEnd();
  const parts = cleanedText.split(/(`[^`\n]+`)/g);
  parts.forEach((part) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      container.appendChild(code);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      const language = fence[1] || "code";
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement("pre");
      pre.dataset.language = language;
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      fragment.appendChild(pre);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${Math.min(heading[1].length + 2, 5)}`);
      appendInlineMarkdown(element, heading[2]);
      fragment.appendChild(element);
      index += 1;
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const list = document.createElement(unordered ? "ul" : "ol");
      const pattern = unordered ? /^[-*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/;
      while (index < lines.length) {
        const itemMatch = lines[index].match(pattern);
        if (!itemMatch) break;
        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[1]);
        list.appendChild(item);
        index += 1;
      }
      fragment.appendChild(list);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+[.)]\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join("\n"));
    fragment.appendChild(paragraph);
  }

  return fragment;
}

function addFeedback(body, questionText, answerText, sources) {
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  feedback.append("這個回答有幫助嗎？");
  [["up", "👍"], ["down", "👎"]].forEach(([rating, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      feedback.querySelectorAll("button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, question: questionText, answer: answerText, model: modelSelect.value, sources }),
        });
        feedback.firstChild.textContent = "謝謝你的回饋";
      } catch {
        feedback.firstChild.textContent = "回饋暫時無法儲存";
      }
    });
    feedback.appendChild(button);
  });
  body.appendChild(feedback);
}

function addMessage(role, text, sources = [], options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "你" : "BOB";
  const body = document.createElement("div");
  const name = document.createElement("b");
  name.textContent = role === "user" ? "你" : "Bob Lab Agent";
  body.appendChild(name);
  if (role === "assistant") {
    body.appendChild(renderMarkdown(text));
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    body.appendChild(paragraph);
  }
  if (sources.length) {
    const sourceBox = document.createElement("div");
    sourceBox.className = "sources";
    sourceBox.textContent = "參考來源：" + sources.map((source) => `${source.file}｜${source.section}`).join("、");
    body.appendChild(sourceBox);
  }
  if (role === "assistant" && options.feedback) {
    addFeedback(body, options.question || "", text, sources);
  }
  article.append(avatar, body);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

if (conversation.length) {
  messages.innerHTML = "";
  conversation.forEach((item) => addMessage(item.role, item.content, item.sources || []));
}

const form = document.querySelector("#chatForm");
const question = document.querySelector("#question");
const send = document.querySelector("#send");
question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = question.value.trim();
  if (!text) return;
  addMessage("user", text);
  const historyForRequest = conversation.slice(-6).map(({ role, content }) => ({ role, content }));
  conversation.push({ role: "user", content: text });
  saveConversation();
  question.value = "";
  send.disabled = true;
  send.textContent = "思考中…";
  const pending = addMessage("assistant", "正在查閱實驗室文件…");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, model: modelSelect.value, history: historyForRequest }),
    });
    const data = await response.json();
    pending.remove();
    if (!response.ok) throw new Error(data.error || "發生未知錯誤");
    addMessage("assistant", data.answer, data.sources, { feedback: true, question: text });
    conversation.push({ role: "assistant", content: data.answer, sources: data.sources });
    saveConversation();
  } catch (error) {
    pending.remove();
    addMessage("assistant", `目前無法回答：${error.message}`);
  } finally {
    send.disabled = false;
    send.textContent = "送出";
    question.focus();
  }
});

document.querySelector("#clearChat").addEventListener("click", () => {
  conversation = [];
  localStorage.removeItem(HISTORY_KEY);
  messages.innerHTML = "";
  addMessage("assistant", "對話已清除。你可以重新問一個開發問題。");
});

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    question.value = button.textContent;
    form.requestSubmit();
  });
});
