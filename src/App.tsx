import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, User, Users, LogOut, Shield, MessageCircle, Heart, 
  Search, Pin, Smile, Bell, Settings, Image as ImageIcon, 
  Activity, X, Check, Trash2, Camera, Mic, MicOff, Monitor, 
  Paperclip, CornerUpLeft, Archive
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import Fuse from "fuse.js";

interface User {
  id: number;
  username: string;
  role: "Parent" | "Child" | "Grandparent";
  family_code: string;
  bio?: string;
  profile_picture?: string;
  theme?: string;
  font?: string;
  status?: string;
}

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string;
  content: string;
  timestamp: string;
  is_pinned: number;
  read_count?: number;
  reactions?: string; // Format: "emoji:user_id,emoji:user_id"
  quoted_message_id?: number;
  quoted_content?: string;
  quoted_sender_name?: string;
  attachment_url?: string;
  is_archived?: number;
}

interface ActivityLog {
  id: number;
  type: string;
  content: string;
  timestamp: string;
}

const EMOJIS = [
  // Smileys
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕",
  // Hearts & Emotions
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💌", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤",
  // Hand Gestures
  "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾",
  // Family & People
  "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "👨‍👩‍👦", "👨‍👩‍👧", "👨‍👩‍👧‍👦", "👨‍👩‍👦‍👦", "👨‍👩‍👧‍👧", "👪",
  // Activities & Objects
  "✨", "🌟", "⭐", "🌈", "☁️", "☀️", "🍎", "🍕", "🍔", "🍦", "🍰", "☕", "🍺", "🍷", "🎮", "⚽", "🏀", "🎨", "🎬", "🎤", "🎧", "🎸", "📚", "📖", "📍", "🏠", "🚗", "🚲", "✈️", "🚀", "⌚", "📱", "💻", "💡", "🔑", "🎁", "🎈", "🎉", "🎊", "🏆", "💯", "✅", "❌"
];

const getRoleColor = (role: string) => {
  switch (role) {
    case "Parent": return {
      text: "text-emerald-900",
      bg: "bg-emerald-50/60",
      border: "border-emerald-200/50",
      bubble: "bg-emerald-700",
      light: "bg-emerald-100/40",
      accent: "emerald"
    };
    case "Child": return {
      text: "text-amber-900",
      bg: "bg-amber-50/60",
      border: "border-amber-200/50",
      bubble: "bg-amber-700",
      light: "bg-amber-100/40",
      accent: "amber"
    };
    case "Grandparent": return {
      text: "text-indigo-900",
      bg: "bg-indigo-50/60",
      border: "border-indigo-200/50",
      bubble: "bg-indigo-700",
      light: "bg-indigo-100/40",
      accent: "indigo"
    };
    default: return {
      text: "text-slate-900",
      bg: "bg-slate-50/60",
      border: "border-slate-200/50",
      bubble: "bg-slate-700",
      light: "bg-slate-100/40",
      accent: "slate"
    };
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", familyCode: "", role: "Child" as const });
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"chat" | "activity" | "pinned" | "members" | "archived">("chat");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [profileForm, setProfileForm] = useState({ bio: "", profile_picture: "", theme: "warm", font: "serif", status: "online" });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [searchFilters, setSearchFilters] = useState({ sender: "", startDate: "", endDate: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [videoCall, setVideoCall] = useState<{ active: boolean; isIncoming: boolean; caller?: string; peerId?: string; offer?: any } | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<number, string>>({});
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Set<number>>(new Set());
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineQueue.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
        offlineQueue.forEach(msg => socketRef.current?.send(JSON.stringify(msg)));
        setOfflineQueue([]);
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [offlineQueue]);

  useEffect(() => {
    if (user) {
      document.body.className = `theme-${user.theme || 'warm'} font-${user.font || 'serif'}`;
    }
  }, [user?.theme, user?.font]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMessages(messages);
      return;
    }
    const fuse = new Fuse(messages, {
      keys: ["content", "sender_name"],
      threshold: 0.4,
      ignoreLocation: true
    });
    const results = fuse.search(searchQuery);
    setFilteredMessages(results.map(r => r.item));
  }, [searchQuery, messages]);

  useEffect(() => {
    if (user) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}`);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "join", familyCode: user.family_code, userId: user.id }));
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "chat") {
          setMessages((prev) => [...prev, { ...data, read_count: 0, is_pinned: 0 }]);
          if (data.sender_id !== user.id) {
            socket.send(JSON.stringify({ type: "read", messageId: data.id }));
            fetch("/api/messages/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageIds: [data.id], userId: user.id }),
            });
            showNotification(data.sender_name, data.content);
          }
        } else if (data.type === "typing") {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            if (data.isTyping) next.add(data.username);
            else next.delete(data.username);
            return next;
          });
        } else if (data.type === "read") {
          setMessages((prev) => prev.map(m => 
            m.id === data.messageId ? { ...m, read_count: (m.read_count || 0) + 1 } : m
          ));
        } else if (data.type === "react") {
          setMessages((prev) => prev.map(m => {
            if (m.id === data.messageId) {
              const currentReactions = m.reactions ? m.reactions.split(",") : [];
              const reactionStr = `${data.emoji}:${data.userId}`;
              let nextReactions;
              if (data.action === "add") {
                nextReactions = [...currentReactions, reactionStr];
              } else {
                nextReactions = currentReactions.filter(r => r !== reactionStr);
              }
              return { ...m, reactions: nextReactions.join(",") };
            }
            return m;
          }));
        } else if (data.type === "pin") {
          setMessages((prev) => prev.map(m => 
            m.id === data.messageId ? { ...m, is_pinned: data.isPinned ? 1 : 0 } : m
          ));
          if (data.isPinned) {
            fetchPinnedMessages();
          } else {
            setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
          }
        } else if (data.type === "archive") {
          setMessages((prev) => prev.map(m => 
            m.id === data.messageId ? { ...m, is_archived: data.isArchived ? 1 : 0 } : m
          ));
        } else if (data.type === "delete") {
          setMessages((prev) => prev.filter(m => m.id !== data.messageId));
        } else if (data.type === "call_signal") {
          handleCallSignal(data);
        } else if (data.type === "presence") {
          setPresenceMap(prev => ({ ...prev, [data.userId]: data.status }));
          fetchPresence();
        }
      };

      fetchMessages();
      fetchActivityLogs();
      fetchPresence();
      setProfileForm({ 
        bio: user.bio || "", 
        profile_picture: user.profile_picture || "",
        theme: user.theme || "warm",
        font: user.font || "serif",
        status: user.status || "online"
      });

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      return () => {
        socket.close();
      };
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "archived") {
      setIsArchivedView(true);
    } else if (activeTab === "chat" || activeTab === "pinned") {
      setIsArchivedView(false);
    }
    
    if (activeTab === "pinned") {
      fetchPinnedMessages();
    }
  }, [activeTab]);

  const fetchMessages = async (query = "") => {
    if (!user) return;
    const params = new URLSearchParams({
      q: query,
      sender: searchFilters.sender,
      startDate: searchFilters.startDate,
      endDate: searchFilters.endDate,
      archived: isArchivedView.toString()
    });
    const res = await fetch(`/api/messages/${user.family_code}?${params.toString()}`);
    const data = await res.json();
    setMessages(data);
  };

  useEffect(() => {
    fetchMessages(searchQuery);
  }, [isArchivedView]);

  const fetchActivityLogs = async () => {
    if (!user) return;
    const res = await fetch(`/api/activity/${user.family_code}`);
    const data = await res.json();
    setActivityLogs(data);
  };

  const fetchPinnedMessages = async () => {
    if (!user) return;
    const res = await fetch(`/api/messages/pinned/${user.family_code}`);
    const data = await res.json();
    setPinnedMessages(data);
  };

  const fetchPresence = async () => {
    if (!user) return;
    const res = await fetch(`/api/presence/${user.family_code}`);
    const data = await res.json();
    setMembers(data);
    const map: Record<number, string> = {};
    data.forEach((u: any) => map[u.id] = u.status);
    setPresenceMap(map);
  };

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification(`FamilyLink: ${title}`, { body, icon: "/favicon.ico" });
    }
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    socketRef.current?.send(JSON.stringify({ type: "call_signal", signalType: "hangup" }));
    setVideoCall(null);
  };

  const handleCallSignal = async (data: any) => {
    if (data.signalType === "offer") {
      setVideoCall({ active: true, isIncoming: true, caller: data.senderName, peerId: data.senderId, offer: data.signal });
    } else if (data.signalType === "answer") {
      await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signalType === "candidate") {
      await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else if (data.signalType === "hangup") {
      endCall();
    }
  };

  useEffect(() => {
    if (scrollRef.current && activeTab === "chat") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers, activeTab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }
      setUser(data);
    } catch (error) {
      setLoginError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart || 0;
    setInput(value);

    // Mention logic
    const lastAtPos = value.lastIndexOf("@", selectionStart - 1);
    if (lastAtPos !== -1) {
      const textAfterAt = value.substring(lastAtPos + 1, selectionStart);
      // If there's a space between @ and cursor, it's not a mention anymore
      if (!textAfterAt.includes(" ")) {
        setShowMentionDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionIndex(lastAtPos);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }

    if (!socketRef.current || !user) return;
    socketRef.current.send(JSON.stringify({ type: "typing", isTyping: true, username: user.username }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.send(JSON.stringify({ type: "typing", isTyping: false, username: user.username }));
    }, 2000);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachment) return;
    const msg = { 
      type: "chat", 
      content: input, 
      quoted_message_id: replyToMessage?.id,
      attachment_url: attachment
    };
    if (isOnline && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      setOfflineQueue(prev => [...prev, msg]);
      // Optimistic update for UI
      const tempId = Date.now();
      setMessages(prev => [...prev, {
        id: tempId,
        sender_id: user!.id,
        sender_name: user!.username,
        sender_role: user!.role,
        content: input,
        timestamp: new Date().toISOString(),
        is_pinned: 0,
        read_count: 0,
        quoted_message_id: replyToMessage?.id,
        quoted_content: replyToMessage?.content,
        quoted_sender_name: replyToMessage?.sender_name,
        attachment_url: attachment || undefined
      }]);
    }
    socketRef.current?.send(JSON.stringify({ type: "typing", isTyping: false, username: user?.username }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setInput("");
    setReplyToMessage(null);
    setAttachment(null);
  };

  const deleteMessage = async (messageId: number) => {
    if (!user) return;
    await fetch("/api/messages/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, userId: user.id }),
    });
    socketRef.current?.send(JSON.stringify({ type: "delete", messageId }));
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setDeleteConfirmId(null);
  };

  const toggleUnread = (messageId: number) => {
    setUnreadMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const initiateCall = async () => {
    if (!user || !socketRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({ type: "call_signal", signalType: "candidate", candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.send(JSON.stringify({ type: "call_signal", signalType: "offer", signal: offer, senderName: user.username, senderId: user.id }));
    setVideoCall({ active: true, isIncoming: false });
  };

  const answerCall = async () => {
    if (!user || !socketRef.current || !videoCall || !videoCall.offer) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerConnectionRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(JSON.stringify({ type: "call_signal", signalType: "candidate", candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    await pc.setRemoteDescription(new RTCSessionDescription(videoCall.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.send(JSON.stringify({ type: "call_signal", signalType: "answer", signal: answer }));
    
    setVideoCall({ ...videoCall, isIncoming: false });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const videoTrack = screenStream.getVideoTracks()[0];
        
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        }
        
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        
        videoTrack.onended = () => {
          stopScreenShare();
        };
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e) {
      file = e.dataTransfer.files[0];
    }

    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e);
  };

  const togglePin = async (messageId: number, currentStatus: number) => {
    const isPinned = currentStatus === 0;
    await fetch("/api/messages/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, isPinned }),
    });
    socketRef.current?.send(JSON.stringify({ type: "pin", messageId, isPinned }));
    
    // Update local state
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: isPinned ? 1 : 0 } : m));
    if (isPinned) {
      const msg = messages.find(m => m.id === messageId);
      if (msg) setPinnedMessages(prev => [msg, ...prev]);
    } else {
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  const toggleArchive = async (messageId: number, currentStatus: number) => {
    const isArchived = currentStatus === 0;
    await fetch("/api/messages/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, isArchived }),
    });
    socketRef.current?.send(JSON.stringify({ type: "archive", messageId, isArchived }));
    // If we are in the main view and just archived, or in archived view and just unarchived, remove from local list
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const handleReact = async (messageId: number, emoji: string) => {
    if (!user) return;
    const message = messages.find(m => m.id === messageId);
    const reactions = message?.reactions ? message.reactions.split(",") : [];
    const myReaction = `${emoji}:${user.id}`;
    const action = reactions.includes(myReaction) ? "remove" : "add";

    await fetch("/api/messages/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, userId: user.id, emoji, action }),
    });
    socketRef.current?.send(JSON.stringify({ type: "react", messageId, userId: user.id, emoji, action }));
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...profileForm }),
    });
    setUser({ ...user, ...profileForm });
    setShowProfileModal(false);
    setIsLoading(false);
  };

  const generateProfilePicture = async () => {
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: `A warm, artistic, minimalist profile avatar for a ${user?.role} named ${user?.username}. Soft colors, organic shapes, family-friendly.` }]
        },
      });
      
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setProfileForm(prev => ({ ...prev, profile_picture: imageUrl }));
          break;
        }
      }
    } catch (error) {
      console.error("Image generation failed", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const insertMention = (username: string) => {
    const before = input.substring(0, mentionIndex);
    const after = input.substring(mentionIndex + mentionQuery.length + 1);
    const newValue = `${before}@${username} ${after}`;
    setInput(newValue);
    setShowMentionDropdown(false);
    // Focus back to input and set cursor position
    const inputEl = document.querySelector('input[placeholder="Type a message to your family..."]') as HTMLInputElement;
    if (inputEl) {
      inputEl.focus();
      const newCursorPos = before.length + username.length + 2;
      setTimeout(() => {
        inputEl.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!user) return;

      if (showMentionDropdown) {
        const filteredMembers = members.filter(m => 
          m.username.toLowerCase().includes(mentionQuery.toLowerCase())
        );

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedMentionIndex(prev => (prev + 1) % filteredMembers.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredMembers[selectedMentionIndex]) {
            insertMention(filteredMembers[selectedMentionIndex].username);
          }
        } else if (e.key === "Escape") {
          setShowMentionDropdown(false);
        }
        return;
      }

      // Ctrl + Enter to send message
      if (e.ctrlKey && e.key === "Enter") {
        const sendBtn = document.getElementById("send-message-btn");
        if (sendBtn) sendBtn.click();
      }

      // Ctrl + E to open emoji picker
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        setShowEmojiPicker(prev => !prev);
      }

      // Ctrl + Shift + R to reply to last message
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        if (messages.length > 0) {
          setReplyToMessage(messages[messages.length - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, messages]);

  const renderMessageContent = (content: string, role: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className={`font-bold px-1 rounded ${getRoleColor(role).light} ${getRoleColor(role).text}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-serif relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/30 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-indigo-100/30 rounded-full blur-[120px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/90 backdrop-blur-2xl p-10 rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] w-full max-w-md border border-white/50 relative z-10">
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              animate={{ scale: [1, 1.05, 1], rotate: [3, 5, 3] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 bg-gradient-to-br from-[#5A5A40] to-[#8A8A70] rounded-[32px] flex items-center justify-center mb-6 shadow-2xl shadow-[#5A5A40]/20"
            >
              <Heart className="text-white w-12 h-12" />
            </motion.div>
            <h1 className="text-5xl font-bold text-[#1a1a1a] mb-3 tracking-tighter">FamilyLink</h1>
            <p className="text-[#5A5A40]/80 text-center italic font-medium text-lg">Your private family sanctuary</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-8">
            {loginError && <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 rounded-2xl bg-red-50/50 text-red-600 text-[10px] font-bold text-center border border-red-100/50 uppercase tracking-[0.2em]">{loginError}</motion.div>}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#1a1a1a]/60 uppercase tracking-[0.2em] ml-1">Your Name</label>
              <input type="text" required className="w-full px-6 py-5 rounded-3xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all bg-white/50 shadow-sm placeholder:text-black/20" placeholder="e.g. Dad, Sarah..." value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[#1a1a1a]/60 uppercase tracking-[0.2em] ml-1">Family Secret Code</label>
              <input type="password" required className="w-full px-6 py-5 rounded-3xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all bg-white/50 shadow-sm placeholder:text-black/20" placeholder="Unique code for your family" value={loginData.familyCode} onChange={(e) => setLoginData({ ...loginData, familyCode: e.target.value })} />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-[#1a1a1a]/60 uppercase tracking-[0.2em] ml-1">I am a...</label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: "Parent", icon: Shield, color: "emerald", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200/50", inactiveClass: "bg-white text-emerald-700 border-emerald-100 hover:bg-emerald-50/50" },
                  { id: "Child", icon: User, color: "amber", activeClass: "bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-200/50", inactiveClass: "bg-white text-amber-700 border-amber-100 hover:bg-amber-50/50" },
                  { id: "Grandparent", icon: Heart, color: "indigo", activeClass: "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200/50", inactiveClass: "bg-white text-indigo-700 border-indigo-100 hover:bg-indigo-50/50" }
                ].map(role => (
                  <button 
                    key={role.id}
                    type="button" 
                    onClick={() => setLoginData({ ...loginData, role: role.id as any })} 
                    className={`py-4 rounded-3xl border transition-all flex flex-col items-center justify-center gap-2 ${loginData.role === role.id ? role.activeClass : role.inactiveClass}`}
                  >
                    <role.icon size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{role.id}</span>
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-[#1a1a1a] text-white py-6 rounded-[32px] font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-[#333] transition-all shadow-2xl hover:shadow-[#1a1a1a]/20 disabled:opacity-50 active:scale-[0.98]">
              {isLoading ? "Entering sanctuary..." : "Enter Sanctuary"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col font-serif">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-black/[0.03] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#5A5A40] to-[#8A8A70] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5A5A40]/10">
            <Heart className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-[#1a1a1a] text-xl tracking-tight">FamilyLink</h2>
            <p className="text-[10px] text-[#5A5A40]/60 uppercase tracking-[0.2em] font-sans font-bold">Code: {user.family_code}</p>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-12 relative hidden md:block">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8A8A70]/50" size={18} />
            <input
              type="text"
              placeholder="Search family memories..."
              className="w-full pl-14 pr-14 py-3 rounded-2xl bg-[#F5F5F0]/50 border border-transparent focus:bg-white focus:border-[#5A5A40]/10 focus:ring-4 focus:ring-[#5A5A40]/5 transition-all text-sm placeholder:text-[#8A8A70]/40"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchMessages(e.target.value);
              }}
            />
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${showFilters ? "bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20" : "text-[#8A8A70]/60 hover:bg-black/5"}`}
            >
              <Settings size={16} />
            </button>
          </div>
          
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white shadow-xl rounded-2xl p-4 border border-black/5 z-30"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8A8A70] mb-1">Sender</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-1.5 rounded-lg border border-black/10 text-xs" 
                      placeholder="Username"
                      value={searchFilters.sender}
                      onChange={(e) => setSearchFilters({...searchFilters, sender: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8A8A70] mb-1">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-1.5 rounded-lg border border-black/10 text-xs"
                      value={searchFilters.startDate}
                      onChange={(e) => setSearchFilters({...searchFilters, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8A8A70] mb-1">End Date</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-1.5 rounded-lg border border-black/10 text-xs"
                      value={searchFilters.endDate}
                      onChange={(e) => setSearchFilters({...searchFilters, endDate: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <button 
                      onClick={() => fetchMessages(searchQuery)}
                      className="w-full bg-[#5A5A40] text-white py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-colors"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={initiateCall} className="p-2 text-[#5A5A40] hover:bg-black/5 rounded-full transition-all">
            <Camera size={20} />
          </button>
          <button onClick={() => setShowProfileModal(true)} className="p-2 text-[#5A5A40] hover:bg-black/5 rounded-full transition-all">
            {user.profile_picture ? (
              <img src={user.profile_picture} className="w-8 h-8 rounded-full object-cover border border-[#5A5A40]/20" referrerPolicy="no-referrer" />
            ) : (
              <Settings size={20} />
            )}
          </button>
          <button onClick={() => setUser(null)} className="p-2 text-[#5A5A40] hover:bg-black/5 rounded-full transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white/90 backdrop-blur-xl border-b border-black/[0.02] px-8 flex gap-10 sticky top-[88px] z-10">
        {[
          { id: "chat", label: "Sanctuary", icon: MessageCircle, color: "text-emerald-700", bg: "bg-emerald-700" },
          { id: "members", label: "Family", icon: Users, color: "text-amber-700", bg: "bg-amber-700" },
          { id: "activity", label: "Activity Log", icon: Activity, color: "text-indigo-700", bg: "bg-indigo-700" },
          { id: "pinned", label: "Pinned", icon: Pin, color: "text-rose-700", bg: "bg-rose-700" },
          { id: "archived", label: "Archived", icon: Archive, color: "text-slate-700", bg: "bg-slate-700" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-5 px-1 flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === tab.id ? tab.color : "text-[#8A8A70]/60 hover:text-[#5A5A40]"}`}
          >
            <tab.icon size={15} />
            {tab.label}
            {activeTab === tab.id && <motion.div layoutId="tab-underline" className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${tab.bg}`} />}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full bg-white/50 backdrop-blur-sm relative transition-all ${isDragging ? "ring-4 ring-inset ring-[#5A5A40] bg-[#5A5A40]/5" : ""}`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#5A5A40]/10 backdrop-blur-sm pointer-events-none">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-dashed border-[#5A5A40] flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-[#5A5A40]/10 rounded-full flex items-center justify-center text-[#5A5A40]">
                <Paperclip size={32} />
              </div>
              <p className="text-lg font-bold text-[#5A5A40] uppercase tracking-widest">Drop to attach image</p>
            </div>
          </div>
        )}
        {(activeTab === "chat" || activeTab === "archived" || activeTab === "pinned") && (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
              <AnimatePresence initial={false}>
                {(activeTab === "pinned" ? pinnedMessages : filteredMessages).map((msg, idx) => {
                  const isMe = msg.sender_id === user.id;
                  const isUnread = unreadMessages.has(msg.id);
                  const showName = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;
                  const reactions = msg.reactions ? msg.reactions.split(",") : [];
                  
                  return (
                    <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showName && (
                        <div className={`flex items-center gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          {msg.sender_avatar && <img src={msg.sender_avatar} className="w-5 h-5 rounded-full object-cover ring-1 ring-black/5" referrerPolicy="no-referrer" />}
                          <span className={`text-[10px] uppercase tracking-widest font-sans font-bold ${isMe ? "text-[#5A5A40]" : getRoleColor(msg.sender_role).text}`}>
                            {msg.sender_name} • {msg.sender_role}
                            <span className={`ml-2 inline-block w-2 h-2 rounded-full ring-2 ring-white ${presenceMap[msg.sender_id] === 'online' ? 'bg-green-500' : presenceMap[msg.sender_id] === 'away' ? 'bg-yellow-500' : presenceMap[msg.sender_id] === 'busy' ? 'bg-red-500' : 'bg-gray-400'}`} />
                          </span>
                        </div>
                      )}
                      <div className="group relative">
                        <div className={`max-w-[80vw] sm:max-w-md px-6 py-3.5 rounded-[28px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] relative transition-all hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.1)] ${msg.is_pinned ? "border-2 border-[#5A5A40]/20" : ""} ${isMe ? "bg-gradient-to-br from-[#5A5A40] to-[#7A7A60] text-white rounded-tr-none" : `${getRoleColor(msg.sender_role).bg} ${getRoleColor(msg.sender_role).text} border border-black/[0.03] rounded-tl-none`} ${isUnread ? "ring-2 ring-blue-400/50 ring-offset-2" : ""}`}>
                          {isUnread && <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]" />}
                          {msg.quoted_content && (
                            <div className={`mb-3 p-3 rounded-2xl text-[13px] border-l-[3px] ${isMe ? "bg-white/10 border-white/20 text-white/90" : `${getRoleColor(msg.sender_role).light} border-${getRoleColor(msg.sender_role).accent}-400/50 opacity-90`}`}>
                              <p className="font-bold mb-1 opacity-70 text-[10px] uppercase tracking-widest">{msg.quoted_sender_name}</p>
                              <p className="italic truncate leading-relaxed">{msg.quoted_content}</p>
                            </div>
                          )}
                          {msg.attachment_url && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-black/5">
                              <img src={msg.attachment_url} className="w-full max-h-60 object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          {msg.is_pinned === 1 && <Pin size={10} className="absolute -top-2 -right-2 text-[#5A5A40] fill-[#5A5A40]" />}
                          <p className="text-[15px] leading-relaxed">{renderMessageContent(msg.content, msg.sender_role)}</p>
                          <div className="flex items-center justify-between mt-1 gap-4">
                            <span className="text-[9px] block opacity-60">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <div className="flex items-center gap-0.5 opacity-60">
                                {msg.read_count && msg.read_count > 0 ? (
                                  <>
                                    <Check size={10} className="text-blue-300" />
                                    <Check size={10} className="-ml-1 text-blue-300" />
                                    <span className="text-[8px] ml-1 font-sans font-bold uppercase">Read</span>
                                  </>
                                ) : (
                                  <Check size={10} />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Message Actions */}
                        <div className={`absolute top-0 ${isMe ? "-left-60" : "-right-60"} opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-1 bg-white/90 backdrop-blur-xl shadow-xl rounded-full p-1.5 border border-black/[0.03] z-10`}>
                          <button onClick={() => setReplyToMessage(msg)} className="p-2 hover:bg-black/5 rounded-full text-[#5A5A40] transition-colors" title="Reply"><CornerUpLeft size={15} /></button>
                          <button onClick={() => togglePin(msg.id, msg.is_pinned)} className="p-2 hover:bg-black/5 rounded-full text-[#5A5A40] transition-colors" title="Pin"><Pin size={15} /></button>
                          <button onClick={() => toggleArchive(msg.id, msg.is_archived || 0)} className="p-2 hover:bg-black/5 rounded-full text-[#5A5A40] transition-colors" title={msg.is_archived ? "Unarchive" : "Archive"}><Archive size={15} /></button>
                          <button onClick={() => toggleUnread(msg.id)} className={`p-2 hover:bg-black/5 rounded-full transition-colors ${isUnread ? "text-blue-500" : "text-[#5A5A40]"}`} title="Mark as Unread"><Bell size={15} /></button>
                          <div className="relative group/emoji">
                            <button className="p-2 hover:bg-black/5 rounded-full text-[#5A5A40] transition-colors"><Smile size={15} /></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/emoji:flex bg-white/95 backdrop-blur-xl shadow-2xl rounded-[24px] p-2.5 gap-1.5 border border-black/[0.03] animate-in fade-in zoom-in duration-200">
                              {EMOJIS.slice(0, 8).map(e => <button key={e} onClick={() => handleReact(msg.id, e)} className="hover:scale-150 transition-transform text-lg">{e}</button>)}
                            </div>
                          </div>
                          {isMe && (
                            <button onClick={() => setDeleteConfirmId(msg.id)} className="p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors"><Trash2 size={15} /></button>
                          )}
                        </div>

                        {/* Reaction Display */}
                        {reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                            {(Array.from(new Set(reactions.map(r => r.split(":")[0]))) as string[]).map(emoji => {
                              const count = reactions.filter(r => r.startsWith(emoji)).length;
                              return (
                                <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="bg-white border border-black/5 rounded-full px-2 py-0.5 text-[10px] flex items-center gap-1 hover:bg-black/5">
                                  {emoji} {count > 1 && count}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {typingUsers.size > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[#8A8A70] text-[10px] italic font-sans">
                  <div className="flex gap-1">
                    <span className="w-1 h-1 bg-[#8A8A70] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-[#8A8A70] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-[#8A8A70] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                </motion.div>
              )}
            </div>
            <div className="p-8 bg-white/80 backdrop-blur-xl border-t border-black/[0.02]">
              <AnimatePresence>
                {replyToMessage && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} 
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-5 bg-[#F5F5F0]/80 backdrop-blur-sm rounded-[32px] flex items-center justify-between border border-black/[0.03] relative shadow-sm">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#5A5A40] to-[#8A8A70] rounded-l-[32px]" />
                      <div className="flex items-center gap-5 pl-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40] shadow-inner">
                          <CornerUpLeft size={18} />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-[#5A5A40] uppercase tracking-[0.2em] text-[10px] mb-1">Replying to {replyToMessage.sender_name}</p>
                          <p className="text-[#8A8A70] truncate max-w-md italic leading-relaxed">"{replyToMessage.content}"</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setReplyToMessage(null)} 
                        className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-all text-[#8A8A70] hover:text-red-500"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {attachment && (
                <div className="mb-3 relative inline-block">
                  <img src={attachment} className="w-20 h-20 object-cover rounded-xl border border-black/10" />
                  <button onClick={() => setAttachment(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={10} /></button>
                </div>
              )}
              {!isOnline && (
                <div className="mb-2 text-[10px] text-orange-600 bg-orange-50 px-3 py-1 rounded-full flex items-center gap-2">
                  <Activity size={10} /> You are offline. Messages will be sent when you reconnect.
                </div>
              )}
              <form onSubmit={sendMessage} className="flex flex-col gap-2">
                <div className="flex gap-3 items-center">
                    <div className="flex-1 relative">
                      <AnimatePresence>
                        {showMentionDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-4 bg-white shadow-2xl rounded-3xl p-2 border border-black/5 w-64 z-30 overflow-hidden"
                          >
                            <div className="p-3 border-b border-black/5 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">Mention Family Member</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                              {members
                                .filter(m => m.username.toLowerCase().includes(mentionQuery.toLowerCase()))
                                .map((member, idx) => (
                                  <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => insertMention(member.username)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${idx === selectedMentionIndex ? getRoleColor(member.role).bg : "hover:bg-black/5"}`}
                                  >
                                    <div className="relative">
                                      <div className="w-8 h-8 rounded-full overflow-hidden border border-black/5">
                                        {member.profile_picture ? (
                                          <img src={member.profile_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <div className="w-full h-full bg-[#F5F5F0] flex items-center justify-center text-[#8A8A70]"><User size={16} /></div>
                                        )}
                                      </div>
                                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${presenceMap[member.id] === 'online' ? 'bg-green-500' : presenceMap[member.id] === 'away' ? 'bg-yellow-500' : presenceMap[member.id] === 'busy' ? 'bg-red-500' : 'bg-gray-400'}`} />
                                    </div>
                                    <div className="text-left">
                                      <p className={`text-sm font-bold ${idx === selectedMentionIndex ? getRoleColor(member.role).text : "text-[#1a1a1a]"}`}>{member.username}</p>
                                      <p className="text-[9px] uppercase tracking-widest text-[#8A8A70] font-bold">{member.role}</p>
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.div
                        animate={input.length >= 1000 ? { x: [0, -5, 5, -5, 5, 0] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        <input 
                          type="text" 
                          value={input} 
                          onChange={handleTyping} 
                          maxLength={1000}
                          placeholder="Type a message to your family..." 
                          className={`w-full px-8 py-5 rounded-[32px] border transition-all bg-[#FDFDFB]/80 backdrop-blur-sm text-[15px] pr-20 focus:outline-none focus:ring-4 ${input.length >= 1000 ? "border-red-500/50 ring-red-500/10" : "border-black/[0.03] focus:ring-[#5A5A40]/5 focus:border-[#5A5A40]/10 focus:bg-white shadow-sm"}`} 
                        />
                      </motion.div>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <div className="relative w-7 h-7 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90">
                            <circle
                              cx="14"
                              cy="14"
                              r="12"
                              fill="transparent"
                              stroke="rgba(0,0,0,0.03)"
                              strokeWidth="2.5"
                            />
                            <circle
                              cx="14"
                              cy="14"
                              r="12"
                              fill="transparent"
                              stroke={input.length >= 1000 ? "#EF4444" : input.length > 800 ? "#F59E0B" : "#5A5A40"}
                              strokeWidth="2.5"
                              strokeDasharray={2 * Math.PI * 12}
                              strokeDashoffset={2 * Math.PI * 12 * (1 - Math.min(input.length / 1000, 1))}
                              className="transition-all duration-500 ease-out"
                            />
                          </svg>
                          {input.length > 800 && (
                            <span className={`absolute text-[9px] font-bold ${input.length >= 1000 ? 'text-red-500' : 'text-[#5A5A40]'}`}>
                              {1000 - input.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  <div className="flex gap-3">
                    <label className="w-14 h-14 bg-white/50 backdrop-blur-sm border border-black/[0.03] text-[#5A5A40] rounded-2xl flex items-center justify-center hover:bg-white hover:shadow-lg hover:shadow-black/5 cursor-pointer transition-all active:scale-95">
                      <Paperclip size={20} />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="w-14 h-14 bg-white/50 backdrop-blur-sm border border-black/[0.03] text-[#5A5A40] rounded-2xl flex items-center justify-center hover:bg-white hover:shadow-lg hover:shadow-black/5 transition-all active:scale-95"
                      >
                        <Smile size={20} />
                      </button>
                      <AnimatePresence>
                        {showEmojiPicker && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: -10 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute bottom-full right-0 mb-4 bg-white shadow-2xl rounded-3xl p-4 border border-black/5 w-72 z-30"
                          >
                            <div className="flex justify-between items-center mb-3 px-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">Choose Emoji</span>
                              <button onClick={() => setShowEmojiPicker(false)} className="text-[#8A8A70] hover:text-[#5A5A40]"><X size={14} /></button>
                            </div>
                            <div className="mb-3">
                              <input 
                                type="text" 
                                placeholder="Search emojis..." 
                                className="w-full px-3 py-1.5 rounded-xl border border-black/10 text-xs focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                                value={emojiSearch}
                                onChange={(e) => setEmojiSearch(e.target.value)}
                              />
                            </div>
                            <div className="grid grid-cols-7 gap-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                              {EMOJIS.filter(e => e.includes(emojiSearch) || emojiSearch === "").map(e => (
                                <button 
                                  key={e} 
                                  type="button"
                                  onClick={() => {
                                    setInput(prev => prev + e);
                                    // Don't close automatically for multiple emojis
                                  }} 
                                  className="text-xl hover:bg-[#F5F5F0] rounded-lg transition-all p-1.5"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button type="submit" id="send-message-btn" disabled={!input.trim() && !attachment} className="w-12 h-12 bg-[#5A5A40] text-white rounded-full flex items-center justify-center hover:bg-[#4A4A30] transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:shadow-none"><Send size={18} /></button>
                  </div>
                </div>
              </form>
            </div>
          </>
        )}

        {activeTab === "activity" && (
          <div className="flex-1 overflow-y-auto p-10 space-y-8">
            <h3 className="text-3xl font-bold text-[#1a1a1a] mb-8 flex items-center gap-4 tracking-tight">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <Activity size={24} />
              </div>
              Family Activity Log
            </h3>
            <div className="space-y-4">
              {activityLogs.map(log => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-5 items-start border-l-[3px] border-indigo-200/50 pl-8 py-4 bg-white/40 rounded-r-[32px] hover:bg-white/80 transition-all shadow-sm hover:shadow-md group"
                >
                  <div className={`mt-0.5 p-3 rounded-2xl shadow-sm transition-transform group-hover:scale-110 ${log.type === 'join' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {log.type === "join" ? <Users size={18} /> : <MessageCircle size={18} />}
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-[#1a1a1a] leading-relaxed">{log.content}</p>
                    <p className="text-[10px] text-[#8A8A70]/60 mt-2 uppercase tracking-[0.2em] font-bold">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "pinned" && (
          <div className="flex-1 overflow-y-auto p-10 space-y-8">
            <h3 className="text-3xl font-bold text-[#1a1a1a] mb-8 flex items-center gap-4 tracking-tight">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 shadow-sm">
                <Pin size={24} />
              </div>
              Pinned Memories
            </h3>
            {pinnedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-rose-50/50 text-rose-200 rounded-[32px] flex items-center justify-center mb-6 shadow-inner">
                  <Pin size={48} />
                </div>
                <p className="text-[#8A8A70] italic max-w-xs text-lg">No pinned messages yet. Pin important memories to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {pinnedMessages.map(msg => (
                  <motion.div 
                    key={msg.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-black/[0.02] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)] transition-all group"
                  >
                    <button onClick={() => togglePin(msg.id, 1)} className="absolute top-8 right-8 text-[#8A8A70]/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"><X size={20} /></button>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${getRoleColor(msg.sender_role).bubble}`} />
                      <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${getRoleColor(msg.sender_role).text}`}>{msg.sender_name} • {new Date(msg.timestamp).toLocaleDateString()}</p>
                    </div>
                    <p className="text-[#1a1a1a] leading-relaxed text-lg">{renderMessageContent(msg.content, msg.sender_role)}</p>
                    {msg.attachment_url && (
                      <div className="mt-6 rounded-3xl overflow-hidden border border-black/[0.03] shadow-sm">
                        <img src={msg.attachment_url} className="w-full max-h-64 object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div className="flex-1 overflow-y-auto p-10">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h3 className="text-4xl font-bold text-[#1a1a1a] tracking-tight mb-2">Family Members</h3>
                <p className="text-[#5A5A40]/60 text-sm italic">The hearts of this sanctuary</p>
              </div>
              <div className="text-[10px] text-[#8A8A70]/60 uppercase tracking-[0.2em] font-sans font-bold bg-white/50 px-4 py-2 rounded-full border border-black/[0.03]">
                {members.length} Members • {Object.values(presenceMap).filter(s => s === 'online').length} Online
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {members.map(member => (
                <motion.div 
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedMember(member)}
                  className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-black/[0.02] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)] transition-all cursor-pointer group flex items-center gap-8"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-[32px] overflow-hidden border-2 border-[#5A5A40]/5 group-hover:border-[#5A5A40]/20 transition-all shadow-lg group-hover:scale-105">
                      {member.profile_picture ? (
                        <img src={member.profile_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-[#F5F5F0] flex items-center justify-center text-[#8A8A70]"><User size={40} /></div>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white shadow-md ${presenceMap[member.id] === 'online' ? 'bg-green-500' : presenceMap[member.id] === 'away' ? 'bg-yellow-500' : presenceMap[member.id] === 'busy' ? 'bg-red-500' : 'bg-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h4 className="font-bold text-[#1a1a1a] text-xl tracking-tight">{member.username}</h4>
                      {member.role === 'Parent' && <Shield size={16} className="text-[#5A5A40]/60" />}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-sans font-bold text-[#5A5A40]/60 mb-3">{member.role}</p>
                    <p className="text-sm text-[#8A8A70] line-clamp-1 italic leading-relaxed">{member.bio || "No bio yet..."}</p>
                  </div>
                  <div className="text-[#5A5A40]/40 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                    <Settings size={24} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Member Profile Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-[#5A5A40]/10" />
              <div className="relative z-10">
                <div className="flex justify-end mb-4">
                  <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-black/5 rounded-full"><X size={20} /></button>
                </div>
                
                <div className="flex flex-col items-center mb-8">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4">
                    {selectedMember.profile_picture ? (
                      <img src={selectedMember.profile_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-[#F5F5F0] flex items-center justify-center text-[#8A8A70]"><User size={48} /></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-bold text-[#1a1a1a]">{selectedMember.username}</h3>
                    <div className={`w-3 h-3 rounded-full ${presenceMap[selectedMember.id] === 'online' ? 'bg-green-500' : presenceMap[selectedMember.id] === 'away' ? 'bg-yellow-500' : presenceMap[selectedMember.id] === 'busy' ? 'bg-red-500' : 'bg-gray-400'}`} />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-sans font-bold text-[#5A5A40]">{selectedMember.role}</p>
                </div>

                <div className="space-y-6">
                  <div className="bg-[#FDFDFB] p-6 rounded-[24px] border border-black/5">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#5A5A40] mb-3">About</label>
                    <p className="text-[#1a1a1a] italic leading-relaxed">
                      {selectedMember.bio || "This family member hasn't shared a bio yet."}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        setActiveTab("chat");
                        setSearchFilters({ ...searchFilters, sender: selectedMember.username });
                        fetchMessages(searchQuery);
                        setSelectedMember(null);
                      }}
                      className="flex-1 bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#4A4A30] transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={18} />
                      View Memories
                    </button>
                    <button 
                      onClick={() => {
                        initiateCall();
                        setSelectedMember(null);
                      }}
                      className="w-14 h-14 bg-[#F5F5F0] text-[#5A5A40] rounded-full flex items-center justify-center hover:bg-black/5 transition-all border border-black/5"
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white/95 backdrop-blur-2xl rounded-[48px] p-10 w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-white/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#5A5A40]/10 to-transparent" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-3xl font-bold text-[#1a1a1a] tracking-tight">Your Profile</h3>
                  <button onClick={() => setShowProfileModal(false)} className="p-2.5 hover:bg-black/5 rounded-full transition-all hover:rotate-90"><X size={24} /></button>
                </div>

                <div className="space-y-8">
                  <div className="flex flex-col items-center gap-5">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-[40px] bg-[#F5F5F0] overflow-hidden border-4 border-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                        {profileForm.profile_picture ? (
                          <img src={profileForm.profile_picture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#8A8A70]"><User size={48} /></div>
                        )}
                      </div>
                      <button 
                        onClick={generateProfilePicture}
                        disabled={isGeneratingImage}
                        className="absolute -bottom-2 -right-2 p-3 bg-[#5A5A40] text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50 z-20"
                      >
                        {isGeneratingImage ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera size={20} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-[#8A8A70]/60 uppercase tracking-[0.3em] font-bold">AI Profile Picture Generator</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#5A5A40]/60 ml-1">About You</label>
                    <textarea
                      className="w-full px-6 py-5 rounded-[32px] border border-black/[0.03] focus:ring-4 focus:ring-[#5A5A40]/5 focus:border-[#5A5A40]/10 outline-none transition-all bg-[#FDFDFB]/80 backdrop-blur-sm min-h-[120px] text-[15px] placeholder:text-black/20 italic"
                      placeholder="Tell your family something about yourself..."
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#5A5A40]/60 ml-1">Your Status</label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'online', color: 'bg-green-500', label: 'Online', activeClass: 'bg-green-50 text-green-700 border-green-200' },
                        { id: 'away', color: 'bg-yellow-500', label: 'Away', activeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                        { id: 'busy', color: 'bg-red-500', label: 'Busy', activeClass: 'bg-red-50 text-red-700 border-red-200' }
                      ].map(s => (
                        <button 
                          key={s.id}
                          onClick={() => {
                            setProfileForm({...profileForm, status: s.id});
                            socketRef.current?.send(JSON.stringify({ type: "status", status: s.id }));
                            setPresenceMap(prev => ({ ...prev, [user.id]: s.id }));
                          }}
                          className={`py-4 rounded-[24px] text-xs capitalize border transition-all flex flex-col items-center justify-center gap-2 ${profileForm.status === s.id ? s.activeClass + " shadow-sm" : "bg-white/50 text-[#5A5A40]/60 border-black/[0.03] hover:bg-white hover:border-black/10"}`}
                        >
                          <span className={`w-3 h-3 rounded-full ${s.color} ${profileForm.status === s.id ? 'ring-4 ring-white shadow-sm' : ''}`} />
                          <span className="font-bold tracking-widest uppercase text-[9px]">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-[#5A5A40]/60 ml-1">Theme & Appearance</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['warm', 'cool', 'dark'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setProfileForm({...profileForm, theme: t})}
                          className={`py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all ${profileForm.theme === t ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg" : "bg-white/50 text-[#5A5A40]/60 border-black/[0.03] hover:bg-white"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {['serif', 'sans', 'mono'].map(f => (
                        <button 
                          key={f}
                          onClick={() => setProfileForm({...profileForm, font: f})}
                          className={`py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all ${profileForm.font === f ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg" : "bg-white/50 text-[#5A5A40]/60 border-black/[0.03] hover:bg-white"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateProfile}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#5A5A40] to-[#8A8A70] text-white py-6 rounded-[32px] font-bold uppercase tracking-[0.3em] text-[10px] hover:shadow-2xl hover:shadow-[#5A5A40]/20 transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isLoading ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center">
              <Trash2 className="mx-auto text-red-500 mb-4" size={32} />
              <h3 className="text-lg font-bold mb-2">Delete Message?</h3>
              <p className="text-sm text-[#8A8A70] mb-6">This action cannot be undone. Are you sure?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl border border-black/10 text-sm font-medium">Cancel</button>
                <button onClick={() => deleteMessage(deleteConfirmId)} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {videoCall?.active && (
          <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center p-6">
            <div className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-6 right-6 w-48 aspect-video bg-zinc-800 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 backdrop-blur-xl p-4 rounded-full border border-white/10 shadow-2xl z-20">
                  <button 
                    onClick={toggleMute} 
                    className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${isMuted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    <span className="text-[8px] uppercase font-bold mt-1">{isMuted ? "Unmute" : "Mute"}</span>
                  </button>
                  <button 
                    onClick={toggleScreenShare} 
                    className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all ${isScreenSharing ? "bg-blue-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
                  >
                    <Monitor size={24} />
                    <span className="text-[8px] uppercase font-bold mt-1">{isScreenSharing ? "Stop" : "Share"}</span>
                  </button>
                  <button 
                    onClick={endCall} 
                    className="w-14 h-14 bg-red-600 text-white rounded-full flex flex-col items-center justify-center hover:bg-red-700 transition-all shadow-lg"
                  >
                    <X size={24} />
                    <span className="text-[8px] uppercase font-bold mt-1">End</span>
                  </button>
                </div>

                {videoCall.isIncoming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-lg z-30">
                    <div className="w-24 h-24 bg-[#5A5A40] rounded-full flex items-center justify-center mb-6 animate-pulse shadow-[0_0_50px_rgba(90,90,64,0.5)]">
                      <Camera className="text-white w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">{videoCall.caller}</h2>
                    <p className="text-white/60 uppercase tracking-[0.2em] text-xs mb-12">Incoming Video Call</p>
                    <div className="flex gap-12">
                      <button onClick={endCall} className="group flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                          <X size={40} />
                        </div>
                        <span className="text-white text-xs font-bold uppercase tracking-widest">Decline</span>
                      </button>
                      <button onClick={answerCall} className="group flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                          <Check size={40} />
                        </div>
                        <span className="text-white text-xs font-bold uppercase tracking-widest">Accept</span>
                      </button>
                    </div>
                  </div>
                )}
              
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
