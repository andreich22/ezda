"use client";

import {useRouter} from "next/navigation";
import {useEffect, useRef, useState} from "react";

type Props = {
  routeId: string;
};

// Two-step delete: the first click only arms the confirmation, the second
// click performs the DELETE. Nothing is destructive on a single press.
export default function DeleteRouteButton({routeId}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function armConfirmation() {
    setError("");
    setConfirming(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Disarm after a while so a stale armed button cannot surprise anyone.
    timerRef.current = setTimeout(() => setConfirming(false), 8000);
  }

  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    setError("");
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/routes/${routeId}`, {method: "DELETE"});
      if (response.status === 204) {
        router.push("/routes");
        router.refresh();
        return;
      }
      setDeleting(false);
      setConfirming(false);
      if (response.status === 401) setError("Please sign in to delete routes.");
      else if (response.status === 403 || response.status === 404)
        setError("This route is no longer available.");
      else setError("Unable to delete the route. Please try again.");
    } catch {
      setDeleting(false);
      setConfirming(false);
      setError("Network error. Please try again.");
    }
  }

  if (!confirming) {
    return (
      <div className="route-delete">
        <button
          type="button"
          className="route-delete-button"
          onClick={armConfirmation}
          aria-label="Delete route"
        >
          Delete route
        </button>
        {error && (
          <div className="error" role="status" aria-live="polite">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="route-delete">
      <p className="route-delete-prompt" role="alert">
        Delete this route permanently? This cannot be undone.
      </p>
      <div className="route-delete-actions">
        <button
          type="button"
          className="route-delete-confirm"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Confirm route deletion"
        >
          {deleting ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          type="button"
          className="route-delete-cancel"
          onClick={cancel}
          disabled={deleting}
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="error" role="status" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
}
