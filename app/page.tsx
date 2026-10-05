"use client";

import { useEffect, useRef, useState } from "react";
import MapClient from "../components/MapClient";
import { parseSidebarCollapsed, SIDEBAR_STORAGE_KEY } from "../lib/sidebar-state";
import { shouldDismissMobileSidebarSwipe } from "../lib/sidebar-swipe";
import { APP_VERSION } from "../lib/app-version";
import HamburgerMenu from "../components/HamburgerMenu";
import { getUsernameFromEmail } from "../lib/user-name";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setCollapsed(parseSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)));
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setUsername(getUsernameFromEmail(body.user?.email)))
      .catch(() => setUsername(null));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    window.dispatchEvent(new CustomEvent("ezda:sidebar-change"));
  }, [collapsed]);

  const handleSidebarPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || window.innerWidth > 767) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handleSidebarPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.pointerType === "mouse" || window.innerWidth > 767) return;

    const sidebar = event.currentTarget;
    if (shouldDismissMobileSidebarSwipe({
      startX: start.x,
      startY: start.y,
      endX: event.clientX,
      endY: event.clientY,
      scrollTop: sidebar.scrollTop,
    })) {
      setCollapsed(true);
    }
  };

  return (
    <main className="shell">
      <header className="header">
        <HamburgerMenu />
        <div className="logo">Ezda</div>
        <div className="header-title">
          <span>cycling routes MVP</span>
          {username && <span className="header-username">{username}</span>}
          <span className="app-version">v{APP_VERSION}</span>
        </div>
      </header>
      <div className={`content ${collapsed ? "sidebar-collapsed" : ""}`}>
        <aside
          id="route-sidebar"
          className="sidebar"
          aria-hidden={collapsed}
          inert={collapsed ? true : undefined}
          onPointerDown={handleSidebarPointerDown}
          onPointerUp={handleSidebarPointerUp}
        >
          <h1>Build a cycling route</h1>
          <p>Click a start point and an end point on the map. The MVP asks the routing service for a bicycle route when configured; otherwise it draws a direct fallback.</p>
          <MapClient />
        </aside>
        <div className="map-wrap"><div id="map-host" className="map" /></div>
        <button
          className="sidebar-toggle"
          type="button"
          aria-controls="route-sidebar"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Open route sidebar" : "Collapse route sidebar"}
          title={collapsed ? "Open route sidebar" : "Collapse route sidebar"}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>
    </main>
  );
}
