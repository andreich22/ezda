const ROUTING_MESSAGES: Record<string, string> = {
  ROUTING_REQUEST_INVALID: "Check the selected points and try again.",
  VALIDATION_ERROR: "Check the selected points and try again.",
};

const SAVE_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to save routes.",
  BODY_TOO_LARGE: "The route data is too large. Try a shorter route.",
  INVALID_JSON: "Check the title and route data, then try again.",
  VALIDATION_ERROR: "Check the title and route data, then try again.",
  SAVE_FAILED: "Couldn't save the route. Try again.",
  UPDATE_FAILED: "Couldn't save the route. Try again.",
  DELETE_FAILED: "Couldn't delete the route. Try again.",
  NOT_FOUND: "This route was not found. It may have been removed.",
  FORBIDDEN: "You don't have permission for this action.",
};

export function friendlyRoutingError(code: unknown): string {
  if (typeof code === "string" && ROUTING_MESSAGES[code]) {
    return ROUTING_MESSAGES[code];
  }
  return "Couldn't build the route. Try again or change the points.";
}

export function friendlySaveError(code: unknown): string {
  if (typeof code === "string" && SAVE_MESSAGES[code]) {
    return SAVE_MESSAGES[code];
  }
  return "Couldn't save the route. Try again.";
}
