// DOM Elements
const loadingEl = document.getElementById('loading');
const resultEl = document.getElementById('result');
const errorEl = document.getElementById('error');
const riskIndicator = document.getElementById('risk-indicator');
const riskBadge = document.getElementById('risk-badge');
const subjectEl = document.getElementById('subject');
const senderEl = document.getElementById('sender');
const errorMessage = document.getElementById('error-message');

// Buttons
const btnReport = document.getElementById('btn-report');
const btnDismiss = document.getElementById('btn-dismiss');
const btnRetry = document.getElementById('btn-retry');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    analyzeEmail();
});

// Analyze email function
function analyzeEmail() {
    showLoading();

    // Request analysis from background script
    chrome.runtime.sendMessage({ action: 'analyze_email' }, (response) => {
        if (chrome.runtime.lastError) {
            showError('Extension error: ' + chrome.runtime.lastError.message);
            return;
        }

        if (response && response.success) {
            showResult(response.data);
        } else if (response && response.error) {
            showError(response.error);
        } else {
            showError('No email found. Open an email first.');
        }
    });
}

// Show loading state
function showLoading() {
    loadingEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    errorEl.classList.add('hidden');
}

// Show result
function showResult(data) {
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    resultEl.classList.remove('hidden');

    // Update email info
    subjectEl.textContent = data.subject || 'No subject';
    senderEl.textContent = data.sender || 'Unknown sender';

    // Determine risk level from AI response
    const riskLevel = determineRiskLevel(data.result);
    updateRiskIndicator(riskLevel);
}

// Determine risk level from AI analysis
function determineRiskLevel(result) {
    if (!result) return 'medium';

    const text = (typeof result === 'string' ? result : JSON.stringify(result)).toLowerCase();

    if (text.includes('phishing') || text.includes('high risk') || text.includes('malicious') || text.includes('suspicious')) {
        return 'high';
    } else if (text.includes('safe') || text.includes('legitimate') || text.includes('low risk')) {
        return 'safe';
    }
    return 'medium';
}

// Update risk indicator UI
function updateRiskIndicator(level) {
    const riskIcon = riskIndicator.querySelector('.risk-icon');

    riskBadge.className = 'risk-badge ' + level;

    switch (level) {
        case 'high':
            riskIcon.textContent = '⚠️';
            riskBadge.textContent = 'HIGH RISK';
            break;
        case 'medium':
            riskIcon.textContent = '⚡';
            riskBadge.textContent = 'MEDIUM RISK';
            break;
        case 'safe':
            riskIcon.textContent = '✅';
            riskBadge.textContent = 'SAFE';
            break;
    }
}

// Show error state
function showError(message) {
    loadingEl.classList.add('hidden');
    resultEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorMessage.textContent = message;
}

// Event Listeners
btnDismiss.addEventListener('click', () => {
    window.close();
});

btnReport.addEventListener('click', () => {
    // Could implement reporting to a service
    alert('Email reported as phishing!');
    window.close();
});

btnRetry.addEventListener('click', () => {
    analyzeEmail();
});
