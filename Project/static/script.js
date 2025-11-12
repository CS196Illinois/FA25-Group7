document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const monthYear = document.getElementById("month-year");
  const grid = document.getElementById("calendar-grid");
  const eventsList = document.getElementById("events-list");
  const upcoming = document.getElementById("upcoming-events");
  const modal = document.getElementById("event-modal");

  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();

  function renderCalendar() {
    grid.innerHTML = "";
    const date = new Date(currentYear, currentMonth);
    const monthName = date.toLocaleString("default", { month: "long" });
    monthYear.textContent = `${monthName} ${currentYear}`;

    // Add day headers
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.forEach(day => {
      const header = document.createElement("div");
      header.textContent = day;
      header.style.fontWeight = "bold";
      header.style.textAlign = "center";
      grid.appendChild(header);
    });

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDay = firstDay.getDay();

    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement("div");
      grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cell = document.createElement("div");
      cell.textContent = day;
      if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear())
        cell.classList.add("active");
      grid.appendChild(cell);
    }
  }

  // Month navigation
  const prevButton = document.getElementById("prev-month");
  const nextButton = document.getElementById("next-month");

  if (prevButton) {
    prevButton.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

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

    // TODO: Put event data in user's google calendar

    modal.style.display = "none";
  });

  renderCalendar();
});