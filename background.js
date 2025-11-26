chrome.action.onClicked.addListener((tab) => {
  // 1. Inject content script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  }, () => {
    // 2. Extract email text (Subject, Body, AND Sender)
    chrome.tabs.sendMessage(tab.id, { action: "extract_email" }, (emailData) => {
      if (emailData) {
        console.log("Extracted Data:", emailData);
        
        // If you have SAVED and ACTIVATED the workflow, use the PRODUCTION URL:
        const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/scan-email";

        // Show a "Thinking..." notification
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Analyzing email... please wait a few seconds.")
        });

        // 3. Send to n8n
        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: emailData.sender,   // Now sending the sender info!
            subject: emailData.subject,
            body: emailData.body
          })
        })
        .then(async (response) => {
          // --- FIXED: Prevent "Unexpected end of JSON" crash ---
          
          // 1. Check for HTTP errors (like 404 or 500)
          if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
          }

          // 2. Read text first, BEFORE trying to parse JSON
          const text = await response.text();
          
          // 3. If response is empty, throw a clear error instead of crashing
          if (!text) {
            throw new Error("n8n returned an empty response. (Did you forget to Activate the workflow or click Listen?)");
          }

          // 4. Safe to parse
          return JSON.parse(text);
        })
        .then(data => {
          console.log("n8n Response Raw:", data);

          // --- BULLETPROOF LOGIC ---
          let safeMessage = "Error: No analysis text returned from AI.";

          // Check if we have a result
          if (data && data.result) {
            // Force it to be a string
            if (typeof data.result === 'object') {
              safeMessage = JSON.stringify(data.result);
            } else {
              safeMessage = String(data.result);
            }
          } else {
            // Debugging help if data is weird
            safeMessage = "Debug: " + JSON.stringify(data);
          }

          // Show the final Alert
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (msg) => {
              alert("SECURITY ANALYSIS:\n\n" + msg);
            },
            args: [safeMessage] 
          });
        })
        .catch(error => {
          console.error("Error:", error);
          
          // Show error alert to user
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (err) => alert("Connection Error: " + err),
            args: [String(error.message || error)]
          });
        });
      }
    });
  });
});