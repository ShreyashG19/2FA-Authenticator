const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

let accounts = [];
let updateInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    loadAccounts();

    document.getElementById("scanBtn").addEventListener("click", startScan);

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "QR_DECODED_NOTIFY") {
            loadAccounts();
        }
    });
});

function loadAccounts() {
    chrome.runtime.sendMessage({ type: "GET_ACCOUNTS" }, (response) => {
        accounts = (response && response.accounts) || [];
        renderAccounts();

        if (updateInterval) clearInterval(updateInterval);
        if (accounts.length > 0) {
            updateInterval = setInterval(updateCodes, 1000);
        }
    });
}

function startScan() {
    const btn = document.getElementById("scanBtn");
    const msg = document.getElementById("scanMsg");

    btn.classList.add("loading");
    btn.textContent = "⏳ Injecting scanner...";

    chrome.runtime.sendMessage({ type: "START_SCAN" }, (response) => {
        btn.classList.remove("loading");
        btn.innerHTML = "<span>▦</span><span>SCAN QR CODE</span>";

        if (response && response.error) {
            setStatus("Error: " + response.error, "error");
            return;
        }

        msg.classList.add("show");
        setStatus("Scanner active — drag on page");

        setTimeout(() => {
            window.close();
        }, 800);
    });

    const pollInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: "GET_ACCOUNTS" }, (response) => {
            const newAccounts = (response && response.accounts) || [];
            if (newAccounts.length > accounts.length) {
                accounts = newAccounts;
                renderAccounts();
                clearInterval(pollInterval);
            }
        });
    }, 1000);

    setTimeout(() => clearInterval(pollInterval), 60000);
}

function renderAccounts() {
    const container = document.getElementById("accountsContainer");

    if (accounts.length === 0) {
        container.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML =
            '<div class="empty-icon">▦</div><div class="empty-text">No accounts yet<br>Click SCAN QR CODE to add</div>';
        container.appendChild(empty);
        return;
    }

    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "accounts";

    accounts.forEach((acc, idx) => {
        const card = document.createElement("div");
        card.className = "account-card";
        card.dataset.index = idx;

        const issuer = document.createElement("div");
        issuer.className = "account-issuer";
        issuer.textContent = acc.issuer;

        const label = document.createElement("div");
        label.className = "account-label";
        label.textContent = acc.account;

        const codeRow = document.createElement("div");
        codeRow.className = "code-row";

        const codeDisplay = document.createElement("div");
        codeDisplay.className = "code-display";
        codeDisplay.id = `code-${idx}`;
        codeDisplay.title = "Click to copy";
        codeDisplay.textContent = "--- ---";

        codeDisplay.addEventListener("click", () => copyCode(idx));

        const ringWrap = document.createElement("div");
        ringWrap.className = "progress-ring-wrap";
        ringWrap.innerHTML = `
      <svg class="progress-ring" width="36" height="36">
        <circle class="progress-track" cx="18" cy="18" r="${RING_RADIUS}"/>
        <circle class="progress-bar" id="ring-${idx}"
          cx="18" cy="18" r="${RING_RADIUS}"
          stroke-dasharray="${RING_CIRCUMFERENCE}"
          stroke-dashoffset="${RING_CIRCUMFERENCE}"/>
      </svg>
      <div class="progress-seconds" id="secs-${idx}">--</div>
    `;

        codeRow.appendChild(codeDisplay);
        codeRow.appendChild(ringWrap);

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.title = "Remove";
        delBtn.textContent = "✕";
        delBtn.addEventListener("click", () => deleteAccount(idx));

        card.appendChild(issuer);
        card.appendChild(label);
        card.appendChild(codeRow);
        card.appendChild(delBtn);
        list.appendChild(card);
    });

    container.appendChild(list);
    updateCodes();
}

async function updateCodes() {
    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const codeEl = document.getElementById(`code-${i}`);
        const ringEl = document.getElementById(`ring-${i}`);
        const secsEl = document.getElementById(`secs-${i}`);

        if (!codeEl) continue;

        try {
            const code = await TOTP.generate(acc.secret);
            const secsLeft = TOTP.getSecondsRemaining();
            const progress = secsLeft / 30;

            codeEl.textContent = code.slice(0, 3) + " " + code.slice(3);

            const isExpiring = secsLeft <= 5;
            codeEl.className = `code-display${isExpiring ? " expired" : ""}`;

            if (ringEl) {
                const offset = RING_CIRCUMFERENCE * (1 - progress);
                ringEl.style.strokeDashoffset = offset;
                ringEl.className = `progress-bar${isExpiring ? " expired" : ""}`;
            }

            if (secsEl) {
                secsEl.textContent = secsLeft;
            }
        } catch (e) {
            codeEl.textContent = "ERR";
            console.error("TOTP error for", acc.issuer, e);
        }
    }
}

async function copyCode(index) {
    const acc = accounts[index];
    if (!acc) return;

    try {
        const code = await TOTP.generate(acc.secret);
        await navigator.clipboard.writeText(code);

        const toast = document.getElementById("copyToast");
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1500);
    } catch (e) {
        console.error("Copy failed:", e);
    }
}

function deleteAccount(index) {
    const card = document.querySelector(`.account-card[data-index="${index}"]`);
    if (!card || card.querySelector(".confirm-row")) return;

    const confirmRow = document.createElement("div");
    confirmRow.className = "confirm-row";
    confirmRow.style.cssText = `
    display:flex;align-items:center;gap:8px;
    margin-top:8px;padding-top:8px;border-top:1px solid #2a1a1a;
  `;

    const label = document.createElement("span");
    label.style.cssText =
        "font-size:11px;color:#ff6677;font-family:monospace;flex:1;";
    label.textContent = "Remove this account?";

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "YES";
    yesBtn.style.cssText = `
    background:#ff4455;border:none;color:#fff;
    padding:4px 12px;border-radius:4px;
    font-family:monospace;font-size:11px;font-weight:bold;
    cursor:pointer;letter-spacing:1px;
  `;

    const noBtn = document.createElement("button");
    noBtn.textContent = "NO";
    noBtn.style.cssText = `
    background:transparent;border:1px solid #3a4a5a;color:#8a9aaa;
    padding:4px 10px;border-radius:4px;
    font-family:monospace;font-size:11px;cursor:pointer;
  `;

    yesBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "DELETE_ACCOUNT", index }, () => {
            loadAccounts();
        });
    });

    noBtn.addEventListener("click", () => {
        confirmRow.remove();
    });

    confirmRow.appendChild(label);
    confirmRow.appendChild(yesBtn);
    confirmRow.appendChild(noBtn);
    card.appendChild(confirmRow);
}

function setStatus(text) {
    const el = document.getElementById("statusText");
    if (el) el.textContent = text;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
