import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBeElewrekuFkMMMV5n_4gKUs99rOrdBLw",
    authDomain: "mc-forum-main-hub.firebaseapp.com",
    projectId: "mc-forum-main-hub",
    storageBucket: "mc-forum-main-hub.firebasestorage.app",
    messagingSenderId: "838366816720",
    appId: "1:838366816720:web:7fe8f2a460b513f0ef31d5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const OWNER_EMAIL = "elonrebello11@gmail.com";
let currentUser = null;
let currentRoom = "global";
let unsubscribeChat = null;

// --- Built-in Blacklist for Swear Words & Toxicity ---
const BAD_WORDS = ["badword1", "badword2", "toxicword", "spamword"]; 

function containsSwearWords(text) {
    const lowerText = text.toLowerCase();
    return BAD_WORDS.some(word => lowerText.includes(word));
}

// --- DOM Elements ---
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userDisplay = document.getElementById("userDisplay");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
const navItems = document.querySelectorAll(".nav-links .nav-item");
const viewSections = document.querySelectorAll(".view-section");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const messageContainer = document.getElementById("messageContainer");
const roomChips = document.querySelectorAll(".room-chip");
const popupModal = document.getElementById("popupModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

function showPopup(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    popupModal.style.display = "flex";
}
modalCloseBtn.addEventListener("click", () => popupModal.style.display = "none");

// --- UI Navigation ---
sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

navItems.forEach(item => {
    item.addEventListener("click", (e) => {
        const targetId = item.dataset.target;
        if (targetId === "devView" && (!currentUser || currentUser.email !== OWNER_EMAIL)) {
            e.preventDefault();
            showPopup("Access Denied", "Developer Menu is restricted to the network owner.");
            return;
        }

        navItems.forEach(nav => nav.classList.remove("active"));
        viewSections.forEach(sec => sec.classList.remove("active"));
        item.classList.add("active");
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add("active");
    });
});

// --- Theme & Blur Controls ---
document.getElementById("themeSelect").addEventListener("change", (e) => document.body.setAttribute("data-theme", e.target.value));
document.getElementById("blurSlider").addEventListener("input", (e) => document.documentElement.style.setProperty('--blur-strength', `blur(${e.target.value}px)`));

// --- Klippy GIF Drawer ---
const klippyTriggerBtn = document.getElementById("klippyTriggerBtn");
const klippyModal = document.getElementById("klippyModal");
const closeKlippyBtn = document.getElementById("closeKlippyBtn");

klippyTriggerBtn.addEventListener("click", () => klippyModal.style.display = klippyModal.style.display === "flex" ? "none" : "flex");
closeKlippyBtn.addEventListener("click", () => klippyModal.style.display = "none");

document.querySelectorAll(".gif-item").forEach(img => {
    img.addEventListener("click", async () => {
        klippyModal.style.display = "none";
        await sendChatMessage(`<img src="${img.src}" alt="GIF" style="max-width:200px; border-radius:8px;">`);
    });
});

// --- Authentication (Popup Mode for Netlify) ---
loginBtn.addEventListener("click", async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        if (result && result.user) {
            await addDoc(collection(db, "users"), {
                uid: result.user.uid,
                displayName: result.user.displayName,
                email: result.user.email,
                photoURL: result.user.photoURL || ""
            }).catch(() => {});
        }
    } catch (err) {
        showPopup("Login Error", err.message);
    }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const devAuthStatus = document.getElementById("devAuthStatus");
    const devNavTrigger = document.getElementById("devNavTrigger");
    const navAvatarImg = document.getElementById("navAvatarImg");
    const profileAvatarImg = document.getElementById("profileAvatarImg");
    const newsUploadContainer = document.getElementById("newsUploadContainer");

    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "block";
        userDisplay.style.display = "block";
        userDisplay.textContent = `Hi, ${user.displayName}`;
        if (navAvatarImg && user.photoURL) {
            navAvatarImg.src = user.photoURL;
            navAvatarImg.style.display = "block";
        }
        if (profileAvatarImg && user.photoURL) profileAvatarImg.src = user.photoURL;
        document.getElementById("profileAvatarName").textContent = user.displayName;
        document.getElementById("profileRole").textContent = user.email === OWNER_EMAIL ? "Network Owner" : "Verified Member";

        if (user.email === OWNER_EMAIL) {
            if (devNavTrigger) devNavTrigger.style.display = "flex";
            if (newsUploadContainer) newsUploadContainer.style.display = "block";
        }
    } else {
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
        userDisplay.style.display = "none";
        if (navAvatarImg) navAvatarImg.style.display = "none";
        if (devNavTrigger) devNavTrigger.style.display = "none";
        if (newsUploadContainer) newsUploadContainer.style.display = "none";
    }
    loadMessages(currentRoom);
    loadNewsFeed();
});

// --- Integrated Zone / Chat Rooms Handler ---
roomChips.forEach(chip => {
    chip.addEventListener("click", () => {
        roomChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentRoom = chip.dataset.room;
        loadMessages(currentRoom);
    });
});

function loadMessages(roomName) {
    if (unsubscribeChat) unsubscribeChat();
    const q = query(collection(db, `rooms/${roomName}/messages`), orderBy("timestamp", "asc"));
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messageContainer.innerHTML = `<p class='placeholder-text'>No messages in #${roomName} yet. Start the conversation!</p>`;
            return;
        }

        let html = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgId = docSnap.id;
            const isOwner = currentUser && currentUser.email === OWNER_EMAIL;
            const isAuthor = currentUser && data.uid === currentUser.uid;

            let actionsHTML = "";
            if (isAuthor || isOwner) {
                actionsHTML = `
                    <div class="message-actions">
                        ${isAuthor ? `<button class="msg-action-btn edit-btn" data-id="${msgId}"><i class="fa-solid fa-pen"></i></button>` : ""}
                        <button class="msg-action-btn delete delete-btn" data-id="${msgId}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }

            html += `
                <div class="message" id="msg-${msgId}">
                    <div class="message-header">
                        <span class="author">${escapeHTML(data.name || "Guest User")}</span>
                        ${actionsHTML}
                    </div>
                    <div class="text message-body">${data.text.includes("<img") ? data.text : escapeHTML(data.text)}</div>
                </div>
            `;
        });
        messageContainer.innerHTML = html;
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

messageContainer.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");

    if (deleteBtn) {
        try {
            await deleteDoc(doc(db, `rooms/${currentRoom}/messages`, deleteBtn.dataset.id));
        } catch (err) {
            showPopup("Error", "Could not delete message.");
        }
    }

    if (editBtn) {
        const msgId = editBtn.dataset.id;
        const currentText = document.querySelector(`#msg-${msgId} .message-body`).textContent;
        const newText = prompt("Edit your message:", currentText);
        if (newText && newText.trim() !== "") {
            if (containsSwearWords(newText)) {
                showPopup("Blocked", "Edited message contains blocked or inappropriate words.");
                return;
            }
            try {
                await updateDoc(doc(db, `rooms/${currentRoom}/messages`, msgId), { text: newText.trim() });
            } catch (err) {
                showPopup("Error", "Could not update message.");
            }
        }
    }
});

async function sendChatMessage(textContent) {
    if (containsSwearWords(textContent)) {
        showPopup("Message Blocked", "Your message was blocked and reported because it contains restricted language.");
        return;
    }

    const senderName = currentUser ? currentUser.displayName : "Guest User";
    const senderUid = currentUser ? currentUser.uid : "guest-session";

    try {
        await addDoc(collection(db, `rooms/${currentRoom}/messages`), {
            text: textContent,
            name: senderName,
            uid: senderUid,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Send error:", err);
    }
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = "";
    await sendChatMessage(text);
});

// --- News Feed ---
document.getElementById("publishNewsBtn")?.addEventListener("click", async () => {
    if (!currentUser || currentUser.email !== OWNER_EMAIL) return;
    const title = document.getElementById("newsTitleInput").value.trim();
    const content = document.getElementById("newsContentInput").value.trim();
    if (!title || !content) return;

    try {
        await addDoc(collection(db, "newsFeed"), {
            title,
            content,
            author: currentUser.displayName,
            timestamp: serverTimestamp()
        });
        document.getElementById("newsTitleInput").value = "";
        document.getElementById("newsContentInput").value = "";
        showPopup("Success", "News bulletin published!");
        loadNewsFeed();
    } catch (err) {
        showPopup("Error", "Could not publish news.");
    }
});

async function loadNewsFeed() {
    const container = document.getElementById("newsListContainer");
    if (!container) return;
    container.innerHTML = "<p class='placeholder-text'>Loading news feed...</p>";

    try {
        const q = query(collection(db, "newsFeed"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        container.innerHTML = "";

        if (snapshot.empty) {
            container.innerHTML = "<p class='placeholder-text'>No official news bulletins yet.</p>";
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement("div");
            card.className = "settings-card";
            card.innerHTML = `
                <div>
                    <h4 style="color:var(--accent); margin-bottom:6px;">${escapeHTML(data.title)}</h4>
                    <p style="font-size:0.9rem; color:var(--text-main); margin-bottom:8px;">${escapeHTML(data.content)}</p>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Published by ${escapeHTML(data.author)}</span>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p class='placeholder-text'>Could not load news.</p>";
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
