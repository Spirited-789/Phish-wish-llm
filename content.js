// This runs when the background script says "GO"
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_email") {

    // 1. Try to grab the Subject Line (usually an <h2> with class 'hP')
    const subjectElement = document.querySelector('h2.hP');
    const subject = subjectElement ? subjectElement.innerText : "No Subject Found";

    // 2. Try to grab the Email Body (usually a div with class 'a3s')
    // We select the last one to get the most recent message in a thread
    const bodyElements = document.querySelectorAll('.a3s');
    const bodyElement = bodyElements[bodyElements.length - 1];
    const body = bodyElement ? bodyElement.innerText : "No Body Found";

    // 3. Send data back to the extension
    sendResponse({ subject: subject, body: body });
  }
});