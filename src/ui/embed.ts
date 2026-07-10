declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadEmbedScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("embed script failed to load"));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

function fallback(container: HTMLElement, url: string): void {
  container.innerHTML = `
    <div class="embed-fallback">
      <div>Preview unavailable.</div>
      <a href="${url}" target="_blank" rel="noopener noreferrer">Open on Instagram ↗</a>
    </div>`;
}

export function renderEmbed(container: HTMLElement, url: string): void {
  container.innerHTML = `<div class="embed-skeleton">loading…</div>`;

  let done = false;
  const timeout = setTimeout(() => {
    if (!done) { done = true; fallback(container, url); }
  }, 8000);

  loadEmbedScript()
    .then(() => {
      if (done) return;
      container.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-captioned="false" data-instgrm-version="14"></blockquote>`;
      window.instgrm?.Embeds.process();
      done = true;
      clearTimeout(timeout);
    })
    .catch(() => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      fallback(container, url);
    });
}
