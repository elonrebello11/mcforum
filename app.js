import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const GEMINI_API_KEY = "YOUR_AI_STUDIO_API_KEY";
const OWNER_EMAIL = "elonrebello11@gmail.com";

let currentUser = null;
let currentRoom = "global";
let unsubscribeChat = null;

// --- DOM Cache Elements ---
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

// --- Modal Helper ---
function showPopup(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    popupModal.style.display = "flex";
}
modalCloseBtn.addEventListener("click", () => popupModal.style.display = "none");

// --- UI Navigation & Restricted Dev Access ---
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

// --- Settings & Customization Sliders / Selectors ---
document.getElementById("themeSelect").addEventListener("change", (e) => document.body.setAttribute("data-theme", e.target.value));
document.getElementById("fontSelect").addEventListener("change", (e) => document.documentElement.style.setProperty('--font-family', e.target.value));
document.getElementById("blurSlider").addEventListener("input", (e) => document.documentElement.style.setProperty('--blur-strength', `blur(${e.target.value}px)`));

// --- Klippy GIF Picker Toggle ---
const klippyTriggerBtn = document.getElementById("klippyTriggerBtn");
const klippyModal = document.getElementById("klippyModal");
const closeKlippyBtn = document.getElementById("closeKlippyBtn");

klippyTriggerBtn.addEventListener("click", () => klippyModal.style.display = klippyModal.style.display === "flex" ? "none" : "flex");
closeKlippyBtn.addEventListener("click", () => klippyModal.style.display = "none");

document.querySelectorAll(".gif-item").forEach(img => {
    img.addEventListener("click", async () => {
        const gifUrl = img.src;
        klippyModal.style.display = "none";
        await sendChatMessage(`<img src="${gifUrl}" alt="GIF" style="max-width:200px; border-radius:8px;">`);
    });
});

// --- Authentication State Management ---
loginBtn.addEventListener("click", () => signInWithRedirect(auth, provider));
logoutBtn.addEventListener("click", () => signOut(auth));

getRedirectResult(auth).then(async (result) => {
    if (result && result.user) {
        await addDoc(collection(db, "users"), {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL || ""
        }).catch(() => {});
    }
}).catch(console.error);

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const devAuthStatus = document.getElementById("devAuthStatus");
    const devNavTrigger = document.getElementById("devNavTrigger");
    const navAvatarImg = document.getElementById("navAvatarImg");
    const profileAvatarImg = document.getElementById("profileAvatarImg");
    const profileAvatarName = document.getElementById("profileAvatarName");
    const suggestionAuthWarning = document.getElementById("suggestionAuthWarning");
    const suggestionFormContainer = document.getElementById("suggestionFormContainer");
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
        if (profileAvatarName) profileAvatarName.textContent = user.displayName;
        document.getElementById("profileDisplayName").textContent = user.displayName;
        document.getElementById("profileEmail").textContent = user.email;
        document.getElementById("profileRole").textContent = user.email === OWNER_EMAIL ? "Network Owner" : "Verified Member";

        if (suggestionAuthWarning) suggestionAuthWarning.style.display = "none";
        if (suggestionFormContainer) suggestionFormContainer.style.display = "block";

        if (user.email === OWNER_EMAIL) {
            if (devNavTrigger) devNavTrigger.style.display = "flex";
            if (newsUploadContainer) newsUploadContainer.style.display = "block";
        }
    } else {
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
        userDisplay.style.display = "none";
        if (navAvatarImg) navAvatarImg.style.display = "none";
        if (suggestionAuthWarning) suggestionAuthWarning.style.display = "block";
        if (suggestionFormContainer) suggestionFormContainer.style.display = "none";
        if (devNavTrigger) devNavTrigger.style.display = "none";
        if (newsUploadContainer) newsUploadContainer.style.display = "none";
    }
    loadMessages(currentRoom);
    loadFriendRequests();
    loadNewsFeed();
});

// --- Chat Room Switching ---
roomChips.forEach(chip => {
    chip.addEventListener("click", () => {
        roomChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentRoom = chip.dataset.room;
        loadMessages(currentRoom);
    });
});

// --- Google AI Studio Moderation ---
async function moderateMessageText(text) {
    const aiModEnabled = document.getElementById("aiModToggle").checked;
    if (!aiModEnabled || !GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_AI_STUDIO_API_KEY") return true;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Analyze this chat message for extreme toxicity. Reply with ONLY "SAFE" or "BLOCKED".\n\nMessage: "${text}"`;
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "SAFE";
        return !resultText.includes("BLOCKED");
    } catch (err) {
        return true;
    }
}

// --- High-Performance Fast Message Loading with Event Delegation ---
function loadMessages(roomName) {
    if (unsubscribeChat) unsubscribeChat();
    const q = query(collection(db, `rooms/${roomName}/messages`), orderBy("timestamp", "asc"));
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messageContainer.innerHTML = "<p class='placeholder-text'>No messages here yet.</p>";
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
                        <span class="author">${escapeHTML(data.name || "Guest")}</span>
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

// Fast Event Delegation for Message Editing & Deletion
messageContainer.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");

    if (deleteBtn) {
        const msgId = deleteBtn.dataset.id;
        try {
            await deleteDoc(doc(db, `rooms/${currentRoom}/messages`, msgId));
        } catch (err) {
            showPopup("Error", "Could not delete message.");
        }
    }

    if (editBtn) {
        const msgId = editBtn.dataset.id;
        const msgEl = document.getElementById(`msg-${msgId}`);
        const bodyEl = msgEl.querySelector(".message-body");
        const currentText = bodyEl.textContent;

        const newText = prompt("Edit your message:", currentText);
        if (newText && newText.trim() !== "") {
            try {
                await updateDoc(doc(db, `rooms/${currentRoom}/messages`, msgId), { text: newText.trim() });
            } catch (err) {
                showPopup("Error", "Could not update message.");
            }
        }
    }
});

async function sendChatMessage(textContent) {
    const senderName = currentUser ? currentUser.displayName : "Guest User";
    const senderUid = currentUser ? currentUser.uid : "guest-session";

    const isClean = await moderateMessageText(textContent);
    if (!isClean) {
        showPopup("Blocked", "Message flagged as inappropriate by AI moderator.");
        return;
    }

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

// --- Search Tab Integration ---
document.getElementById("executeSearchBtn").addEventListener("click", async () => {
    const queryStr = document.getElementById("searchInput").value.trim().toLowerCase();
    const container = document.getElementById("searchResultsContainer");
    container.innerHTML = "<p class='placeholder-text'>Searching network...</p>";

    if (!queryStr) return;

    try {
        const snapshot = await getDocs(collection(db, `rooms/${currentRoom}/messages`));
        container.innerHTML = "";
        let foundCount = 0;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.text.toLowerCase().includes(queryStr)) {
                foundCount++;
                const card = document.createElement("div");
                card.className = "friend-card";
                card.innerHTML = `<div><strong>${escapeHTML(data.name)}</strong>: <p style="font-size:0.9rem; color:var(--text-muted);">${escapeHTML(data.text)}</p></div>`;
                container.appendChild(card);
            }
        });

        if (foundCount === 0) {
            container.innerHTML = "<p class='placeholder-text'>No matching messages found.</p>";
        }
    } catch (err) {
        container.innerHTML = "<p class='placeholder-text'>Search error occurred.</p>";
    }
});

// --- News Zone Uploads (Restricted to Owner) ---
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
            card.className = "friend-card";
            card.innerHTML = `
                <div>
                    <h4 style="color:var(--accent); margin-bottom:4px;">${escapeHTML(data.title)}</h4>
                    <p style="font-size:0.9rem; color:var(--text-main);">${escapeHTML(data.content)}</p>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Published by ${escapeHTML(data.author)}</span>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p class='placeholder-text'>Could not load news.</p>";
    }
}

// --- Friend Request System ---
document.getElementById("addFriendBtn").addEventListener("click", async () => {
    if (!currentUser) return showPopup("Required", "Sign in required.");
    const targetName = document.getElementById("friendEmailInput").value.trim();
    if (!targetName) return;

    try {
        await addDoc(collection(db, "friendRequests"), {
            senderUid: currentUser.uid,
            senderName: currentUser.displayName,
            recipientName: targetName,
            status: "Pending",
            timestamp: serverTimestamp()
        });
        showPopup("Sent", `Request sent to ${targetName}!`);
        document.getElementById("friendEmailInput").value = "";
        loadFriendRequests();
    } catch (err) {
        showPopup("Error", "Could not send request.");
    }
});

async function loadFriendRequests() {
    if (!currentUser) return;
    const list = document.getElementById("friendsList");
    list.innerHTML = "";
    try {
        const q = query(collection(db, "friendRequests"), where("senderUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            list.innerHTML = "<p class='placeholder-text'>No pending requests.</p>";
            return;
        }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const card = document.createElement("div");
            card.className = "friend-card";
            card.innerHTML = `<div><strong>To: ${escapeHTML(data.recipientName)}</strong></div><button class="danger-btn cancel-req" data-id="${docSnap.id}">Cancel</button>`;
            list.appendChild(card);
        });

        list.querySelectorAll(".cancel-req").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                await deleteDoc(doc(db, "friendRequests", e.target.dataset.id));
                loadFriendRequests();
            });
        });
    } catch (err) {}
}

// --- Suggestions System ---
document.getElementById("submitSuggestionBtn")?.addEventListener("click", async () => {
    if (!currentUser) return showPopup("Required", "Must be signed in.");
    const text = document.getElementById("suggestionInput").value.trim();
    if (!text) return;

    try {
        await addDoc(collection(db, "suggestions"), {
            text,
            author: currentUser.displayName,
            timestamp: serverTimestamp()
        });
        document.getElementById("suggestionInput").value = "";
        showPopup("Submitted", "Thank you for your suggestion!");
    } catch (err) {
        showPopup("Error", "Could not submit suggestion.");
    }
});

// --- Utility Escaper ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
