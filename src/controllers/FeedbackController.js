/**
 * FeedbackController — manages the feedback modal and the support link copy.
 * Persists submissions to localStorage under `kv_feedback`.
 */

import { showToast, copyToClipboard } from '../utils/toast.js';

const FeedbackController = (function() {
  var feedbackCategory = 'feature';

  function init() {
    var openBtn = document.getElementById('openFeedbackModal');
    if (openBtn) openBtn.addEventListener('click', function() { open('feature'); });

    document.querySelectorAll('.support-card-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        open(this.getAttribute('data-feedback-category') || 'feature');
      });
    });

    var copyBtn = document.getElementById('copySupportLinkBtn');
    if (copyBtn) copyBtn.addEventListener('click', copySupportLink);

    var modal = document.getElementById('feedbackModal');
    var closeBtn = document.getElementById('feedbackModalClose');
    var cancelBtn = document.getElementById('feedbackCancelBtn');
    var sendBtn = document.getElementById('feedbackSendBtn');
    var messageEl = document.getElementById('feedbackMessage');

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (sendBtn) sendBtn.addEventListener('click', submit);
    if (messageEl) messageEl.addEventListener('input', updateCounter);
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) close();
      });
    }

    document.querySelectorAll('.feedback-category-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setCategory(this.getAttribute('data-category') || 'feature');
      });
    });
  }

  function open(category) {
    var modal = document.getElementById('feedbackModal');
    if (!modal) return;
    setCategory(category || feedbackCategory || 'feature');
    var msg = document.getElementById('feedbackMessage');
    if (msg) {
      msg.value = '';
      updateCounter();
      setTimeout(function() { msg.focus(); }, 20);
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function close() {
    var modal = document.getElementById('feedbackModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function setCategory(category) {
    feedbackCategory = category || 'feature';
    document.querySelectorAll('.feedback-category-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-category') === feedbackCategory);
    });
  }

  function updateCounter() {
    var msg = document.getElementById('feedbackMessage');
    var counter = document.getElementById('feedbackCharCount');
    if (!counter) return;
    counter.textContent = msg ? String((msg.value || '').length) : '0';
  }

  function submit() {
    var msg = document.getElementById('feedbackMessage');
    var text = msg ? msg.value.trim() : '';
    if (!text) {
      showToast('Enter your feedback first', 'error');
      if (msg) msg.focus();
      return;
    }

    var activeTab = document.querySelector('.nav-link.active, .nav-sublink.active');
    var feedbackEntry = {
      id: Date.now(),
      category: feedbackCategory,
      message: text,
      page: activeTab ? activeTab.getAttribute('data-tab') : 'unknown',
      createdAt: new Date().toISOString()
    };

    try {
      var existing = JSON.parse(localStorage.getItem('kv_feedback') || '[]');
      existing.unshift(feedbackEntry);
      if (existing.length > 50) existing = existing.slice(0, 50);
      localStorage.setItem('kv_feedback', JSON.stringify(existing));
      showToast('Feedback saved. Thank you.', 'success');
      close();
    } catch (e) {
      console.error('Feedback save failed', e);
      showToast('Could not save feedback', 'error');
    }
  }

  function copySupportLink() {
    var text = 'Check out chess ramp: ' + window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() { showToast('Feedback link copied', 'success'); })
        .catch(function() {
          copyToClipboard(text);
          showToast('Feedback link copied', 'success');
        });
      return;
    }
    copyToClipboard(text);
    showToast('Feedback link copied', 'success');
  }

  return {
    init: init,
    open: open,
    close: close
  };
})();

export default FeedbackController;
