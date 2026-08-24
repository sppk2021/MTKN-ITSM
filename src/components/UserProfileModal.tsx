import React, { useState, useRef, useEffect } from "react";
import { 
  X, User as UserIcon, Mail, Lock, Shield, Camera, Upload, 
  Trash2, Check, CheckCircle2, AlertCircle, Eye, EyeOff, 
  Key, Building2, Phone, Calendar, Sparkles, Loader2, Save,
  CheckCircle, RefreshCw, ShieldCheck
} from "lucide-react";
import { auth, db } from "../lib/firebase";
import { 
  updateProfile, 
  updateEmail,
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { User, UserRole, UserPermissions, TAB_LABELS } from "../types";
import { saveUsersLocal, getUsersLocal, addPendingSyncAction } from "../lib/offlineStorage";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  userRole: string;
  userPermissions?: UserPermissions;
  onProfileUpdated?: (updatedData: { displayName: string; photoURL?: string; email?: string }) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  userRole,
  userPermissions,
  onProfileUpdated
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'permissions'>('profile');
  
  // Profile form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("");
  const [profileErrorMessage, setProfileErrorMessage] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar presets
  const AVATAR_PRESETS = [
    { label: "Indigo", bg: "bg-indigo-600", text: "text-indigo-100" },
    { label: "Blue", bg: "bg-blue-600", text: "text-blue-100" },
    { label: "Emerald", bg: "bg-emerald-600", text: "text-emerald-100" },
    { label: "Amber", bg: "bg-amber-600", text: "text-amber-100" },
    { label: "Rose", bg: "bg-rose-600", text: "text-rose-100" },
    { label: "Purple", bg: "bg-purple-600", text: "text-purple-100" },
  ];

  // Load user data on open
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setProfileSuccessMessage("");
    setProfileErrorMessage("");
    setPasswordSuccessMessage("");
    setPasswordErrorMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRequiresReauth(false);

    const loadUserData = async () => {
      setInitialLoading(true);
      try {
        setFullName(currentUser.displayName || "");
        setEmail(currentUser.email || "");
        setPhotoURL(currentUser.photoURL || "");

        // Fetch extra fields from Firestore
        if (navigator.onLine) {
          const userDocRef = doc(db, "users", currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.displayName && !currentUser.displayName) {
              setFullName(data.displayName);
            }
            if (data.fullName) {
              setFullName(data.fullName);
            }
            if (data.email) {
              setEmail(data.email);
            }
            if (data.photoURL) {
              setPhotoURL(data.photoURL);
            }
            if (data.phone) {
              setPhone(data.phone);
            }
            if (data.department) {
              setDepartment(data.department);
            }
          }
        } else {
          const cachedUsers = await getUsersLocal();
          const found = cachedUsers.find(u => u.id === currentUser.uid);
          if (found) {
            if (found.displayName || found.fullName) setFullName(found.displayName || found.fullName || "");
            if (found.email) setEmail(found.email);
            if (found.photoURL) setPhotoURL(found.photoURL);
            if (found.phone) setPhone(found.phone);
            if (found.department) setDepartment(found.department);
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadUserData();
  }, [isOpen, currentUser]);

  // Image upload and client-side optimization to lightweight Data URL
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileErrorMessage("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setProfileErrorMessage("Image size is too large. Please choose an image under 8MB.");
      return;
    }

    setProfileErrorMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 256x256 using Canvas for high resolution and tiny storage footprint
        const canvas = document.createElement("canvas");
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setPhotoURL(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Remove profile photo
  const handleRemovePhoto = () => {
    setPhotoURL("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Save profile updates
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setProfileSuccessMessage("");
    setProfileErrorMessage("");
    setIsSavingProfile(true);

    try {
      const trimmedName = fullName.trim() || email.split('@')[0] || "User";
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPhone = phone.trim();
      const trimmedDept = department.trim();

      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setProfileErrorMessage("Please enter a valid email address.");
        setIsSavingProfile(false);
        return;
      }

      const profilePayload = {
        displayName: trimmedName,
        fullName: trimmedName,
        email: trimmedEmail,
        photoURL: photoURL || null,
        phone: trimmedPhone,
        department: trimmedDept
      };

      // 1. Update Firebase Auth Profile (Name & Photo)
      try {
        await updateProfile(currentUser, {
          displayName: trimmedName,
          photoURL: photoURL || ""
        });
      } catch (authErr) {
        console.warn("Could not update auth profile displayName/photo:", authErr);
      }

      // 2. Update Firebase Auth Email if modified
      if (currentUser.email && trimmedEmail !== currentUser.email.toLowerCase()) {
        try {
          await updateEmail(currentUser, trimmedEmail);
        } catch (emailErr: any) {
          console.warn("Direct Firebase Auth email update notification:", emailErr);
          if (emailErr.code === "auth/requires-recent-login") {
            setProfileSuccessMessage("Note: Updated email in database. Re-login is required to update Auth credentials.");
          }
        }
      }

      // 3. Update Firestore User Document
      if (navigator.onLine) {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          ...profilePayload,
          updatedAt: serverTimestamp()
        });
      } else {
        // Enqueue offline sync
        await addPendingSyncAction('UPDATE_USER_PROFILE', {
          id: currentUser.uid,
          updates: profilePayload
        });
      }

      // 4. Update Local IndexedDB
      const cachedUsers = await getUsersLocal();
      const updatedList = cachedUsers.map(u => {
        if (u.id === currentUser.uid) {
          return {
            ...u,
            displayName: trimmedName,
            fullName: trimmedName,
            email: trimmedEmail,
            photoURL: photoURL || undefined,
            phone: trimmedPhone,
            department: trimmedDept,
            updatedAt: new Date().toISOString()
          };
        }
        return u;
      });
      await saveUsersLocal(updatedList);

      // 5. Notify Parent Component
      if (onProfileUpdated) {
        onProfileUpdated({
          displayName: trimmedName,
          photoURL: photoURL || undefined,
          email: trimmedEmail
        });
      }

      setProfileSuccessMessage(
        navigator.onLine 
          ? "Profile and email details updated successfully!" 
          : "Profile saved offline! Changes will sync when reconnected."
      );

      setTimeout(() => {
        setProfileSuccessMessage("");
      }, 4000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setProfileErrorMessage(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setPasswordSuccessMessage("");
    setPasswordErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage("New passwords do not match. Please re-check.");
      return;
    }

    setIsSavingPassword(true);

    try {
      // If requires re-auth or user provided current password, re-authenticate first
      if (currentPassword && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        setRequiresReauth(false);
      }

      // Update password in Firebase Auth
      await updatePassword(currentUser, newPassword);

      // Record update timestamp and password hint in Firestore user document
      if (navigator.onLine) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, {
            password: newPassword, // Store password so admins and system can manage if configured
            lastPasswordChange: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (dbErr) {
          console.warn("Could not record password change in Firestore doc:", dbErr);
        }
      }

      setPasswordSuccessMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRequiresReauth(false);

      setTimeout(() => {
        setPasswordSuccessMessage("");
      }, 4000);
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === "auth/requires-recent-login") {
        setRequiresReauth(true);
        setPasswordErrorMessage("Security check: Please enter your current password to confirm this change.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPasswordErrorMessage("The current password entered is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setPasswordErrorMessage("The password is too weak. Please use a stronger combination.");
      } else {
        setPasswordErrorMessage(err.message || "Failed to update password.");
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "None", color: "bg-slate-200" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: "Weak", color: "bg-rose-500" };
    if (score <= 3) return { score: 2, label: "Moderate", color: "bg-amber-500" };
    return { score: 3, label: "Strong", color: "bg-emerald-500" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  if (!isOpen) return null;

  const userInitials = (fullName || currentUser?.displayName || currentUser?.email || "U")
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden z-10 my-8"
        >
          {/* Modal Header */}
          <div className="bg-slate-900 text-white p-6 sm:px-8 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>User Profile & Settings</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Manage personal details, avatar photo, and account security
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Hero Banner */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/80 px-6 sm:px-8 py-5 border-b border-slate-200 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar with Camera Overlay */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-800 flex items-center justify-center text-white text-2xl font-bold">
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt="User Profile Avatar" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                    {userInitials}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg shadow border-2 border-white transition-all cursor-pointer"
                title="Change profile picture"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-center sm:text-left flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900 truncate">
                  {fullName || currentUser?.displayName || "System User"}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                  {userRole.replace('_', ' ')}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                  Active Account
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono flex items-center justify-center sm:justify-start gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentUser?.email || "user@mtknitsm.local"}</span>
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 px-6 sm:px-8 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Personal Details & Photo</span>
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'password'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Password & Security</span>
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'permissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Role Permissions</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
            {initialLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                <p className="text-xs font-medium">Loading profile information...</p>
              </div>
            ) : activeTab === 'profile' ? (
              /* Profile Details Form */
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {profileSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{profileSuccessMessage}</span>
                  </div>
                )}
                {profileErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{profileErrorMessage}</span>
                  </div>
                )}

                {/* Avatar Uploader Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Profile Picture / Avatar
                  </label>
                  
                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-colors shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload New Photo</span>
                    </button>

                    {photoURL && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Remove Photo</span>
                      </button>
                    )}

                    <span className="text-[11px] text-slate-400">
                      JPG, PNG, WebP or GIF up to 8MB. Auto-optimized for fast offline loading.
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Saw Pyae Phyo Kyaw"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        Editable Email
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. user@mtknitsm.com"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400 font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Used for logging in, receiving system outage alerts, and account communications.
                    </p>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Department / Office
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Information Technology"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Contact Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +95 912345678"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : activeTab === 'password' ? (
              /* Change Password Form */
              <form onSubmit={handleSavePassword} className="space-y-6">
                {passwordSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{passwordSuccessMessage}</span>
                  </div>
                )}
                {passwordErrorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{passwordErrorMessage}</span>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Password Security Requirements
                  </p>
                  <p className="text-slate-500">
                    Your password protects your access to tickets, repairs, and system logs. Use at least 6 characters with a combination of letters and numbers.
                  </p>
                </div>

                {/* Optional / Required Current Password for Reauth */}
                {requiresReauth && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-amber-900">
                      Confirm Current Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-amber-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your existing password"
                        required={requiresReauth}
                        className="w-full bg-white border border-amber-300 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Password Strength:</span>
                        <span className="font-semibold text-slate-700">{passwordStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 rounded-full transition-all ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-full flex-1 rounded-full transition-all ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'}`} />
                        <div className={`h-full flex-1 rounded-full transition-all ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'}`} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-rose-500 mt-1 font-medium">
                      Passwords do not match.
                    </p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-[11px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match perfectly.
                    </p>
                  )}
                </div>

                {/* Save Password Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPassword || !newPassword || newPassword !== confirmPassword}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Permissions Summary Tab */
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Assigned Role</span>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      {userRole.replace('_', ' ')}
                    </h4>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-xs border border-blue-200 uppercase">
                    {userRole === 'admin' ? 'Full System Superuser' : 'Role-Based Access'}
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Tab & Feature Permissions
                  </h4>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                    {Object.entries(TAB_LABELS).map(([tabKey, label]) => {
                      const tabPerm = userPermissions?.[tabKey as keyof UserPermissions];
                      const canView = userRole === 'admin' || (tabPerm?.view ?? false);
                      const canEdit = userRole === 'admin' || (tabPerm?.edit ?? false);
                      const canDelete = userRole === 'admin' || (tabPerm?.delete ?? false);

                      return (
                        <div key={tabKey} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">{label}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Module: /{tabKey}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              canView ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                            }`}>
                              View
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              canEdit ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-400'
                            }`}>
                              Edit
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              canDelete ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-400'
                            }`}>
                              Delete
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center italic">
                  To request permission adjustments, contact an IT Administrator.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
