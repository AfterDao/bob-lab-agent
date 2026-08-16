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

const messages = document.querySelector("#messages");

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

function addMessage(role, text, sources = []) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "你" : "LM";
  const body = document.createElement("div");
  const name = document.createElement("b");
  name.textContent = role === "user" ? "你" : "LabMate";
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
  article.append(avatar, body);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
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
  question.value = "";
  send.disabled = true;
  send.textContent = "思考中…";
  const pending = addMessage("assistant", "正在查閱實驗室文件…");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, model: modelSelect.value }),
    });
    const data = await response.json();
    pending.remove();
    if (!response.ok) throw new Error(data.error || "發生未知錯誤");
    addMessage("assistant", data.answer, data.sources);
  } catch (error) {
    pending.remove();
    addMessage("assistant", `目前無法回答：${error.message}`);
  } finally {
    send.disabled = false;
    send.textContent = "送出";
    question.focus();
  }
});

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    question.value = button.textContent;
    form.requestSubmit();
  });
});
