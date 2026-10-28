import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentUser = null;
let currentRoom = "global";
let unsubscribeChat = null;

// --- DOM Elements ---
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userDisplay = document.getElementById("userDisplay");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");
const navItems = document.querySelectorAll(".nav-links li");
const viewSections = document.querySelectorAll(".view-section");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const messageContainer = document.getElementById("messageContainer");
const roomChips = document.querySelectorAll(".room-chip");

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
        targetView.classList.add("active");
    });
});

// --- Authentication Handling ---
loginBtn.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
    }
});

logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "block";
        userDisplay.style.display = "block";
        userDisplay.textContent = `Hi, ${user.displayName}`;
        loadMessages(currentRoom);
    } else {
        loginBtn.style.display = "block";
        logoutBtn.style.display = "none";
        userDisplay.style.display = "none";
        messageContainer.innerHTML = "<p style='color: #777; text-align:center;'>Please sign in to chat.</p>";
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

// --- Real-time Chat Sync with Firestore ---
function loadMessages(roomName) {
    if (unsubscribeChat) unsubscribeChat();

    const q = query(collection(db, `rooms/${roomName}/messages`), orderBy("timestamp", "asc"));
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        messageContainer.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.innerHTML = `
                <div class="author">${data.name || "Anonymous"}</div>
                <div class="text">${data.text}</div>
            `;
            messageContainer.appendChild(msgDiv);
        });
        messageContainer.scrollTop = messageContainer.scrollHeight;
    });
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert("You must be signed in to send messages!");
        return;
    }
    const text = messageInput.value.trim();
    if (!text) return;

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

// --- Friends System Placeholder Logic ---
document.getElementById("addFriendBtn").addEventListener("click", () => {
    const friendEmail = document.getElementById("friendEmailInput").value.trim();
    if (!friendEmail) return;
    const friendsList = document.getElementById("friendsList");
    const friendCard = document.createElement("div");
    friendCard.className = "message";
    friendCard.textContent = `Friend request sent to: ${friendEmail}`;
    friendsList.appendChild(friendCard);
    document.getElementById("friendEmailInput").value = "";
});
