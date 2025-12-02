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

  // Add from Email button (placeholder)
  const addEmailBtn = document.getElementById("add-email");
  if (addEmailBtn) {
    addEmailBtn.addEventListener("click", () => {
      alert("This feature is coming soon! It will scan your emails for event invitations.");
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
    alert("Please enter an event title.");
    return;
  }

  if (!datetime) {
    alert("Please select a date and time.");
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
      
      alert("✅ Event added to your Google Calendar!");
      
      // Refresh the events display
      if (typeof loadUserEvents === 'function') {
        await loadUserEvents();
      }
      
      // Close modal and clear form
      document.getElementById("event-modal").style.display = "none";
      clearEventForm();
      
    } catch (error) {
      console.error("Error adding event:", error);
      alert("Failed to add event. Please try again.");
    }
  } else {
    // Not connected - open Google Calendar with pre-filled data
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(description)}`;
    
    window.open(googleCalendarUrl, '_blank');
    
    alert("Opening Google Calendar to add your event. Please connect your calendar for automatic syncing!");
    
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