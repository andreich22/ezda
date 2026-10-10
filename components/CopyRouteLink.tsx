"use client";

import {useEffect, useRef, useState} from "react";
import {buildRouteShareUrl, copyTextToClipboard} from "../lib/route-share";

type Props = {
  path: string;
};

export default function CopyRouteLink({path}: Props) {
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showFeedback(message: string, isError: boolean) {
    setFeedback(message);
    setFailed(isError);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(""), 2600);
  }

  async function handleCopy() {
    const url =
      typeof window !== "undefined" && window.location?.origin
        ? buildRouteShareUrl(path, window.location.origin)
        : buildRouteShareUrl(path);
    const result = await copyTextToClipboard(url);
    if (result.ok) {
      showFeedback("Link copied to clipboard", false);
    } else {
      showFeedback("Copy failed. Copy the address from the browser bar.", true);
    }
  }

  return (
    <div className="route-share">
      <button
        type="button"
        className="button route-share-button"
        onClick={handleCopy}
        aria-label="Copy link to route"
      >
        Copy link
      </button>
      {feedback && (
        <div className={failed ? "error" : "hint"} role="status" aria-live="polite">
          {feedback}
        </div>
      )}
    </div>
  );
}
