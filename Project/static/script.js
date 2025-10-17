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
    const monthName = today.toLocaleString("default", { month: "long" });
    monthYear.textContent = `${monthName} ${currentYear}`;

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
      if (day === today.getDate() && currentMonth === today.getMonth())
        cell.classList.add("active");
      grid.appendChild(cell);
    }
  }

  async function loadEvents() {
    const res = await fetch("/events");
    const events = await res.json();
    eventsList.innerHTML = "";
    upcoming.innerHTML = "";
    events.forEach(e => {
      const div = document.createElement("div");
      div.classList.add("event-card");
      div.innerHTML = `<b>${e.title}</b><br>${e.time}<br>${e.location}`;
      eventsList.appendChild(div);

      const card = document.createElement("div");
      card.classList.add("upcoming-card");
      card.classList.add(e.color || "green");
      card.innerHTML = `<h4>${e.title}</h4><p>${e.date}</p><p>${e.time}</p>`;
      upcoming.appendChild(card);
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

    await fetch("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });

    modal.style.display = "none";
    loadEvents();
  });

  renderCalendar();
  loadEvents();
});