# Family Sanctuary 🌿

Family Sanctuary is a private, warm, and intentional digital space designed for families to connect, share, and preserve their most meaningful moments. Moving away from the noise of traditional social media, it provides a focused environment for real-time communication and memory keeping.

## ✨ Features

### 💬 Real-time Communication
*   **Instant Messaging**: Powered by WebSockets for zero-latency conversations.
*   **Role-Based Identity**: Every family member has a distinct role (Parent, Child, Grandparent) with unique visual themes and icons.
*   **Media Sharing**: Share photos and images directly in the chat to keep everyone updated on life's moments.

### 📌 Pinned Memories
*   **Preserve the Best**: Pin important messages, funny quotes, or precious photos.
*   **Dedicated Gallery**: A curated space to revisit all pinned items, ensuring that family history is never lost in the scroll.
*   **Persistent Storage**: Unlike ephemeral chats, pinned memories are stored permanently in the family archive.

### 👥 Presence & Connection
*   **Live Status**: See who's online, away, or busy in real-time.
*   **Member Profiles**: Detailed view of family members with their roles and status.
*   **Warm Design**: A "Warm Organic" aesthetic using serif typography and soft earth tones to create a sense of comfort and home.

## 🛠️ Technical Stack

### Frontend
*   **React 18**: For a responsive and dynamic user interface.
*   **Tailwind CSS**: Utility-first styling for a custom, "crafted" feel.
*   **Framer Motion**: Smooth animations and transitions for a premium experience.
*   **Lucide React**: Consistent and beautiful iconography.

### Backend
*   **Node.js & Express**: Robust server-side logic and API handling.
*   **SQLite (Better-SQLite3)**: A reliable, file-based database for storing messages, members, and pins.
*   **WebSockets (ws)**: Real-time bidirectional communication for chat and presence updates.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   npm

### Installation

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Set up environment variables**:
    Create a `.env` file based on `.env.example`.
    ```env
    GEMINI_API_KEY=your_api_key_here
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open the app**:
    Navigate to `http://localhost:3000` in your browser.

## 📖 Usage

1.  **Login**: Choose your family role and enter your name to join the sanctuary.
2.  **Chat**: Send messages and images to the main family feed.
3.  **Pin**: Hover over any message and click the pin icon to save it to the "Pinned Memories" gallery.
4.  **Status**: Your status updates automatically, but you can see others' status in the "Members" tab.

---

*Built with ❤️ for families everywhere.*
