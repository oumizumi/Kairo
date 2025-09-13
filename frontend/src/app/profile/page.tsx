"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { getToken, isGuest } from "@/lib/api";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import UserAvatar from "@/components/UserAvatar";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app.config";

interface ProfileData {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  program?: string;
  banner_style?: string;
  profile_mode?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState(false);
  const [newProgram, setNewProgram] = useState("");
  const [savingProgram, setSavingProgram] = useState(false);
  const [programMessage, setProgramMessage] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [bannerStyle, setBannerStyle] = useState<string>("");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [profileMode, setProfileMode] = useState<string>("");
  const [savingMode, setSavingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState<string | null>(null);

  // Dispatch a lightweight preview event so other pages (e.g., header) update without saving
  const dispatchPreview = (partial: Partial<ProfileData>) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: partial }));
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await api.get("/api/profile/");
        setProfile(res.data as ProfileData);
        setNewEmail((res.data as ProfileData).email);
        setNewUsername((res.data as ProfileData).username || "");
        setNewProgram((res.data as ProfileData).program || "");
        setIsGuestUser(isGuest());
        setBannerStyle((res.data as ProfileData).banner_style || "");
        setProfileMode((res.data as ProfileData).profile_mode || "");
      } catch (e: any) {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="font-mono min-h-screen bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="font-mono min-h-screen bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-xl font-semibold mb-2">Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">{error || "No profile data available."}</p>
        </div>
      </div>
    );
  }

  const displayName = profile.username || profile.email;

  const handleStartEditEmail = () => {
    if (isGuestUser) return;
    setEmailMessage(null);
    setEmailError(null);
    setNewEmail(profile.email);
    setEditingEmail(true);
  };

  const handleCancelEditEmail = () => {
    setEditingEmail(false);
    setNewEmail(profile.email);
    setEmailMessage(null);
    setEmailError(null);
  };

  const handleDeleteAccount = async () => {
    if (!profile || isGuestUser) return;
    
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      
      await api.delete('/api/profile/');
      
      // Clear local storage and redirect
      localStorage.removeItem('token');
      router.push('/');
    } catch (e: any) {
      setDeleteError(e?.response?.data?.detail || e?.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isValidEmail = (val: string) => /.+@.+\..+/.test(val);

  const handleSaveEmail = async () => {
    if (!newEmail || newEmail === profile.email) {
      setEditingEmail(false);
      return;
    }
    if (!isValidEmail(newEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    setEmailMessage(null);
    setEmailError(null);
    try {
      const res = await api.patch("/api/profile/", { email: newEmail });
      const updated = res.data as ProfileData;
      setProfile(updated);
      setEditingEmail(false);
      setEmailMessage("Email updated successfully.");
    } catch (e: any) {
      setEmailError(e?.response?.data?.email?.[0] || e?.message || "Failed to update email");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleStartEditUsername = () => {
    if (isGuestUser) return;
    setUsernameMessage(null);
    setUsernameError(null);
    setNewUsername(profile.username || "");
    setEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setEditingUsername(false);
    setNewUsername(profile.username || "");
    setUsernameMessage(null);
    setUsernameError(null);
    // Revert preview back to saved username
    dispatchPreview({ username: profile.username || '' });
  };

  const handleSaveUsername = async () => {
    if (!newUsername || newUsername === profile.username) {
      setEditingUsername(false);
      return;
    }
    if (newUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setUsernameError("Username can only contain letters, numbers, and underscores.");
      return;
    }
    setSavingUsername(true);
    setUsernameMessage(null);
    setUsernameError(null);
    try {
      const res = await api.patch("/api/profile/", { username: newUsername });
      const updated = res.data as ProfileData;
      setProfile(updated);
      setEditingUsername(false);
      setUsernameMessage("Username updated successfully.");
      // Notify other pages (e.g., split view header) to refresh displayed username
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updated }));
      }
    } catch (e: any) {
      setUsernameError(e?.response?.data?.username?.[0] || e?.message || "Failed to update username");
    } finally {
      setSavingUsername(false);
    }
  };

  const saveProgram = async () => {
    setSavingProgram(true);
    setProgramMessage(null);
    setProgramError(null);
    try {
      const res = await api.patch("/api/profile/", { program: newProgram });
      const updated = res.data as ProfileData;
      setProfile(updated);
      setEditingProgram(false);
      setProgramMessage("Program updated successfully.");
    } catch (e: any) {
      setProgramError(e?.response?.data?.program?.[0] || e?.message || "Failed to update program");
    } finally {
      setSavingProgram(false);
    }
  };

  return (
    <div className="font-mono min-h-screen bg-white dark:bg-[rgb(var(--background-rgb))] text-black dark:text-[rgb(var(--text-primary))] flex flex-col">
      {/* Minimal Profile Navbar: Logo + Contact */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-[rgb(var(--border-color))] bg-white/80 dark:bg-[rgb(var(--secondary-bg))]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity" aria-label="Home">
            <Logo size={44} />
          </Link>
          <Link
            href="/contact"
            className="font-mono text-sm sm:text-base font-medium text-gray-700 dark:text-white hover:text-blue-600 dark:hover:text-indigo-400 transition-colors"
          >
            Contact
          </Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-10 flex-1 w-full">
        <div className="mb-8">
          <h1 className="font-mono text-2xl sm:text-3xl font-bold">Your Profile</h1>
          <p className="font-mono text-gray-600 dark:text-gray-400 mt-1">Manage your account information</p>
        </div>

        <div className="bg-white dark:bg-[rgb(var(--secondary-bg))] border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-xl p-6">
          <div className="mb-6 relative overflow-hidden rounded-xl">
            {/* Live banner preview behind avatar */}
            <div className={`absolute inset-0 bg-gradient-to-r ${
              (APP_CONFIG.UI.PROFILE_BANNERS.find(b => b.key === (bannerStyle || ''))?.className) || ''
            }`} />
            {/* Removed mode overlay to avoid tinting banner colors on selection */}
            <div className="relative p-4">
              <UserAvatar 
                user={{
                  ...profile,
                  username: editingUsername ? newUsername : profile.username,
                }}
                size="lg" 
                showName={true} 
                showEmail={true}
                className="w-full"
                showKawaiiBadge={false}
              />
              {(() => {
                const mode = APP_CONFIG.UI.PROFILE_MODES.find(m => m.key === (profileMode || ''));
                if (!mode || mode.key === 'none') return null;
                return (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-gray-900/70 px-2.5 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 shadow-sm">
                    <span className="text-base leading-none">{mode.emoji}</span>
                    <span>{mode.label}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Banner picker */}
          <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between">
              <div className="w-full">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Profile Banner</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {APP_CONFIG.UI.PROFILE_BANNERS.map(b => (
                    <button
                      key={b.key}
                      onClick={() => { const val = b.key === 'none' ? '' : b.key; setBannerStyle(val); dispatchPreview({ banner_style: val }); }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all h-16 ${
                        (bannerStyle || '') === (b.key === 'none' ? '' : b.key)
                          ? 'border-pink-400 shadow'
                          : 'border-gray-200 dark:border-[rgb(var(--border-color))] hover:border-pink-300'
                      }`}
                      aria-label={b.label}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${b.className}`} />
                      <div className="relative z-10 h-full w-full flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-200 backdrop-blur-[1px]">
                        {b.label}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={async () => {
                      setBannerMessage(null);
                      setSavingBanner(true);
                      try {
                        const res = await api.patch('/api/profile/', { banner_style: bannerStyle || null });
                        const updated = res.data as ProfileData;
                        setProfile(updated);
                        setBannerMessage('Banner updated.');
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updated }));
                        }
                      } catch (e: any) {
                        setBannerMessage(e?.response?.data?.detail || 'Failed to update banner');
                      } finally {
                        setSavingBanner(false);
                      }
                    }}
                    disabled={savingBanner}
                    className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50"
                  >
                    {savingBanner ? 'Saving...' : 'Save banner'}
                  </button>
                  {bannerMessage && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">{bannerMessage}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mode picker */}
          <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4 mb-6">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Profile Mode</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {APP_CONFIG.UI.PROFILE_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => { const val = m.key === 'none' ? '' : m.key; setProfileMode(val); dispatchPreview({ profile_mode: val }); }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border-2 transition-colors ${
                    (profileMode || '') === (m.key === 'none' ? '' : m.key)
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
                      : 'border-gray-200 dark:border-[rgb(var(--border-color))] hover:border-emerald-300'
                  }`}
                >
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-gray-800 dark:text-gray-200 font-medium">{m.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={async () => {
                  setModeMessage(null);
                  setSavingMode(true);
                  try {
                    const res = await api.patch('/api/profile/', { profile_mode: profileMode || null });
                    const updated = res.data as ProfileData;
                    setProfile(updated);
                    setModeMessage('Mode updated.');
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updated }));
                    }
                  } catch (e: any) {
                    setModeMessage(e?.response?.data?.detail || 'Failed to update mode');
                  } finally {
                    setSavingMode(false);
                  }
                }}
                disabled={savingMode}
                className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingMode ? 'Saving...' : 'Save mode'}
              </button>
              {modeMessage && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{modeMessage}</span>
              )}
            </div>
          </div>

          {/* Removed badge picker per request */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Username</div>
                  {!editingUsername ? (
                    <div className="text-sm">{profile.username || "—"}</div>
                  ) : (
                    <div className="mt-0.5 relative group">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => { setNewUsername(e.target.value); dispatchPreview({ username: e.target.value }); }}
                        className={`w-full rounded-lg border-2 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-[rgb(var(--text-primary))] px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 dark:focus:border-white/20 transition-all ${usernameError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-[rgb(var(--border-color))]'}`}
                        placeholder="Enter username"
                        autoFocus
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-transparent group-focus-within:ring-blue-400/30 transition"></div>
                      {usernameError && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{usernameError}</div>
                      )}
                    </div>
                  )}
                  {usernameMessage && (
                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{usernameMessage}</div>
                  )}
                </div>
                <div className="ml-3 shrink-0 flex items-start gap-2">
                  {!editingUsername ? (
                    <>
                      {!isGuestUser ? (
                        <button
                          onClick={handleStartEditUsername}
                          className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[rgb(var(--border-color))] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Guest mode (view only)</span>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveUsername}
                        disabled={savingUsername || isGuestUser}
                        className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                      >
                        {savingUsername ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditUsername}
                        disabled={savingUsername}
                        className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {isGuestUser && !editingUsername && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  To edit your username, please <a href="/signup" className="underline hover:opacity-80">create an account</a> or <a href="/login" className="underline hover:opacity-80">log in</a>.
                </div>
              )}
            </div>
            <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Email</div>
                  {!editingEmail ? (
                    <div className="text-sm break-all">{profile.email}</div>
                  ) : (
                    <div className="mt-0.5 relative group">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={`w-full rounded-lg border-2 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-[rgb(var(--text-primary))] px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 dark:focus:border-white/20 transition-all ${emailError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-[rgb(var(--border-color))]'}`}
                        placeholder="you@example.com"
                        autoFocus
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-transparent group-focus-within:ring-blue-400/30 transition"></div>
                      {emailError && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{emailError}</div>
                      )}
                    </div>
                  )}
                  {emailMessage && (
                    <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{emailMessage}</div>
                  )}
                </div>
                <div className="ml-3 shrink-0 flex items-start gap-2">
                  {!editingEmail ? (
                    <>
                      {!isGuestUser ? (
                        <button
                          onClick={handleStartEditEmail}
                          className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[rgb(var(--border-color))] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Guest mode (view only)</span>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveEmail}
                        disabled={savingEmail || isGuestUser}
                        className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                      >
                        {savingEmail ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditEmail}
                        disabled={savingEmail}
                        className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {isGuestUser && !editingEmail && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  To edit your email, please <a href="/signup" className="underline hover:opacity-80">create an account</a> or <a href="/login" className="underline hover:opacity-80">log in</a>.
                </div>
              )}
            </div>
            <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4 sm:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Program (optional)</div>
                  {!editingProgram ? (
                    <div className="text-sm">{profile.program || "—"}</div>
                  ) : (
                    <div className="mt-0.5 relative group">
                      <input
                        type="text"
                        value={newProgram}
                        onChange={(e) => setNewProgram(e.target.value)}
                        className={`w-full rounded-lg border-2 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-[rgb(var(--text-primary))] px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 dark:focus:border-white/20 transition-all ${programError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-[rgb(var(--border-color))]'}`}
                        placeholder="e.g., Computer Science BSc"
                        autoFocus
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-transparent group-focus-within:ring-blue-400/30 transition"></div>
                      {programError && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{programError}</div>
                      )}
                      {programMessage && (
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400">{programMessage}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!editingProgram ? (
                    <button
                      onClick={() => setEditingProgram(true)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={saveProgram}
                        disabled={savingProgram}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded transition-colors"
                      >
                        {savingProgram ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingProgram(false);
                          setNewProgram(profile.program || "");
                          setProgramError(null);
                          setProgramMessage(null);
                        }}
                        disabled={savingProgram}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-[rgb(var(--border-color))] rounded-lg p-4 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Password</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Change your password below.</div>
                </div>
                {!editingPassword && (
                  <button
                    disabled={isGuestUser}
                    onClick={() => { if (!isGuestUser) { setEditingPassword(true); setPwMsg(null); setPwErr(null);} }}
                    className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                )}
              </div>
              {isGuestUser && !editingPassword && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Guest mode (view only). To change your password, <a href="/signup" className="underline hover:opacity-80">create an account</a> or <a href="/login" className="underline hover:opacity-80">log in</a>.</div>
              )}
              {editingPassword && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <input
                      type={showPw1 ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="New password"
                      className="w-full rounded-lg border-2 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-[rgb(var(--text-primary))] px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 dark:focus:border-white/20 transition-all border-gray-300 dark:border-[rgb(var(--border-color))] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw1(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label={showPw1 ? 'Hide password' : 'Show password'}
                    >
                      {showPw1 ? (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22"/></svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw2 ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-lg border-2 bg-white dark:bg-[rgb(var(--secondary-bg))] text-gray-900 dark:text-[rgb(var(--text-primary))] px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400 dark:focus:border-white/20 transition-all border-gray-300 dark:border-[rgb(var(--border-color))] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw2(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label={showPw2 ? 'Hide password' : 'Show password'}
                    >
                      {showPw2 ? (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.98-5.1 5.47-6.57M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-.64 1.75-1.7 3.3-3.02 4.57M1 1l22 22"/></svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={pwLoading}
                      onClick={async () => {
                        setPwMsg(null); setPwErr(null);
                        if (!newPw || newPw.length < 8) { setPwErr('Password must be at least 8 characters.'); return; }
                        if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
                        try {
                          setPwLoading(true);
                          // Request tokens
                          const req = await api.post('/api/auth/password-reset/request/', { email: profile.email });
                          const { uidb64, token } = req.data;
                          // Confirm reset directly
                          await api.post('/api/auth/password-reset/confirm/', { uidb64, token, new_password: newPw, confirm_password: confirmPw });
                          setPwMsg('Password updated successfully.');
                          setEditingPassword(false);
                          setNewPw(''); setConfirmPw(''); setShowPw1(false); setShowPw2(false);
                        } catch (e: any) {
                          setPwErr(e?.response?.data?.detail || e?.message || 'Failed to update password');
                        } finally {
                          setPwLoading(false);
                        }
                      }}
                      className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {pwLoading ? 'Saving...' : 'Save password'}
                    </button>
                    <button
                      disabled={pwLoading}
                      onClick={() => { setEditingPassword(false); setNewPw(''); setConfirmPw(''); setPwErr(null); setPwMsg(null); }}
                      className="font-mono text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {pwMsg && <div className="text-xs text-emerald-600 dark:text-emerald-400">{pwMsg}</div>}
                  {pwErr && <div className="text-xs text-red-600 dark:text-red-400">{pwErr}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone - Delete Account */}
          {!isGuestUser && (
            <div className="mt-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setDeleteError(null);
                      }}
                      className="font-mono text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Are you absolutely sure?</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          This will permanently delete your account, including:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1 mb-4">
                          <li>Your profile information</li>
                          <li>All saved schedules and calendar events</li>
                          <li>Account preferences and settings</li>
                        </ul>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          This action cannot be undone.
                        </p>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteLoading}
                          className="font-mono text-sm font-medium px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteError(null);
                          }}
                          disabled={deleteLoading}
                          className="font-mono text-sm font-medium px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      {deleteError && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          {deleteError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}


