const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/scan-email";

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze_email") {
    handleAnalyzeEmail(sendResponse);
    return true; // Keep channel open for async response
  }
});

// Handle email analysis
async function handleAnalyzeEmail(sendResponse) {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url.includes("mail.google.com")) {
      sendResponse({ success: false, error: "Please open a Gmail email first." });
      return;
    }

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    // Extract email data
    const emailData = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: "extract_email" }, resolve);
    });

    if (!emailData || !emailData.body) {
      sendResponse({ success: false, error: "Could not extract email. Try opening the email fully." });
      return;
    }

    // Send to n8n for analysis
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: emailData.sender,
        subject: emailData.subject,
        body: emailData.body
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
      throw new Error("Empty response from n8n. Is the workflow active?");
    }

    const data = JSON.parse(text);

    sendResponse({
      success: true,
      data: {
        sender: emailData.sender,
        subject: emailData.subject,
        result: data.result || data
      }
    });

  } catch (error) {
    console.error("Analysis error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
