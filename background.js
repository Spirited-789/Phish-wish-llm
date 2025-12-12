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
          if (emailData) {
            console.log("Extracted Data:", emailData);

            // If you have SAVED and ACTIVATED the workflow, use the PRODUCTION URL:
            const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/scan-email";

            // Show a "Thinking..." notification
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () =>
                alert("Analyzing email... please wait a few seconds."),
            });

            // 3. Send to n8n
            fetch(N8N_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sender: emailData.sender, // Now sending the sender info!
                subject: emailData.subject,
                body: emailData.body,
              }),
            })
              .then(async (response) => {
                // --- FIXED: Prevent "Unexpected end of JSON" crash ---

                // 1. Check for HTTP errors (like 404 or 500)
                if (!response.ok) {
                  throw new Error(
                    `Server Error: ${response.status} ${response.statusText}`
                  );
                }

                // 2. Read text first, BEFORE trying to parse JSON
                const text = await response.text();

                // 3. If response is empty, throw a clear error instead of crashing
                if (!text) {
                  throw new Error(
                    "n8n returned an empty response. (Did you forget to Activate the workflow or click Listen?)"
                  );
                }

                // 4. Safe to parse
                return JSON.parse(text);
              })
              .then((data) => {
                console.log("n8n Response Raw:", data);

                // --- BULLETPROOF LOGIC ---
                let safeMessage = "Error: No analysis text returned from AI.";

                // Check if we have a result
                if (data && data.result) {
                  // Force it to be a string
                  if (typeof data.result === "object") {
                    safeMessage = JSON.stringify(data.result);
                  } else {
                    safeMessage = String(data.result);
                  }
                } else {
                  // Debugging help if data is weird
                  safeMessage = "Debug: " + JSON.stringify(data);
                }

                // debug: force the UI into "phishing" mode for testing
                const status = "phishing";
                // Show the final Alert
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },

                  func: (message, status) => {
                    /* ------------------------
       REMOVE OLD BANNER
    -------------------------*/
                    const existing = document.getElementById(
                      "pd-inline-banner-root"
                    );
                    if (existing) existing.remove();

                    /* ------------------------
       CREATE ROOT
    -------------------------*/
                    const root = document.createElement("div");
                    root.id = "pd-inline-banner-root";
                    root.style.zIndex = 2147483646;
                    document.body.appendChild(root);

                    /* ------------------------
       STYLE (SCOPED)
    -------------------------*/
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
        pointer-events: none;
      }

      @keyframes pd-slide {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      #pd-inline-banner .pd-box {
        width: calc(100% - 48px);
        max-width: 1200px;
        background: ${status === "safe" ? "#d6ffd8" : "#f2c94c"};
        border-left: 6px solid ${status === "safe" ? "#2ecc71" : "#f2994a"};
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

                    /* ------------------------
       BANNER STRUCTURE
    -------------------------*/
                    const wrapper = document.createElement("div");
                    wrapper.id = "pd-inline-banner";
                    root.appendChild(wrapper);

                    const box = document.createElement("div");
                    box.className = "pd-box";
                    wrapper.appendChild(box);

                    /* ICON */
                    const icon = document.createElement("div");
                    icon.className = "pd-icon";
                    icon.textContent = status === "safe" ? "✅" : "⚠️";
                    box.appendChild(icon);

                    /* TEXT */
                    const text = document.createElement("div");
                    text.className = "pd-text";
                    const heading =
                      status === "safe"
                        ? "This email appears safe. "
                        : "This message looks suspicious — it might be a phishing attempt. ";
                    text.textContent = heading + (message || "");
                    box.appendChild(text);

                    /* ACTIONS */
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

                    /* CLOSE BUTTON */
                    const close = document.createElement("button");
                    close.className = "pd-close";
                    close.textContent = "✕";
                    close.onclick = () => root.remove();
                    box.appendChild(close);

                    /* AUTO-DISMISS */
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

                  args: [safeMessage, status], // pass message + safe/phishing status
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
        }
      );
    }
  );
});
