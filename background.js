chrome.action.onClicked.addListener((tab) => {
  // 1. Inject content script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    // 2. Extract email text
    chrome.tabs.sendMessage(tab.id, { action: "extract_email" }, (emailData) => {
      if (emailData) {
        console.log("Extracted Data:", emailData);

        // 3. SEND TO N8N (LOCAL URL - TEST URL FROM WEBHOOK NODE)
        const N8N_WEBHOOK_URL = "https://bwbwy4r4y50rtzug6cgnkvdu.hooks.n8n.cloud/webhook/scan-email";

        // Show a "Thinking..." notification
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Analyzing email... please wait a few seconds.")
        });

        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: emailData.subject,
            body: emailData.body
          })
        })
          .then(response => response.json())
          .then(data => {
            console.log("n8n Response Raw:", data);

            // --- BULLETPROOF LOGIC ---
            // 1. Default to a generic error message
            let safeMessage = "Error: No analysis text returned from AI.";

            // 2. Check if we have a result
            if (data && data.result) {
              // Force it to be a string, no matter what
              if (typeof data.result === 'object') {
                safeMessage = JSON.stringify(data.result);
              } else {
                safeMessage = String(data.result);
              }
            } else {
              // If data came back empty, show the raw data for debugging
              safeMessage = "Debug: " + JSON.stringify(data);
            }

            // 3. Show Alert
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (msg) => {
                alert("SECURITY ANALYSIS:\n\n" + msg);
              },
              args: [safeMessage] // This is now 100% guaranteed to be a string
            });
          })
          .catch(error => {
            console.error("Error:", error);
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (err) => alert("Connection Error: " + err),
              args: [String(error)]
            });
          });
      }
    });
  });
});
