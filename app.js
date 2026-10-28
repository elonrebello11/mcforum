import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// PASTE YOUR GOOGLE AI STUDIO API KEY HERE:
const GEMINI_API_KEY = "YOUR_AI_STUDIO_API_KEY";

let currentUser = null;
let currentRoom = "global";
let unsubscribeChat = null;

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

// --- Modal Helper ---
function showPopup(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    popupModal.style.display = "flex";
}

modalCloseBtn.addEventListener("click", () => {
    popupModal.style.display = "none";
});

// --- UI Navigation & Toggle ---
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});

navItems.forEach(item => {
    item.addEventListener("click", () => {
        navItems.forEach(nav => nav.classList.remove("active"));
        viewSections.forEach(sec => sec.classList.remove("active"));
        
        item.classList.add("active");
        const targetView = document.getElementById(item.dataset.target);
        if (targetView) targetView.classList.add("active");
    });
});

// --- Authentication (Redirect flow for GitHub Pages stability) ---
loginBtn.addEventListener("click", async () => {
    try {
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
    }
});

logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

getRedirectResult(auth).then(async (result) => {
    if (result && result.user) {
        const user = result.user;
        await addDoc(collection(db, "users"), {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email
        }).catch(() => {});
    }
}).catch((error) => {
    console.error("Redirect error:", error);
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "block";
        userDisplay.style.display = "block";
        userDisplay.textContent = `Hi, ${user.displayName}`;
        loadMessages(currentRoom);
        loadFriendRequests();
    } else {
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
        userDisplay.style.display = "none";
        messageContainer.innerHTML = "<p class='placeholder-text'>Please sign in to chat.</p>";
    }
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

// --- Google AI Studio / Gemini Chat Moderation ---
async function moderateMessageText(text) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_AI_STUDIO_API_KEY") {
        return true; 
    }

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Analyze this chat message for extreme toxicity, hate speech, or harassment. Reply with ONLY "SAFE" if acceptable, or "BLOCKED" if toxic.\n\nMessage: "${text}"`;

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await res.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || "SAFE";
        return !resultText.includes("BLOCKED");
    } catch (err) {
        console.error("AI Moderation warning:", err);
        return true; 
    }
}

// --- Real-time Chat Sync & Moderation UI ---
function loadMessages(roomName) {
    if (unsubscribeChat) unsubscribeChat();

    const q = query(collection(db, `rooms/${roomName}/messages`), orderBy("timestamp", "asc"));
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        messageContainer.innerHTML = "";
        if (snapshot.empty) {
            messageContainer.innerHTML = "<p class='placeholder-text'>No messages here yet. Start the conversation!</p>";
            return;
        }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgId = docSnap.id;
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            
            const isAuthor = currentUser && data.uid === currentUser.uid;
            const isModerator = currentUser && (currentUser.email === "elonrebello11@gmail.com" || isAuthor);

            let deleteBtnHTML = "";
            if (isModerator) {
                deleteBtnHTML = `<button class="delete-msg-btn" data-id="${msgId}" title="Delete Message"><i class="fa-solid fa-trash"></i></button>`;
            }

            msgDiv.innerHTML = `
                <div class="message-header">
                    <span class="author">${escapeHTML(data.name || "Anonymous")}</span>
                    ${deleteBtnHTML}
                </div>
                <div class="text">${escapeHTML(data.text)}</div>
            `;
            messageContainer.appendChild(msgDiv);
        });

        document.querySelectorAll(".delete-msg-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const button = e.target.closest("button");
                const messageId = button.dataset.id;
                try {
                    await deleteDoc(doc(db, `rooms/${currentRoom}/messages`, messageId));
                } catch (err) {
                    console.error("Error deleting message:", err);
                    showPopup("Error", "Could not delete message.");
                }
            });
        });

        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
        showPopup("Authentication Required", "You must be signed in to send messages!");
        return;
    }
    const text = messageInput.value.trim();
    if (!text) return;

    // Run AI Studio Content Guard
    const isClean = await moderateMessageText(text);
    if (!isClean) {
        showPopup("Message Blocked", "Your message was flagged as inappropriate by the network AI moderator.");
        return;
    }

    try {
        await addDoc(collection(db, `rooms/${currentRoom}/messages`), {
            text: text,
            name: currentUser.displayName,
            uid: currentUser.uid,
            timestamp: serverTimestamp()
        });
        messageInput.value = "";
    } catch (err) {
        console.error("Error sending message:", err);
    }
});

// --- Friend Request System with User Validation & Cancellation ---
document.getElementById("addFriendBtn").addEventListener("click", async () => {
    if (!currentUser) {
        showPopup("Authentication Required", "Please sign in to send friend requests.");
        return;
    }
    const targetName = document.getElementById("friendEmailInput").value.trim();
    if (!targetName) return;

    if (targetName.toLowerCase() === currentUser.displayName.toLowerCase()) {
        showPopup("Invalid Request", "You cannot send a friend request to yourself!");
        return;
    }

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("displayName", "==", targetName));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showPopup("User Not Found", `No user with the display name "${targetName}" exists on the network.`);
            return;
        }

        await addDoc(collection(db, "friendRequests"), {
            senderUid: currentUser.uid,
            senderName: currentUser.displayName,
            recipientName: targetName,
            status: "Pending",
            timestamp: serverTimestamp()
        });

        showPopup("Request Sent", `Friend request successfully sent to ${targetName}!`);
        document.getElementById("friendEmailInput").value = "";
        loadFriendRequests();
    } catch (err) {
        console.error("Error sending friend request:", err);
        showPopup("Error", "Could not send friend request. Please try again.");
    }
});

async function loadFriendRequests() {
    if (!currentUser) return;
    const friendsList = document.getElementById("friendsList");
    friendsList.innerHTML = "";

    try {
        const q = query(collection(db, "friendRequests"), where("senderUid", "==", currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            friendsList.innerHTML = "<p class='placeholder-text'>No active friend requests sent.</p>";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const card = document.createElement("div");
            card.className = "friend-card";
            card.innerHTML = `
                <div>
                    <strong>To: ${escapeHTML(data.recipientName)}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Status: ${data.status}</p>
                </div>
                <button class="danger-btn cancel-req-btn" data-id="${docSnap.id}">Cancel Request</button>
            `;
            friendsList.appendChild(card);
        });

        document.querySelectorAll(".cancel-req-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const reqId = e.target.dataset.id;
                await deleteDoc(doc(db, "friendRequests", reqId));
                showPopup("Cancelled", "Friend request has been cancelled.");
                loadFriendRequests();
            });
        });
    } catch (err) {
        console.error("Error loading requests:", err);
    }
}

// --- Suggestions Submission ---
document.getElementById("submitSuggestionBtn").addEventListener("click", () => {
    const suggestionText = document.getElementById("suggestionInput").value.trim();
    if (!suggestionText) return;
    const suggestionsList = document.getElementById("suggestionsList");
    const card = document.createElement("div");
    card.className = "message";
    card.innerHTML = `<div class="author">Suggestion</div><div class="text">${escapeHTML(suggestionText)}</div>`;
    suggestionsList.prepend(card);
    document.getElementById("suggestionInput").value = "";
});

// --- Helper Utilities ---
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
