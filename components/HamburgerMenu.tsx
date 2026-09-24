"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { APP_MENU_ITEMS } from "../lib/app-menu";

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          {APP_MENU_ITEMS.map((item) => (
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
