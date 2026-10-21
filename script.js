
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskCategory = document.getElementById("taskCategory");
const taskDue = document.getElementById("taskDue");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");
const searchInput = document.getElementById("searchInput");

const STORAGE_KEY = "taskflow_tasks_v1";

let tasks = loadTasks();
let editingId = null;
let activeCategory = "All";
let activeStatus = "All";
let searchTerm = "";

const categoryDescriptions = {
  All: "Everything you need to get done.",
  Personal: "Your personal goals and everyday tasks.",
  Study: "Assignments, revision, and learning goals.",
  Work: "Your work and project tasks.",
  Other: "Everything else on your list."
};

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(task =>
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean" &&
      ["Personal", "Study", "Work", "Other"].includes(task.category)
    ) : [];
  } catch (error) {
    console.error("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    alert("Your tasks could not be saved. Check your browser storage.");
    console.error("Could not save tasks:", error);
  }
}

function createId() {
  return window.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function updateTodayLabel() {
  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
}

function formatDueDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function isOverdue(task) {
  if (!task.due || task.completed) return false;

  const dueDate = new Date(task.due);
  return !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now();
}

function updateStats() {
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;

  document.getElementById("totalCount").textContent = tasks.length;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("allListCount").textContent = tasks.length;
}

function getVisibleTasks() {
  return tasks
    .filter(task =>
      activeCategory === "All" || task.category === activeCategory
    )
    .filter(task =>
      activeStatus === "All" ||
      (activeStatus === "Pending" && !task.completed) ||
      (activeStatus === "Completed" && task.completed)
    )
    .filter(task =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }

      if (a.due && b.due) {
        return new Date(a.due) - new Date(b.due);
      }

      if (a.due) return -1;
      if (b.due) return 1;

      return b.createdAt - a.createdAt;
    });
}

function renderTasks() {
  updateStats();

  document.getElementById("listHeading").textContent =
    activeCategory === "All" ? "All tasks" : activeCategory;

  document.getElementById("listDescription").textContent =
    categoryDescriptions[activeCategory];

  document.querySelectorAll(".list-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === activeCategory
    );
  });

  document.querySelectorAll(".filter-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.status === activeStatus
    );
  });

  const visibleTasks = getVisibleTasks();

  document.getElementById("visibleCount").textContent =
    `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"}`;

  taskList.replaceChildren();
  emptyState.classList.toggle("hidden", visibleTasks.length > 0);

  visibleTasks.forEach(task => {
    taskList.appendChild(createTaskCard(task));
  });
}

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.completed ? " completed" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-check";
  checkbox.checked = task.completed;
  checkbox.setAttribute("aria-label", `Complete ${task.title}`);
  checkbox.addEventListener("change", () => toggleTask(task.id));

  const content = document.createElement("div");
  content.className = "task-content";

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const category = document.createElement("span");
  category.className = "category-tag";
  category.textContent = task.category;
  meta.appendChild(category);

  if (task.due) {
    const due = document.createElement("span");
    due.className = "due-date";
    due.textContent = `◷ ${formatDueDate(task.due)}`;

    if (isOverdue(task)) {
      due.classList.add("overdue");
      due.textContent += " · Overdue";
    }

    meta.appendChild(due);
  }

  if (task.completed) {
    const status = document.createElement("span");
    status.textContent = "✓ Completed";
    meta.appendChild(status);
  }

  content.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "icon-button";
  editButton.textContent = "✎";
  editButton.title = "Edit task";
  editButton.setAttribute("aria-label", `Edit ${task.title}`);
  editButton.addEventListener("click", () => editTask(task.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "icon-button delete";
  deleteButton.textContent = "×";
  deleteButton.title = "Delete task";
  deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
  deleteButton.addEventListener("click", () => deleteTask(task.id));

  actions.append(editButton, deleteButton);
  card.append(checkbox, content, actions);

  return card;
}

taskForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = taskTitle.value.trim();

  if (!title) {
    taskTitle.focus();
    return;
  }

  const category = taskCategory.value;
  const due = taskDue.value;

  if (editingId) {
    tasks = tasks.map(task =>
      task.id === editingId
        ? { ...task, title, category, due }
        : task
    );
  } else {
    tasks.push({
      id: createId(),
      title,
      category,
      due,
      completed: false,
      createdAt: Date.now()
    });
  }

  saveTasks();
  resetForm();
  renderTasks();
});

function editTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  editingId = id;
  taskTitle.value = task.title;
  taskCategory.value = task.category;
  taskDue.value = task.due || "";

  submitButton.innerHTML = "<span>✓</span> Save changes";
  cancelEdit.classList.remove("hidden");

  taskTitle.focus();
  document.getElementById("taskForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function resetForm() {
  taskForm.reset();
  editingId = null;
  submitButton.innerHTML = "<span>＋</span> Add task";
  cancelEdit.classList.add("hidden");
}

cancelEdit.addEventListener("click", resetForm);

function toggleTask(id) {
  tasks = tasks.map(task =>
    task.id === id
      ? { ...task, completed: !task.completed }
      : task
  );

  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  if (!confirm(`Delete "${task.title}"?`)) return;

  tasks = tasks.filter(item => item.id !== id);

  if (editingId === id) resetForm();

  saveTasks();
  renderTasks();
}

document.querySelectorAll(".list-button").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    renderTasks();
  });
});

document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;
    renderTasks();
  });
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  renderTasks();
});

updateTodayLabel();
renderTasks();
