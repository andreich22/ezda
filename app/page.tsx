"use client";

import { useEffect, useState } from "react";
import MapClient from "../components/MapClient";
import { parseSidebarCollapsed, SIDEBAR_STORAGE_KEY } from "../lib/sidebar-state";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(parseSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    window.dispatchEvent(new CustomEvent("ezda:sidebar-change"));
  }, [collapsed]);

  return (
    <main className="shell">
      <header className="header">
        <div className="logo">Ezda</div>
        <span>cycling routes MVP</span>
      </header>
      <div className={`content ${collapsed ? "sidebar-collapsed" : ""}`}>
        <aside
          className="sidebar"
          aria-hidden={collapsed}
          inert={collapsed ? true : undefined}
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
