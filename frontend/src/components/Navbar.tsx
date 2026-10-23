import React from 'react';
import { User, AcknowledgementRecord, RolePermissions, UserRole } from '../types';
import {
  BookOpen,
  Bell,
  Shield,
  HelpCircle,
  Bot,
  ChevronDown,
  Key,
  LogOut,
  LogIn,
  History,
  UserCog,
  Link2,
  Loader2,
  Check,
  Sparkles,
  Smartphone,
  PenLine,
  Menu,
  X,
} from 'lucide-react';
import { linkTelegramService } from '../utils/services';
import { TelegramLinkModes } from './TelegramLinkModes';
import { APP_LOGO, APP_TITLE, APP_BADGE } from '../utils/appIdentity';

interface NavbarProps {
  activeTab: 'handbook' | 'memos' | 'hr-queue' | 'workflow' | 'telegram-config' | 'access-control' | 'audit-log';
  setActiveTab: (tab: 'handbook' | 'memos' | 'hr-queue' | 'workflow' | 'telegram-config' | 'access-control' | 'audit-log') => void;
  currentUser: User | null;
  acknowledgements: AcknowledgementRecord[];
  rolePermissions: Record<UserRole, RolePermissions>;
  onOpenSignIn: () => void;
  onSignOut: () => void;
  onEditProfile: () => void;
  onTelegramLinked?: (updated: User) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenReadiness?: () => void;
  onOpenTelegramTest?: () => void;
  /** Opens the electronic signature capture (draw or upload). */
  onOpenSignature?: () => void;
}

type LinkState =
  | { phase: 'idle' }
  | { phase: 'waiting'; url: string }
  | { phase: 'linked'; handle: string | null }
  | { phase: 'error'; message: string };

const NavbarBase: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  acknowledgements,
  rolePermissions,
  onOpenSignIn,
  onSignOut,
  onEditProfile,
  onTelegramLinked,
  searchQuery,
  setSearchQuery,
  onOpenReadiness,
  onOpenTelegramTest,
  onOpenSignature,
}) => {
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const [linkState, setLinkState] = React.useState<LinkState>({ phase: 'idle' });
  const [linkMenuOpen, setLinkMenuOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pollRef = React.useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = React.useCallback(() => {
    stopPolling();
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const check = await linkTelegramService.check();
        if (check.status === 'linked') {
          const handle = check.link?.telegramUsername ?? null;
          const adoptedHandle = check.user?.telegramHandle;
          setLinkState({ phase: 'linked', handle });
          stopPolling();
          if (adoptedHandle && onTelegramLinked && currentUser) {
            onTelegramLinked({ ...currentUser, telegramHandle: adoptedHandle } as User);
          }
          return;
        }
      } catch {
        // Transient poll failure — keep waiting until the timeout budget is spent.
      }
      if (attempts >= 30) {
        setLinkState((prev) => (prev.phase === 'waiting' ? { phase: 'idle' } : prev));
        return;
      }
      pollRef.current = window.setTimeout(tick, 2000);
    };
    pollRef.current = window.setTimeout(tick, 2000);
  }, [currentUser, onTelegramLinked]);

  // Clean up any in-flight polling when the user changes or the header unmounts.
  React.useEffect(() => {
    // Admins connect Telegram from Bot Setup ("Link Telegram"), so they have
    // no self-service link and we skip the status request entirely.
    if (!currentUser || currentUser.role === 'admin') {
      stopPolling();
      setLinkState({ phase: 'idle' });
      setLinkMenuOpen(false);
      return;
    }
    setLinkMenuOpen(false);
    let cancelled = false;
    linkTelegramService
      .me()
      .then(({ link }) => {
        if (cancelled) return;
        setLinkState(
          link.status === 'linked'
            ? { phase: 'linked', handle: link.telegramUsername }
            : { phase: 'idle' }
        );
      })
      .catch(() => {
        if (!cancelled) setLinkState({ phase: 'idle' });
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  React.useEffect(() => stopPolling, []);

  // Mobile drawer: lock the page behind it and allow Escape to close.
  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  // Header dropdowns: close when clicking anywhere outside them, or on Escape.
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);
  const linkMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!profileMenuOpen && !linkMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (profileMenuOpen && !profileMenuRef.current?.contains(target)) {
        setProfileMenuOpen(false);
      }
      if (linkMenuOpen && !linkMenuRef.current?.contains(target)) {
        setLinkMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setProfileMenuOpen(false);
      setLinkMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileMenuOpen, linkMenuOpen]);

  const handleLinkClick = async () => {
    if (linkState.phase === 'linked') {
      setLinkMenuOpen((open) => !open);
      return;
    }
    if (linkState.phase === 'waiting') return;
    setLinkState({ phase: 'idle' });
    setLinkMenuOpen(false);
    try {
      const { link } = await linkTelegramService.me();
      if (link.status === 'linked') {
        setLinkState({ phase: 'linked', handle: link.telegramUsername });
        return;
      }
      setLinkState({ phase: 'waiting', url: link.url });
      window.open(link.url, '_blank', 'noopener');
      startPolling();
    } catch (err) {
      setLinkState({ phase: 'error', message: err instanceof Error ? err.message : 'Unable to start Telegram linking.' });
    }
  };

  const handleUnlink = async () => {
    setLinkMenuOpen(false);
    try {
      await linkTelegramService.unlink();
    } catch {
      // The link is still cleared locally so the button falls back to idle.
    }
    setLinkState({ phase: 'idle' });
    // Update the live session so the now-cleared Telegram handle disappears everywhere.
    if (onTelegramLinked && currentUser) {
      onTelegramLinked({ ...currentUser, telegramHandle: '' } as User);
    }
  };

  const linkButtonLabel =
    linkState.phase === 'waiting' ? 'Waiting…' : linkState.phase === 'linked' ? 'LINKED' : 'LINK Telegram';

  const linkButtonClasses =
    linkState.phase === 'linked'
      ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600/20'
      : linkState.phase === 'waiting'
      ? 'bg-amber-50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      : 'bg-sky-600/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-600/20';

  const userRole: UserRole = currentUser?.role || 'staff';
  const currentPerms = rolePermissions[userRole] || {
    canViewHandbook: true,
    canViewAllStaffStatus: false,
    canVerifyAcknowledgements: false,
    canCreateMemos: false,
    canUploadDocuments: false,
    canManageTelegramBot: false,
    canManageUsersAndRoles: false,
    canExportAuditLogs: false,
  };

  // Calculate personal pending count for staff
  const myPendingAcks = currentUser
    ? acknowledgements.filter(
        (a) => a.staffId === currentUser.id && a.status !== 'HR Verified'
      ).length
    : 0;

  // HR pending verifications
  const hrPendingVerifications = acknowledgements.filter(
    (a) => a.status === 'Submitted' || a.status === 'In Review'
  ).length;

  const linkClass = (isActive: boolean, activeAccent = 'indigo') => {
    const accents: Record<string, string> = {
      indigo: 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs',
      emerald: 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs',
      sky: 'bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400',
    };
    return `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
      isActive
        ? accents[activeAccent] || accents.indigo
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
    }`;
  };

  const badgeClass = 'inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white rounded-full whitespace-nowrap';

  type NavTab = NavbarProps['activeTab'];

  // Single source of truth for the desktop nav row and the mobile drawer.
  type NavItem = {
    group: 'main' | 'manage';
    tab: NavTab;
    label: string;
    icon: React.ReactNode;
    accent?: 'indigo' | 'emerald' | 'sky';
    badge?: number;
    badgeTone?: string;
    show?: boolean;
    title?: string;
  };

  const allNavItems: NavItem[] = [
    { group: 'main', tab: 'handbook', label: 'Handbook', icon: <BookOpen className="w-4 h-4" /> },
    {
      group: 'main',
      tab: 'memos',
      label: userRole === 'staff' ? 'My Memos' : 'Company Memos',
      icon: <Bell className="w-4 h-4" />,
      badge: userRole === 'staff' && myPendingAcks > 0 ? myPendingAcks : undefined,
      badgeTone: 'bg-amber-500',
    },
    {
      group: 'manage',
      tab: 'hr-queue',
      label: 'HR Verification Queue',
      icon: <Shield className="w-4 h-4 text-purple-500" />,
      badge: hrPendingVerifications > 0 ? hrPendingVerifications : undefined,
      badgeTone: 'bg-indigo-600',
      show: currentPerms.canVerifyAcknowledgements,
    },
    {
      group: 'manage',
      tab: 'access-control',
      label: 'Staff & Access Limits',
      icon: <Key className="w-4 h-4 text-amber-500" />,
      show: currentPerms.canManageUsersAndRoles || userRole === 'admin' || userRole === 'hr',
      title: 'Credential & Access Limit Management (RBAC)',
    },
    {
      group: 'manage',
      tab: 'audit-log',
      label: 'Audit Log',
      icon: <History className="w-4 h-4 text-violet-500" />,
      show: currentPerms.canExportAuditLogs || userRole === 'admin' || userRole === 'hr',
      title: 'System Audit Log & Event Ledger',
    },
    {
      group: 'main',
      tab: 'workflow',
      label: 'Status Flow',
      icon: <HelpCircle className="w-4 h-4 text-emerald-500" />,
      accent: 'emerald',
    },
    {
      group: 'manage',
      tab: 'telegram-config',
      label: 'Bot Setup',
      icon: <Bot className="w-4 h-4 text-sky-500" />,
      accent: 'sky',
      show: currentPerms.canManageTelegramBot,
    },
  ];
  const navItems = allNavItems.filter((item) => item.show !== false);

  // Shared by the header button and the mobile drawer copy of the same action.
  const resolveLinkUrl = async () => {
    const { link } = await linkTelegramService.me();
    if (!link.url) throw new Error('No Telegram link available yet — try again in a moment.');
    return link.url;
  };

  // Photo avatars are gone everywhere — show the user's initials instead.
  const userInitials = (currentUser?.name || '?')
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1 — Brand and account actions */}
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title -> APA Policy & Memo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 font-black tracking-tight text-xs">
              {APP_LOGO}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white tracking-tight text-lg">
                  {APP_TITLE}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hidden sm:inline-block">
                  {APP_BADGE}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Official Company Policies &amp; Staff Directives &bull; Read, Agree &amp; Follow
              </p>
            </div>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2.5">
            {/* Link Telegram (all signed-in users except admin) — one-click /start connect or scan */}
            {currentUser && currentUser.role !== 'admin' && (
              <TelegramLinkModes
                layout="inline"
                className="hidden md:flex"
                resolveUrl={resolveLinkUrl}
                onQrActive={startPolling}
                resetSignal={linkState.phase === 'linked'}
                hideQr={linkState.phase === 'linked'}
                qrCaption="Scan with your phone camera, then press Start in Telegram."
                panelClassName="absolute right-0 top-full mt-2 z-50 w-56"
              >
              <div ref={linkMenuRef} className="relative">
                <button
                  onClick={handleLinkClick}
                  disabled={linkState.phase === 'waiting'}
                  title={
                    linkState.phase === 'error'
                      ? linkState.message
                      : linkState.phase === 'linked'
                      ? `Linked to ${linkState.handle || 'Telegram'}`
                      : linkState.phase === 'waiting'
                      ? 'Tap the link you opened in Telegram and press Start.'
                      : 'Connect your Telegram account'
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    linkButtonClasses
                  } ${linkState.phase === 'waiting' ? 'cursor-wait' : 'cursor-pointer'}`}
                >
                  {linkState.phase === 'waiting' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : linkState.phase === 'linked' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  <span>{linkButtonLabel}</span>
                  {linkState.phase === 'linked' && linkState.handle && (
                    <span className="max-w-[9rem] truncate font-mono">{linkState.handle}</span>
                  )}
                </button>

                {linkState.phase === 'linked' && linkMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-3 z-50 apa-fade-in zoom-in-95">
                    <div className="px-4 pb-2 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {linkState.handle || 'Telegram'}
                      </span>
                      <span> is connected. Acknowledgement pings are sent to this account.</span>
                    </div>
                    <div className="px-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={handleUnlink}
                        className="w-full text-left px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-medium transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Unlink Telegram</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </TelegramLinkModes>
            )}

            {/* User Profile Menu */}
            {currentUser ? (
              <div ref={profileMenuRef} className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left"
                >
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-indigo-500/20 shrink-0 select-none"
                  >
                    {userInitials}
                  </span>
                  <div className="hidden sm:block text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{currentUser.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                          currentUser.role === 'admin'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : currentUser.role === 'hr'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                            : currentUser.role === 'manager'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {currentUser.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {currentUser.department}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {/* Profile Card & Session Menu (NO SWITCH ACCOUNT, NO DEMO BUTTONS) */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-3 z-50 apa-fade-in zoom-in-95">
                    <div className="px-4 pb-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-xs font-bold flex items-center justify-center ring-1 ring-slate-200 dark:ring-slate-700 shrink-0 select-none"
                      >
                        {userInitials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {currentUser.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono truncate">
                          {currentUser.telegramHandle}
                        </div>
                      </div>
                    </div>

                    <div className="p-2 text-xs space-y-1">
                      {currentUser.role === 'admin' && onOpenReadiness && (
                        <button
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenReadiness();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2 font-medium transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Workspace Readiness &amp; Mode</span>
                        </button>
                      )}
                      {/* Admin manages accounts from Staff & Access Limits, so they get no self-edit entry. */}
                      {currentUser.role !== 'admin' && (
                        <button
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onEditProfile();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-2 font-medium transition-colors"
                        >
                          <UserCog className="w-4 h-4" />
                          <span>Edit Profile</span>
                        </button>
                      )}

                      {/* Electronic signature — printed on the acknowledgement proof PDF. */}
                      {onOpenSignature && (
                        <button
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenSignature();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-2 font-medium transition-colors"
                        >
                          <PenLine className="w-4 h-4" />
                          <span>Electronic Signature</span>
                        </button>
                      )}

                      {/* Option C — employee self-service Telegram 2FA handshake test */}
                      {onOpenTelegramTest && (
                        <button
                          onClick={() => {
                            setProfileMenuOpen(false);
                            onOpenTelegramTest();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-2 font-medium transition-colors"
                        >
                          <Smartphone className="w-4 h-4 text-sky-500" />
                          <span>Test Telegram 2FA Link</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 font-medium transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile menu trigger — the nav row below collapses into a drawer */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Row 2 — Navigation Links with STRICT ACCESS LIMITS (desktop) */}
        <nav className="hidden md:flex items-center gap-1 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              title={item.title}
              className={linkClass(activeTab === item.tab, item.accent)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge ? (
                <span className={`${badgeClass} ${item.badgeTone || 'bg-amber-500'}`}>{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>
    </header>

      {/* Mobile — slide-over drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm md:hidden apa-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 w-[88%] max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col md:hidden apa-slide-in-right"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white font-black tracking-tight text-[10px]">
                  {APP_LOGO}
                </div>
                <span className="font-bold text-slate-900 dark:text-white">Menu</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signed-in summary */}
            {currentUser && (
              <div className="px-4 pt-4 shrink-0">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60">
                  <span
                    aria-hidden="true"
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-indigo-500/20 shrink-0 select-none"
                  >
                    {userInitials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.department}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase whitespace-nowrap ${
                      userRole === 'admin'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : userRole === 'hr'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                        : userRole === 'manager'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {userRole}
                  </span>
                </div>
              </div>
            )}

            {/* Nav items, grouped */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {(['main', 'manage'] as const).map((group) => {
                const items = navItems.filter((item) => item.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {group === 'main' ? 'Explore' : 'Management'}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const isActive = activeTab === item.tab;
                        return (
                          <button
                            key={item.tab}
                            onClick={() => {
                              setActiveTab(item.tab);
                              setMobileMenuOpen(false);
                            }}
                            title={item.title}
                            className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {item.icon}
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge ? (
                              <span className={`${badgeClass} ${item.badgeTone || 'bg-amber-500'}`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Telegram connection lives here on mobile (hidden from the header) */}
              {currentUser && currentUser.role !== 'admin' && (
                <div>
                  <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Telegram
                  </div>
                  <TelegramLinkModes
                    layout="stack"
                    resolveUrl={resolveLinkUrl}
                    onQrActive={startPolling}
                    resetSignal={linkState.phase === 'linked'}
                    hideQr={linkState.phase === 'linked'}
                    qrCaption="Scan with your phone camera, then press Start in Telegram."
                  >
                    <button
                      type="button"
                      onClick={handleLinkClick}
                      disabled={linkState.phase === 'waiting'}
                      className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl border text-sm font-bold whitespace-nowrap transition-all ${
                        linkButtonClasses
                      } ${linkState.phase === 'waiting' ? 'cursor-wait' : 'cursor-pointer'}`}
                    >
                      {linkState.phase === 'waiting' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : linkState.phase === 'linked' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      <span>{linkButtonLabel}</span>
                    </button>
                  </TelegramLinkModes>
                </div>
              )}
            </nav>

            {/* Drawer footer actions */}
            <div
              className="border-t border-slate-100 dark:border-slate-800 p-3 shrink-0 space-y-1.5"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            >
              {currentUser ? (
                <>
                  {currentUser.role !== 'admin' && onEditProfile && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onEditProfile();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 whitespace-nowrap transition-colors"
                    >
                      <UserCog className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                  {onOpenSignature && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenSignature();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 whitespace-nowrap transition-colors"
                    >
                      <PenLine className="w-4 h-4" />
                      <span>Electronic Signature</span>
                    </button>
                  )}
                  {onOpenTelegramTest && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenTelegramTest();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-sky-500" />
                      <span>Test Telegram 2FA Link</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenSignIn();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-3 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export const Navbar = React.memo(NavbarBase);
