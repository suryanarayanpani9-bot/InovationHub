const inputBox = document.getElementById("inputBox");
const bulkInput = document.getElementById("bulkInput");
const addManyBtn = document.getElementById("addManyBtn");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const todoMeta = document.getElementById("todoMeta");
const appRoot = document.querySelector(".to-do-app");

const STORAGE_KEY = "todo_app_tasks_v2";
const MAX_TASK_LENGTH = 120;

let tasks = [];
let currentFilter = "all";

function createFilterBar() {
    const bar = document.createElement("div");
    bar.className = "filters";
    bar.innerHTML = `
        <button class="filter-btn active" data-filter="all" type="button">All</button>
        <button class="filter-btn" data-filter="active" type="button">Active</button>
        <button class="filter-btn" data-filter="completed" type="button">Completed</button>
    `;

    bar.addEventListener("click", (event) => {
        const btn = event.target.closest(".filter-btn");
        if (!btn) return;

        currentFilter = btn.dataset.filter;
        for (const button of bar.querySelectorAll(".filter-btn")) {
            button.classList.toggle("active", button === btn);
        }
        renderTasks();
    });

    appRoot.insertBefore(bar, taskList);
}

function loadTasks() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        tasks = stored ? JSON.parse(stored) : [];
    } catch {
        tasks = [];
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function sanitizeText(value) {
    return value.trim().replace(/\s+/g, " ").slice(0, MAX_TASK_LENGTH);
}

function normalize(value) {
    return value.toLowerCase();
}

function generateId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function filteredTasks() {
    if (currentFilter === "active") {
        return tasks.filter((task) => !task.completed);
    }
    if (currentFilter === "completed") {
        return tasks.filter((task) => task.completed);
    }
    return tasks;
}

function updateMeta() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const active = total - completed;

    todoMeta.innerHTML = `
        <span>${active} active | ${completed} completed | ${total} total</span>
        <button id="clearCompletedBtn" class="meta-btn" type="button">Clear Completed</button>
    `;

    const clearBtn = document.getElementById("clearCompletedBtn");
    clearBtn.disabled = completed === 0;
    clearBtn.style.opacity = completed === 0 ? "0.5" : "1";
    clearBtn.style.pointerEvents = completed === 0 ? "none" : "auto";
}

function createTaskElement(task) {
    const li = document.createElement("li");
    li.className = `task-item${task.completed ? " completed" : ""} pop-in`;
    li.dataset.id = task.id;

    li.innerHTML = `
        <button class="task-check" type="button" aria-label="Toggle task"></button>
        <span class="task-text"></span>
        <div class="task-actions">
            <button class="task-btn edit-btn" type="button" aria-label="Edit task">Edit</button>
            <button class="task-btn delete-btn" type="button" aria-label="Delete task">Del</button>
        </div>
    `;

    li.querySelector(".task-text").textContent = task.text;

    requestAnimationFrame(() => {
        li.classList.remove("pop-in");
    });

    return li;
}

function renderTasks() {
    taskList.innerHTML = "";
    const view = filteredTasks();

    if (view.length === 0) {
        taskList.innerHTML = `<li class="empty-state">No tasks here. Add one above.</li>`;
        updateMeta();
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const task of view) {
        fragment.appendChild(createTaskElement(task));
    }

    taskList.appendChild(fragment);
    updateMeta();
}

function addTask() {
    const text = sanitizeText(inputBox.value);
    if (!text) {
        inputBox.focus();
        return;
    }

    const duplicate = tasks.some((task) => normalize(task.text) === normalize(text));
    if (duplicate) {
        inputBox.select();
        return;
    }

    tasks.unshift({
        id: generateId(),
        text,
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    inputBox.value = "";
    saveTasks();
    renderTasks();
}

function addManyTasks() {
    const raw = bulkInput.value || "";
    const parts = raw.split(/\r?\n|,/);
    const normalizedExisting = new Set(tasks.map((task) => normalize(task.text)));
    const newItems = [];

    for (const part of parts) {
        const text = sanitizeText(part);
        if (!text) continue;

        const key = normalize(text);
        if (normalizedExisting.has(key)) continue;

        normalizedExisting.add(key);
        newItems.push({
            id: generateId(),
            text,
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    }

    if (newItems.length === 0) {
        bulkInput.focus();
        return;
    }

    tasks = [...newItems.reverse(), ...tasks];
    bulkInput.value = "";
    saveTasks();
    renderTasks();
}

function toggleTask(id) {
    tasks = tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed, updatedAt: Date.now() } : task
    );
    saveTasks();
    renderTasks();
}

function deleteTask(id) {
    const li = taskList.querySelector(`[data-id="${id}"]`);
    if (li) {
        li.classList.add("fade-out");
        setTimeout(() => {
            tasks = tasks.filter((task) => task.id !== id);
            saveTasks();
            renderTasks();
        }, 180);
        return;
    }

    tasks = tasks.filter((task) => task.id !== id);
    saveTasks();
    renderTasks();
}

function editTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const next = prompt("Edit task:", task.text);
    if (next === null) return;

    const text = sanitizeText(next);
    if (!text) return;

    task.text = text;
    task.updatedAt = Date.now();
    saveTasks();
    renderTasks();
}

function clearCompleted() {
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    renderTasks();
}

taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask();
});

addManyBtn.addEventListener("click", addManyTasks);
bulkInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        addManyTasks();
    }
});

taskList.addEventListener("click", (event) => {
    const li = event.target.closest(".task-item");
    if (!li) return;

    const id = li.dataset.id;

    if (event.target.closest(".task-check")) {
        toggleTask(id);
        return;
    }
    if (event.target.closest(".delete-btn")) {
        deleteTask(id);
        return;
    }
    if (event.target.closest(".edit-btn")) {
        editTask(id);
    }
});

todoMeta.addEventListener("click", (event) => {
    if (event.target.id === "clearCompletedBtn") {
        clearCompleted();
    }
});

createFilterBar();
loadTasks();
renderTasks();

window.addTask = addTask;
window.addManyTasks = addManyTasks;
