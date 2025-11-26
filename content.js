chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_email") {

    // 1. Get Subject
    const subjectElement = document.querySelector('h2.hP');
    const subject = subjectElement ? subjectElement.innerText : "No Subject Found";

    // 2. Get Body (Last .a3s div is the current message)
    const bodyElements = document.querySelectorAll('.a3s');
    const bodyElement = bodyElements[bodyElements.length - 1];
    const body = bodyElement ? bodyElement.innerText : "No Body Found";

    // --- NEW: 3. Get Sender ---
    // Gmail uses class 'gD' for the sender's name.
    // It also usually stores the actual email in an 'email' attribute.
    const senderElement = document.querySelector('.gD');
    
    let senderInfo = "Unknown Sender";
    
    if (senderElement) {
        const name = senderElement.innerText; // e.g. "Google Support"
        const email = senderElement.getAttribute('email'); // e.g. "no-reply@google.com"
        // Combine them so the AI sees both
        senderInfo = `${name} <${email}>`; 
    }

    // 4. Send all 3 data points back
    sendResponse({ 
        sender: senderInfo,
        subject: subject, 
        body: body 
    });
  }
});