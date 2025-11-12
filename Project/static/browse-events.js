// ** GENERATED USING CLAUDE CODE ** //

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
  function loadEvents() {
    // Check if events data exists
    if (typeof eventsData === 'undefined') {
      return;
    }

    // Loop through each event and add it to our array
    for (let id in eventsData) {
      let event = eventsData[id];
      event.id = id; // Add the ID to the event

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
      browseContainer.innerHTML = '<p style="text-align: center; color: #888;">No events found</p>';
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
    let html = '<div class="event-card-title">' + (event.title || 'Untitled Event') + '</div>';
    html += '<div class="event-card-info"><strong>📅</strong> ' + (event.start_date || 'Date TBA') + '</div>';
    html += '<div class="event-card-info"><strong>🕐</strong> ' + (time || 'Time TBA') + '</div>';
    html += '<div class="event-card-info"><strong>📍</strong> ' + (event.location || 'Location TBA') + '</div>';
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
    document.getElementById('detail-title').textContent = event.title || 'Untitled Event';
    document.getElementById('detail-date').textContent = event.start_date || 'TBA';

    // Set time value to 'All Day' if the event lasts the whole day; else make it time listed in the event data
    if (event.start_time == "12:00 AM" && event.end_time == "11:59 PM") {
        document.getElementById('detail-time').textContent = "All Day";
    } else {
        document.getElementById('detail-time').textContent = (event.start_time || '') + ' - ' + (event.end_time || '');
    }

    document.getElementById('detail-location').textContent = event.location || 'TBA';
    document.getElementById('detail-host').textContent = event.host || 'N/A';
    document.getElementById('detail-tag').textContent = event.tag || 'General';
    document.getElementById('detail-description').textContent = event.description || 'No description available.';

    // Set the event link if it exists
    let linkElement = document.getElementById('detail-link');
    if (event.event_link) {
      linkElement.href = event.event_link;
      linkElement.style.display = 'inline-block';
    } else {
      linkElement.style.display = 'none';
    }

    // Show the modal
    detailModal.style.display = 'flex';
  }

  // ========== STEP 6: Add to Calendar (TODO) ==========
  function addToCalendar(event) {
    alert('Add to Calendar - Coming Soon!\n\nEvent: ' + event.title);
    // TODO: Implement saving to user's calendar
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
      } else if (event.title && event.title.toLowerCase().includes(searchText)) {
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
