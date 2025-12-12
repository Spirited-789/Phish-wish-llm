chrome.action.onClicked.addListener((tab) => {
  // 1. Inject content script
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content.js"],
    },
    () => {
      // 2. Extract email text (Subject, Body, AND Sender)
      chrome.tabs.sendMessage(
        tab.id,
        { action: "extract_email" },
        (emailData) => {
          if (!emailData) return;

          console.log("Extracted Data:", emailData);

          // Use your local webhook for development; replace with production URL later
          const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/scan-email";

          // Optional small toast to indicate work started (non-blocking)
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const id = "pd-working-toast";
              const prev = document.getElementById(id);
              if (prev) prev.remove();
              const t = document.createElement("div");
              t.id = id;
              t.textContent = "Analyzing email...";
              Object.assign(t.style, {
                position: "fixed",
                top: "12px",
                right: "12px",
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: "8px",
                zIndex: 2147483646,
              });
              document.body.appendChild(t);
              setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.remove();
              }, 2200);
            },
          });

          // 3. Send to n8n
          fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: emailData.sender,
              subject: emailData.subject,
              body: emailData.body,
            }),
          })
            .then(async (response) => {
              // HTTP error handling
              if (!response.ok) {
                throw new Error(
                  `Server Error: ${response.status} ${response.statusText}`
                );
              }

              // Read text first to avoid unexpected-JSON errors
              const text = await response.text();
              if (!text) {
                throw new Error(
                  "n8n returned an empty response. (Did you forget to Activate the workflow or click Listen?)"
                );
              }

              return JSON.parse(text);
            })
            .then((data) => {
              console.log("n8n Response Raw:", data);

              // --- BULLETPROOF LOGIC ---
              let safeMessage = "Error: No analysis text returned from AI.";

              if (data && data.result) {
                safeMessage =
                  typeof data.result === "object"
                    ? JSON.stringify(data.result)
                    : String(data.result);
              } else {
                safeMessage = "Debug: " + JSON.stringify(data);
              }

              // debug: force the UI into "phishing" mode for testing
              // change "phishing" -> "safe" to test the green banner
              const status = "phishing";

              // Inject the inline banner UI into the current tab
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (message, status) => {
                  // Remove old banner if present
                  const existing = document.getElementById(
                    "pd-inline-banner-root"
                  );
                  if (existing) existing.remove();

                  // Create root container
                  const root = document.createElement("div");
                  root.id = "pd-inline-banner-root";
                  root.style.zIndex = 2147483646;
                  document.body.appendChild(root);

                  // Scoped styles
                  const style = document.createElement("style");
                  style.textContent = `
                  #pd-inline-banner {
                    position: fixed;
                    top: 58px; /* Adjust if needed */
                    left: 0;
                    right: 0;
                    margin: 0 auto;
                    display: flex;
                    justify-content: center;
                    animation: pd-slide .22s ease-out;
                    transform-origin: top center;
                    pointer-events: auto;
                  }
                  @keyframes pd-slide {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                  #pd-inline-banner .pd-box {
                    width: calc(100% - 48px);
                    max-width: 1200px;
                    background: ${status === "safe" ? "#d6ffd8" : "#f2c94c"};
                    border-left: 6px solid ${
                      status === "safe" ? "#2ecc71" : "#f2994a"
                    };
                    padding: 12px 16px;
                    border-radius: 6px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    pointer-events: auto;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial;
                  }
                  .pd-icon { font-size: 20px; }
                  .pd-text { flex: 1; font-size: 15px; font-weight: 600; }
                  .pd-actions { display: flex; gap: 14px; }
                  .pd-link {
                    cursor: pointer;
                    font-weight: 700;
                    text-decoration: underline;
                    color: #082426;
                  }
                  .pd-close {
                    margin-left: 10px;
                    cursor: pointer;
                    border: none;
                    background: rgba(0,0,0,0.1);
                    border-radius: 6px;
                    padding: 4px 8px;
                    font-weight: bold;
                  }
                `;
                  root.appendChild(style);

                  // Banner structure
                  const wrapper = document.createElement("div");
                  wrapper.id = "pd-inline-banner";
                  root.appendChild(wrapper);

                  const box = document.createElement("div");
                  box.className = "pd-box";
                  wrapper.appendChild(box);

                  // Icon
                  const icon = document.createElement("div");
                  icon.className = "pd-icon";
                  icon.textContent = status === "safe" ? "✅" : "⚠️";
                  box.appendChild(icon);

                  // Text
                  const text = document.createElement("div");
                  text.className = "pd-text";
                  const heading =
                    status === "safe"
                      ? "This email appears safe. "
                      : "This message looks suspicious — it might be a phishing attempt. ";
                  text.textContent = heading + (message || "");
                  box.appendChild(text);

                  // Actions
                  const actions = document.createElement("div");
                  actions.className = "pd-actions";
                  box.appendChild(actions);

                  const act1 = document.createElement("span");
                  act1.className = "pd-link";
                  act1.textContent = status === "safe" ? "OK" : "Delete";
                  act1.onclick = () => root.remove();
                  actions.appendChild(act1);

                  const act2 = document.createElement("span");
                  act2.className = "pd-link";
                  act2.textContent = "More details";
                  act2.onclick = () => alert(message);
                  actions.appendChild(act2);

                  // Close button
                  const close = document.createElement("button");
                  close.className = "pd-close";
                  close.textContent = "✕";
                  close.onclick = () => root.remove();
                  box.appendChild(close);

                  // Auto-dismiss
                  setTimeout(
                    () => {
                      const el = document.getElementById(
                        "pd-inline-banner-root"
                      );
                      if (el) el.remove();
                    },
                    status === "safe" ? 9000 : 20000
                  );
                },
                args: [safeMessage, status],
              });
            })
            .catch((error) => {
              console.error("Error:", error);

              // Show error alert to user
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (err) => alert("Connection Error: " + err),
                args: [String(error.message || error)],
              });
            });
        }
      );
    }
  );
});
