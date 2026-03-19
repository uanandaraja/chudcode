const timeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string) {
  return timeFormatter.format(new Date(value));
}

export function formatRelativeExpiry(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  const minutes = Math.round(ms / 60000);

  if (minutes <= 1) {
    return "expires soon";
  }

  if (minutes < 60) {
    return `expires in ${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  return `expires in ${hours}h`;
}
