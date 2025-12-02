document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("event-modal");
  const detailModal = document.getElementById("detail-modal");

  // Set up Add Event button
  const addEventBtn = document.getElementById("add-event");
  if (addEventBtn) {
    addEventBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });
  }

  // Close modal buttons
  const closeModalBtn = document.getElementById("close-modal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      modal.style.display = "none";
      clearEventForm();
    });
  }

  const closeAddEventBtn = document.getElementById("close-add-event");
  if (closeAddEventBtn) {
    closeAddEventBtn.addEventListener("click", () => {
      modal.style.display = "none";
      clearEventForm();
    });
  }

  // Close detail modal
  const closeDetailBtn = document.getElementById("close-detail");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => {
      detailModal.style.display = "none";
    });
  }

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      clearEventForm();
    }
    if (e.target === detailModal) {
      detailModal.style.display = "none";
    }
  });

  // Save Event button
  const saveEventBtn = document.getElementById("save-event");
  if (saveEventBtn) {
    saveEventBtn.addEventListener("click", async () => {
      await handleSaveEvent();
    });
  }

  // Add from Email button - Open email modal
  const addEmailBtn = document.getElementById("add-email");
  const emailModal = document.getElementById("email-modal");

  if (addEmailBtn) {
    addEmailBtn.addEventListener("click", () => {
      emailModal.style.display = "flex";
    });
  }

  // Close email modal handlers
  const closeEmailModalBtn = document.getElementById("close-email-modal");
  const closeEmailModalBtn2 = document.getElementById("close-email-modal-btn");

  if (closeEmailModalBtn) {
    closeEmailModalBtn.addEventListener("click", () => {
      emailModal.style.display = "none";
    });
  }

  if (closeEmailModalBtn2) {
    closeEmailModalBtn2.addEventListener("click", () => {
      emailModal.style.display = "none";
    });
  }

  // Process emails button
  const processEmailsBtn = document.getElementById("process-emails-btn");
  if (processEmailsBtn) {
    processEmailsBtn.addEventListener("click", async () => {
      await handleProcessEmails();
    });
  }

  // Set minimum datetime to now
  const eventDateInput = document.getElementById("event-date");
  if (eventDateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    eventDateInput.min = now.toISOString().slice(0, 16);
  }
});

async function handleSaveEvent() {
  const title = document.getElementById("event-title").value.trim();
  const datetime = document.getElementById("event-date").value;
  const location = document.getElementById("event-location").value.trim();
  const description = document.getElementById("event-description")?.value.trim() || "";

  // Validation
  if (!title) {
    showToast("Missing Title", "Please enter an event title", "warning");
    return;
  }

  if (!datetime) {
    showToast("Missing Date", "Please select a date and time", "warning");
    return;
  }

  const startDate = new Date(datetime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour default

  // Check if connected to Google Calendar
  if (window.calendarAPI && window.calendarAPI.isConnected()) {
    try {
      // Add event directly to Google Calendar
      const event = {
        'summary': title,
        'location': location,
        'description': description,
        'start': {
          'dateTime': startDate.toISOString(),
          'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        'end': {
          'dateTime': endDate.toISOString(),
          'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      await window.calendarAPI.addEvent(event);

      showToast("Event Added", "Event successfully added to your Google Calendar", "success");

      // Refresh the events display
      if (typeof loadUserEvents === 'function') {
        await loadUserEvents();
      }

      // Close modal and clear form
      document.getElementById("event-modal").style.display = "none";
      clearEventForm();

    } catch (error) {
      console.error("Error adding event:", error);
      showToast("Error", "Failed to add event. Please try again.", "error");
    }
  } else {
    // Not connected - open Google Calendar with pre-filled data
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(description)}`;
    
    window.open(googleCalendarUrl, '_blank');

    showToast("Opening Google Calendar", "Please connect your calendar for automatic syncing!", "info", 4000);

    document.getElementById("event-modal").style.display = "none";
    clearEventForm();
  }
}

function clearEventForm() {
  document.getElementById("event-title").value = "";
  document.getElementById("event-date").value = "";
  document.getElementById("event-location").value = "";
  const descField = document.getElementById("event-description");
  if (descField) {
    descField.value = "";
  }
}

// Helper function to format date for Google Calendar URL
function formatGoogleDate(date) {
  return date.toISOString().replace(/-|:|\.\d+/g, '');
}

// Update current date display
function updateCurrentDate() {
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = new Date().toLocaleDateString('en-US', options);
  }
}

// Initialize current date
updateCurrentDate();

// Update date every minute
setInterval(updateCurrentDate, 60000);

// ========== TOAST NOTIFICATION SYSTEM ==========
function showToast(title, message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icon based on type
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close">×</button>
  `;

  // Add to container
  container.appendChild(toast);

  // Close button handler
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
}

function removeToast(toast) {
  toast.classList.add('fade-out');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// Handle processing emails
async function handleProcessEmails() {
  const amount = document.getElementById("email-amount").value;
  const processBtn = document.getElementById("process-emails-btn");
  const originalText = processBtn.textContent;

  // Validate amount
  if (!amount || amount < 1 || amount > 25) {
    showToast("Invalid Amount", "Please enter a number between 1 and 25", "warning");
    return;
  }

  // Close modal immediately and show processing toast
  document.getElementById("email-modal").style.display = "none";

  showToast(
    "Processing...",
    `Fetching and analyzing ${amount} emails. This may take a minute.`,
    "info",
    0  // Don't auto-dismiss while processing
  );

  try {
    // Disable button and show loading state
    processBtn.disabled = true;
    processBtn.textContent = "Processing...";

    // Prepare email events section
    const emailEventsSection = document.getElementById("email-events-section");
    const emailEventsContainer = document.getElementById("email-events");
    emailEventsSection.style.display = "block";
    emailEventsContainer.innerHTML = "";

    let eventCount = 0;
    let emailsProcessed = 0;

    // Use EventSource for real-time streaming
    const eventSource = new EventSource(`/api/process_emails_stream?amount=${amount}`);

    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        // Update processing toast
        const toastContainer = document.getElementById('toast-container');
        const processingToast = toastContainer.querySelector('.toast.info .toast-message');
        if (processingToast) {
          processingToast.textContent = data.message;
        }
      } else if (data.type === 'progress') {
        // Update progress in toast
        const toastContainer = document.getElementById('toast-container');
        const processingToast = toastContainer.querySelector('.toast.info .toast-message');
        if (processingToast) {
          processingToast.textContent = `Analyzing email ${data.current} of ${data.total}...`;
        }
      } else if (data.type === 'event') {
        // Add event card immediately as it's found
        const card = createEmailEventCard(data.event);
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        emailEventsContainer.appendChild(card);

        // Animate in
        setTimeout(() => {
          card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50);

        eventCount++;
      } else if (data.type === 'complete') {
        // Processing complete
        eventSource.close();
        emailsProcessed = data.emails_processed;

        // Clear processing toast
        const toastContainer = document.getElementById('toast-container');
        toastContainer.innerHTML = '';

        // Show completion toast
        showToast(
          "Complete!",
          `Processed ${emailsProcessed} emails, found ${eventCount} event${eventCount !== 1 ? 's' : ''}.`,
          "success",
          4000
        );

        // Re-enable button
        processBtn.disabled = false;
        processBtn.textContent = originalText;

        // Show "no events" message if needed
        if (eventCount === 0) {
          emailEventsContainer.innerHTML = '<p class="no-events-text">No events found in emails</p>';
        }
      } else if (data.type === 'error') {
        // Error occurred
        eventSource.close();

        // Clear processing toast
        const toastContainer = document.getElementById('toast-container');
        toastContainer.innerHTML = '';

        showToast(
          "Error",
          data.message || "Failed to process emails.",
          "error",
          6000
        );

        // Re-enable button
        processBtn.disabled = false;
        processBtn.textContent = originalText;
      }
    };

    eventSource.onerror = function(error) {
      console.error("EventSource error:", error);
      eventSource.close();

      // Clear processing toast
      const toastContainer = document.getElementById('toast-container');
      toastContainer.innerHTML = '';

      showToast(
        "Connection Error",
        "Lost connection to server. Please try again.",
        "error",
        5000
      );

      // Re-enable button
      processBtn.disabled = false;
      processBtn.textContent = originalText;
    };

  } catch (error) {
    console.error("Error processing emails:", error);

    // Clear the processing toast
    const toastContainer = document.getElementById('toast-container');
    toastContainer.innerHTML = '';

    showToast(
      "Error",
      error.message || "Failed to process emails. Please try again.",
      "error",
      5000
    );

    // Re-enable button
    processBtn.disabled = false;
    processBtn.textContent = originalText;
  }
}

// Display email events progressively with animation
async function displayEmailEventsProgressively(events) {
  const emailEventsSection = document.getElementById("email-events-section");
  const emailEventsContainer = document.getElementById("email-events");

  // Show the email events section
  emailEventsSection.style.display = "block";

  // Clear previous events
  emailEventsContainer.innerHTML = "";

  // If no events, show message
  if (!events || events.length === 0) {
    emailEventsContainer.innerHTML = '<p class="no-events-text">No events found in emails</p>';
    return;
  }

  // Add events one by one with delay for smooth animation
  for (let i = 0; i < events.length; i++) {
    const card = createEmailEventCard(events[i]);
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    emailEventsContainer.appendChild(card);

    // Animate in
    setTimeout(() => {
      card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 50);

    // Small delay between each card (150ms)
    if (i < events.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  // Update the processing toast with count
  const toastContainer = document.getElementById('toast-container');
  const processingToast = toastContainer.querySelector('.toast.info');
  if (processingToast) {
    const toastMessage = processingToast.querySelector('.toast-message');
    if (toastMessage) {
      toastMessage.textContent = `Found ${events.length} event${events.length !== 1 ? 's' : ''}! Adding to display...`;
    }
  }
}

// Display email events in the dedicated section (instant, no animation)
function displayEmailEvents(events) {
  const emailEventsSection = document.getElementById("email-events-section");
  const emailEventsContainer = document.getElementById("email-events");

  // Show the email events section
  emailEventsSection.style.display = "block";

  // Clear previous events
  emailEventsContainer.innerHTML = "";

  // If no events, show message
  if (!events || events.length === 0) {
    emailEventsContainer.innerHTML = '<p class="no-events-text">No events found in emails</p>';
    return;
  }

  // Create cards for each event
  events.forEach(event => {
    const card = createEmailEventCard(event);
    emailEventsContainer.appendChild(card);
  });
}

// Create event card for email events (similar to browse events)
function createEmailEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card-browse';

  // Set time value
  let time = event.start_time;
  if (event.start_time === "12:00 AM" && event.end_time === "11:59 PM") {
    time = "All Day";
  }

  // Build the HTML for the card
  let html = '<div class="event-card-title">' + (event.summary || 'Untitled Event') + '</div>';
  html += '<div class="event-card-info"><strong>📅</strong><span>' + (event.start_date || 'Date TBA') + '</span></div>';
  html += '<div class="event-card-info"><strong>🕐</strong><span>' + (time || 'Time TBA') + '</span></div>';
  html += '<div class="event-card-info"><strong>📍</strong><span>' + (event.location || 'Location TBA') + '</span></div>';
  html += '<div class="event-card-footer">';
  html += '  <span class="event-tag">' + (event.tag || 'Email Import') + '</span>';
  html += '  <div class="card-actions">';
  html += '    <button class="show-more-btn">Details</button>';
  html += '    <button class="add-to-calendar-btn">+ Add</button>';
  html += '  </div>';
  html += '</div>';

  card.innerHTML = html;

  // Add click handlers to the buttons
  const detailsButton = card.querySelector('.show-more-btn');
  detailsButton.onclick = function() {
    showEmailEventDetails(event);
  };

  const addButton = card.querySelector('.add-to-calendar-btn');
  addButton.onclick = function() {
    addEmailEventToCalendar(event);
  };

  return card;
}

// Show email event details in modal
function showEmailEventDetails(event) {
  const detailModal = document.getElementById('detail-modal');

  document.getElementById('detail-title').textContent = event.summary || 'Untitled Event';
  document.getElementById('detail-date').textContent = event.start_date || 'TBA';

  // Set time value
  if (event.start_time === "12:00 AM" && event.end_time === "11:59 PM") {
    document.getElementById('detail-time').textContent = "All Day";
  } else {
    document.getElementById('detail-time').textContent = (event.start_time || '') + ' - ' + (event.end_time || '');
  }

  document.getElementById('detail-location').textContent = event.location || 'TBA';
  document.getElementById('detail-tag').textContent = event.tag || 'Email Import';
  document.getElementById('detail-description').textContent = event.description || 'No description available.';

  // Hide the event link for email events
  const linkElement = document.getElementById('detail-link');
  linkElement.style.display = 'none';

  // Show the modal
  detailModal.style.display = 'flex';
}

// Add email event to Google Calendar
async function addEmailEventToCalendar(event) {
  // Check if user is connected to Google Calendar
  if (!window.calendarAPI || !window.calendarAPI.isConnected()) {
    showToast('Not Connected', 'Please connect your Google Calendar first!', 'warning');
    return;
  }

  try {
    const eventData = {
      summary: event.summary || 'Untitled Event',
      location: event.location || '',
      description: event.description || '',
      start: {
        dateTime: event.start,
        timeZone: 'America/Chicago'
      },
      end: {
        dateTime: event.end,
        timeZone: 'America/Chicago'
      }
    };

    const response = await window.calendarAPI.addEvent(eventData);
    if (response) {
      showToast('Event Added', `"${event.summary}" was added to your Google Calendar`, 'success');
    } else {
      showToast('Failed', 'Could not add event to calendar', 'error');
    }
  } catch (error) {
    console.error('Error adding event to calendar:', error);
    showToast('Error', 'Failed to add event to calendar. Please try again.', 'error');
  }
}

// Clear email events
document.addEventListener("DOMContentLoaded", () => {
  const clearEmailEventsBtn = document.getElementById("clear-email-events");
  if (clearEmailEventsBtn) {
    clearEmailEventsBtn.addEventListener("click", () => {
      const emailEventsSection = document.getElementById("email-events-section");
      const emailEventsContainer = document.getElementById("email-events");

      emailEventsContainer.innerHTML = "";
      emailEventsSection.style.display = "none";
    });
  }
});