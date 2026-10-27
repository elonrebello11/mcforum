const firebaseConfig = {
  apiKey: "AIzaSyBeElewrekuFkMMMV5n_4gKUs99rOrdBLw",
  authDomain: "mc-forum-main-hub.firebaseapp.com",
  projectId: "mc-forum-main-hub",
  storageBucket: "mc-forum-main-hub.firebasestorage.app",
  messagingSenderId: "838366816720",
  appId: "1:838366816720:web:7fe8f2a460b513f0ef31d5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const nicknameModal = document.getElementById('nickname-modal');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname-input');

let currentUserProfile = null;
let chatUnsubscribe = null;

// Persistent Session Setup
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch((error) => {
        console.error("Login Error:", error);
    });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Monitor Auth State & Sync User Profile / Nickname Document
auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginBtn.classList.add('hidden');
        userInfo.classList.remove('hidden');

        // Check if user has a custom profile doc in Firestore
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists || !doc.data().nickname) {
            // First time login or no nickname set -> Prompt modal
            nicknameModal.classList.remove('hidden');
            nicknameInput.value = user.displayName || '';
        } else {
            currentUserProfile = doc.data();
            userName.textContent = currentUserProfile.nickname;
        }

        // Start listening to live chat messages
        initChatListener();
    } else {
        loginBtn.classList.remove('hidden');
        userInfo.classList.add('hidden');
        userName.textContent = '';
        nicknameModal.classList.add('hidden');
        currentUserProfile = null;
        if (chatUnsubscribe) chatUnsubscribe();
        chatMessages.innerHTML = '<div style="color: #666; text-align: center; margin-top: 150px;">Sign in to view and send messages in General Chat.</div>';
    }
});

// Handle Nickname Form Submission
nicknameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newNickname = nicknameInput.value.trim();
    if (!newNickname || !auth.currentUser) return;

    const userRef = db.collection('users').doc(auth.currentUser.uid);
    const profileData = {
        uid: auth.currentUser.uid,
        nickname: newNickname,
        email: auth.currentUser.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(profileData, { merge: true });
    currentUserProfile = profileData;
    userName.textContent = newNickname;
    nicknameModal.classList.add('hidden');
});

// Send Chat Message
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    
    if (!user || !currentUserProfile) {
        alert("Please set your nickname and sign in to chat!");
        return;
    }

    const text = chatInput.value.trim();
    if (!text) return;

    db.collection('general_chat').add({
        uid: user.uid,
        author: currentUserProfile.nickname,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        chatInput.value = '';
    }).catch((error) => {
        console.error("Error sending message:", error);
    });
});

// Real-time Chat Listener
function initChatListener() {
    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = db.collection('general_chat')
        .orderBy('timestamp', 'asc')
        .limit(100)
        .onSnapshot((snapshot) => {
            chatMessages.innerHTML = '';
            if (snapshot.empty) {
                chatMessages.innerHTML = '<div style="color: #666; text-align: center;">No messages yet. Say hello!</div>';
                return;
            }
            snapshot.forEach((doc) => {
                const data = doc.data();
                const timeString = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message';
                msgDiv.innerHTML = `
                    <span class="author">${escapeHtml(data.author || 'Anonymous')}:</span>
                    <span class="text">${escapeHtml(data.text || '')}</span>
                    <span class="timestamp">${timeString}</span>
                `;
                chatMessages.appendChild(msgDiv);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, (error) => {
            console.error("Chat sync error:", error);
        });
}

// XSS Escape Helper
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
