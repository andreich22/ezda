"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { APP_MENU_ITEMS, AUTHENTICATED_APP_MENU_ITEMS } from "../lib/app-menu";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session", {cache: "no-store"})
      .then((response) => response.json())
      .then((body) => setAuthenticated(Boolean(body.user)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const items = authenticated
    ? [...APP_MENU_ITEMS.filter((item) => item.label !== "Sign in"), ...AUTHENTICATED_APP_MENU_ITEMS]
    : APP_MENU_ITEMS;

  return (
    <div className="hamburger-menu" ref={menuRef}>
      <button
        type="button"
        className="hamburger-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="app-navigation-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="hamburger-icon">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <nav id="app-navigation-menu" className="hamburger-panel" aria-label="Main navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hamburger-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
