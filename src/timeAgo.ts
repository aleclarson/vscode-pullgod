export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval >= 1) {
    const count = Math.floor(interval);
    return count + (count === 1 ? " year ago" : " years ago");
  }
  interval = seconds / 2592000;
  if (interval >= 1) {
    const count = Math.floor(interval);
    return count + (count === 1 ? " month ago" : " months ago");
  }
  interval = seconds / 86400;
  if (interval >= 1) {
    const count = Math.floor(interval);
    return count + (count === 1 ? " day ago" : " days ago");
  }
  interval = seconds / 3600;
  if (interval >= 1) {
    const count = Math.floor(interval);
    return count + (count === 1 ? " hour ago" : " hours ago");
  }
  interval = seconds / 60;
  if (interval >= 1) {
    const count = Math.floor(interval);
    return count + (count === 1 ? " minute ago" : " minutes ago");
  }

  if (seconds < 10) return "just now";

  return Math.floor(seconds) + " seconds ago";
}
