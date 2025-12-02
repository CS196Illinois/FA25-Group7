// ** CO-AUTHORED BY CLAUDE CODE ** //

// Initialize Firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
apiKey: "AIzaSyAKfE_dl9zp5U_BVaqOmsdbjKjb-2KOlFA",
authDomain: "eventflowdatabase.firebaseapp.com",
databaseURL: "https://eventflowdatabase-default-rtdb.firebaseio.com",
projectId: "eventflowdatabase",
storageBucket: "eventflowdatabase.firebasestorage.app",
messagingSenderId: "611561258590",
appId: "1:611561258590:web:16a4d352f06bdbbfad3ecf",
measurementId: "G-0C45LS13MN"
};

  // Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Wait for the page to fully load before running our code
document.addEventListener("DOMContentLoaded", function() {

  // Get references to HTML elements we'll use
  const browseContainer = document.getElementById("browse-events");
  const searchInput = document.getElementById("search-events");
  const categorySelect = document.getElementById("filter-category");
  const detailModal = document.getElementById("detail-modal");
  const closeButton = document.getElementById("close-detail");

  // Store all events in a simple array
  let allEvents = [];

  // ========== STEP 1: Load Events ==========
  // Convert the events object from the server into an array
  async function loadEvents() {
    try {
        // Fetch events from the /events endpoint
        const eventsRef = ref(db, "scraped_events");
        const snapshot = await get(eventsRef);
        
        let eventsData = null;
        if (snapshot.exists()) {
            eventsData =  snapshot.val();
        }

        // Check if we got data back
        if (!eventsData || Object.keys(eventsData).length === 0) {
            console.log('No events found');
            browseContainer.innerHTML = '<p class="no-events-text">No events available</p>';
            return;
        }

        // Loop through each event and add it to our array
        for (let id in eventsData) {
            let event = eventsData[id];
            event.id = id; // Add the ID to the event

            // Convert ISO datetime format to display format
            event = parseEventData(event);

            // Skip events that already happened
            if (isEventInPast(event)) {
            continue;
            }

            allEvents.push(event);
        }

        // Sort events by date and time
        sortEventsByTime();

        // Now that we have all events, set up the page
        setupCategories();
        displayEvents(allEvents);
    } catch (error) {
        console.error('Error loading events:', error);
        browseContainer.innerHTML = '<p style="text-align: center; color: #888;">Error loading events</p>';
    }
  }

  // ========== Parse Event Data ==========
  // Convert scraper format to display format
  function parseEventData(event) {
    // Parse ISO datetime strings (e.g., "2025-11-30T14:00:00-06:00")
    if (event.start && event.start.includes('T')) {
      const startDate = new Date(event.start);
      event.start_date = formatDate(startDate);
      event.start_time = formatTime(startDate);
    }

    if (event.end && event.end.includes('T')) {
      const endDate = new Date(event.end);
      event.end_date = formatDate(endDate);
      event.end_time = formatTime(endDate);
    }

    return event;
  }

  // ========== Format Date Helper ==========
  function formatDate(date) {
    // Returns "Month Day, Year" format (e.g., "November 30, 2025")
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  // ========== Format Time Helper ==========
  function formatTime(date) {
    // Returns "HH:MM AM/PM" format
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    return `${hours}:${minutes} ${ampm}`;
  }

  // ========== Sort Events by Date/Time ==========
  function sortEventsByTime() {
    // Simple bubble sort to order events by date and time
    for (let i = 0; i < allEvents.length; i++) {
      for (let j = 0; j < allEvents.length - 1 - i; j++) {
        let event1 = allEvents[j];
        let event2 = allEvents[j + 1];

        // Compare dates and times
        let datetime1 = getEventDateTime(event1);
        let datetime2 = getEventDateTime(event2);

        // If event1 should come after event2, swap them
        if (datetime1 > datetime2) {
          allEvents[j] = event2;
          allEvents[j + 1] = event1;
        }
      }
    }
  }

  // ========== Get Event Date/Time for Comparison ==========
  function getEventDateTime(event) {
    // If no date, put it at the end
    if (!event.start_date || event.start_date === 'Date TBA') {
      return new Date('9999-12-31'); // Far future date
    }

    // Combine date and time into a full datetime string
    let dateStr = event.start_date;
    let timeStr = event.start_time || '00:00';

    // Create a Date object for comparison
    let datetime = new Date(dateStr + ' ' + timeStr);

    // If invalid date, put at end
    if (isNaN(datetime.getTime())) {
      return new Date('9999-12-31');
    }

    return datetime;
  }

  // ========== Check if Event is in the Past ==========
  function isEventInPast(event) {
    // Get today's date at midnight
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get event date
    let eventDate = getEventDateTime(event);

    // Return true if event is before today
    return eventDate < today;
  }

  // ========== STEP 2: Setup Category Filter ==========
  // Find all unique categories and add them to the dropdown
  function setupCategories() {
    let categories = []; // Empty list to store unique categories

    // Go through each event
    for (let i = 0; i < allEvents.length; i++) {
      let tag = allEvents[i].tag;

      // Only add if category exists and isn't already in our list
      if (tag && !categories.includes(tag)) {
        categories.push(tag);
      }
    }

    // Sort categories alphabetically
    categories.sort();

    // Add each category to the dropdown
    for (let i = 0; i < categories.length; i++) {
      let option = document.createElement('option');
      option.value = categories[i];
      option.textContent = categories[i];
      categorySelect.appendChild(option);
    }
  }

  // ========== STEP 3: Display Events ==========
  // Show events as cards on the page
  function displayEvents(events) {
    // Clear any existing cards
    browseContainer.innerHTML = '';

    // If no events, show a message
    if (events.length === 0) {
      browseContainer.innerHTML = '<p class="no-events-text">No events found</p>';
      return;
    }

    // Create a card for each event
    for (let i = 0; i < events.length; i++) {
      let card = createEventCard(events[i]);
      browseContainer.appendChild(card);
    }
  }

  // ========== STEP 4: Create a Single Event Card ==========
  function createEventCard(event) {
    // Create the card container
    let card = document.createElement('div');
    card.className = 'event-card-browse';

    // Set time value to 'All Day' if the event lasts the whole day; else make it the start time
    let time = event.start_time
    if (event.start_time == "12:00 AM" && event.end_time == "11:59 PM") {
        time = "All Day"
    }

    // Build the HTML for the card
    let html = '<div class="event-card-title">' + (event.summary || 'Untitled Event') + '</div>';
    html += '<div class="event-card-info"><strong>📅</strong><span>' + (event.start_date || 'Date TBA') + '</span></div>';
    html += '<div class="event-card-info"><strong>🕐</strong><span>' + (time || 'Time TBA') + '</span></div>';
    html += '<div class="event-card-info"><strong>📍</strong><span>' + (event.location || 'Location TBA') + '</span></div>';
    html += '<div class="event-card-footer">';
    html += '  <span class="event-tag">' + (event.tag || 'General') + '</span>';
    html += '  <div class="card-actions">';
    html += '    <button class="show-more-btn">Details</button>';
    html += '    <button class="add-to-calendar-btn">+ Add</button>';
    html += '  </div>';
    html += '</div>';

    card.innerHTML = html;

    // Add click handlers to the buttons
    let detailsButton = card.querySelector('.show-more-btn');
    detailsButton.onclick = function() {
      showEventDetails(event);
    };

    let addButton = card.querySelector('.add-to-calendar-btn');
    addButton.onclick = function() {
      addToCalendar(event);
    };

    return card;
  }

  // ========== STEP 5: Show Event Details in Modal ==========
  function showEventDetails(event) {
    // Fill in the modal with event information
    document.getElementById('detail-title').textContent = event.summary || 'Untitled Event';
    document.getElementById('detail-date').textContent = event.start_date || 'TBA';

    // Set time value to 'All Day' if the event lasts the whole day; else make it time listed in the event data
    if (event.start_time == "12:00 AM" && event.end_time == "11:59 PM") {
        document.getElementById('detail-time').textContent = "All Day";
    } else {
        document.getElementById('detail-time').textContent = (event.start_time || '') + ' - ' + (event.end_time || '');
    }

    document.getElementById('detail-location').textContent = event.location || 'TBA';
    document.getElementById('detail-tag').textContent = event.tag || 'General';
    document.getElementById('detail-description').textContent = event.description || 'No description available.';

    // Set the event link if it exists
    let linkElement = document.getElementById('detail-link');
    if (event.htmlLink) {
      linkElement.href = event.htmlLink;
      linkElement.style.display = 'inline-block';
    } else {
      linkElement.style.display = 'none';
    }

    // Show the modal
    detailModal.style.display = 'flex';
  }

  // ========== STEP 6: Add to Calendar ==========
  async function addToCalendar(event) {
    // Check if user is connected to Google Calendar
    if (!window.calendarAPI || !window.calendarAPI.isConnected()) {
      showToast('Not Connected', 'Please connect your Google Calendar first!', 'warning');
      return;
    }

    try {
      // Prepare event data for Google Calendar format
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

      // Call the Flask backend to add event
      const response = await window.calendarAPI.addEvent(eventData)
      if (response) {
        showToast('Event Added', `"${event.summary}" was added to your Google Calendar`, 'success');

        // Refresh the calendar iframes to show the new event
        refreshCalendars();
      } else {
        showToast('Failed', 'Could not add event to calendar', 'error');
      }

    } catch (error) {
      console.error('Error adding event to calendar:', error);
      showToast('Error', 'Failed to add event to calendar. Please try again.', 'error');
    }
  }

  // ========== Refresh Calendar Iframes ==========
  function refreshCalendars() {
    // Refresh main calendar iframe
    const mainIframe = document.getElementById('calendar-iframe');
    if (mainIframe && mainIframe.src) {
      mainIframe.src = mainIframe.src; // Force reload by resetting src
    }

    // Refresh today's agenda iframe
    const agendaIframe = document.getElementById('today-agenda-iframe');
    if (agendaIframe && agendaIframe.src) {
      agendaIframe.src = agendaIframe.src; // Force reload by resetting src
    }

    console.log('📅 Calendars refreshed');
  }

  // ========== STEP 7: Search Function ==========
  // Filter events based on search text
  function searchEvents() {
    let searchText = searchInput.value.toLowerCase();
    let selectedCategory = categorySelect.value;
    let filtered = [];

    // Go through all events
    for (let i = 0; i < allEvents.length; i++) {
      let event = allEvents[i];

      // Check if event matches search text
      let matchesSearch = false;
      if (searchText === '') {
        matchesSearch = true; // Empty search matches everything
      } else if (event.summary && event.summary.toLowerCase().includes(searchText)) {
        matchesSearch = true;
      } else if (event.description && event.description.toLowerCase().includes(searchText)) {
        matchesSearch = true;
      } else if (event.location && event.location.toLowerCase().includes(searchText)) {
        matchesSearch = true;
      }

      // Check if event matches selected category
      let matchesCategory = false;
      if (selectedCategory === 'all') {
        matchesCategory = true;
      } else if (event.tag === selectedCategory) {
        matchesCategory = true;
      }

      // If both match, add to filtered list
      if (matchesSearch && matchesCategory) {
        filtered.push(event);
      }
    }

    // Display the filtered events
    displayEvents(filtered);
  }

  // ========== STEP 8: Event Listeners ==========
  // When user types in search box
  searchInput.addEventListener('input', searchEvents);

  // When user changes category dropdown
  categorySelect.addEventListener('change', searchEvents);

  // When user clicks X to close modal
  closeButton.addEventListener('click', function() {
    detailModal.style.display = 'none';
  });

  // When user clicks outside modal, close it
  detailModal.addEventListener('click', function(event) {
    if (event.target === detailModal) {
      detailModal.style.display = 'none';
    }
  });

  // ========== START THE APP ==========
  loadEvents();
});