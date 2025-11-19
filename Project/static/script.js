document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const eventsList = document.getElementById("events-list");
  const upcoming = document.getElementById("upcoming-events");
  const modal = document.getElementById("event-modal");

  
  document.getElementById("add-event").addEventListener("click", () => {
    modal.style.display = "flex";
  });

  document.getElementById("close-modal").addEventListener("click", () => {
    modal.style.display = "none";
  });

  document.getElementById("save-event").addEventListener("click", async () => {
    const title = document.getElementById("event-title").value;
    const datetime = document.getElementById("event-date").value;
    const location = document.getElementById("event-location").value;

    if (!title || !datetime) return alert("Please fill all fields.");

    const event = {
      title,
      date: datetime.split("T")[0],
      time: new Date(datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      location,
    };

    // To add to Google Calendar, we'll use the Google Calendar API
    // For now, we'll open Google Calendar with pre-filled event data
    const startDate = new Date(datetime);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&location=${encodeURIComponent(location)}`;
    
    window.open(googleCalendarUrl, '_blank');
    
    modal.style.display = "none";
  });

  // Helper function to format date for Google Calendar URL
  function formatGoogleDate(date) {
    return date.toISOString().replace(/-|:|\.\d+/g, '');
  }
});