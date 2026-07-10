import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500-italic.css";
import "@fontsource/fraunces/900.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "../theme.css";
import "./tutorial.css";

const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".t-nav-inner a[data-nav]"));
const sections = navLinks
  .map((link) => document.getElementById(link.dataset.nav!))
  .filter((el): el is HTMLElement => el !== null);

function setActive(id: string): void {
  for (const link of navLinks) {
    link.classList.toggle("active", link.dataset.nav === id);
  }
}

if (sections.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    },
    { rootMargin: "-46px 0px -70% 0px", threshold: 0 }
  );
  for (const section of sections) observer.observe(section);
}

// ---- Export stepper ----

const STEP_KEY = "atlas.tutorial.steps";
const STEP_COUNT = 7;

function loadSteps(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STEP_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSteps(steps: Record<string, boolean>): void {
  localStorage.setItem(STEP_KEY, JSON.stringify(steps));
}

const stepper = document.getElementById("stepper");
if (stepper) {
  let steps = loadSteps();
  const checkboxes = Array.from(
    stepper.querySelectorAll<HTMLInputElement>("input[data-step-check]")
  );
  const progressCount = document.getElementById("t-progress-count");
  const progressFill = document.getElementById("t-progress-fill");

  function updateProgress(): void {
    const done = checkboxes.filter((cb) => steps[cb.dataset.stepCheck!]).length;
    if (progressCount) progressCount.textContent = `${done} / ${STEP_COUNT}`;
    if (progressFill) progressFill.style.width = `${(done / STEP_COUNT) * 100}%`;
  }

  function applyState(): void {
    for (const cb of checkboxes) {
      const n = cb.dataset.stepCheck!;
      const isDone = !!steps[n];
      cb.checked = isDone;
      cb.closest(".step")?.classList.toggle("done", isDone);
    }
    updateProgress();
  }

  applyState();

  for (const cb of checkboxes) {
    cb.addEventListener("change", () => {
      const n = cb.dataset.stepCheck!;
      if (cb.checked) {
        steps[n] = true;
        const nextStep = stepper.querySelector<HTMLDetailsElement>(
          `.step[data-step="${Number(n) + 1}"] .step-body`
        );
        if (nextStep) nextStep.open = true;
      } else {
        delete steps[n];
      }
      saveSteps(steps);
      applyState();
    });
  }

  const resetBtn = document.getElementById("t-reset");
  resetBtn?.addEventListener("click", () => {
    steps = {};
    saveSteps(steps);
    applyState();
    for (const details of stepper.querySelectorAll<HTMLDetailsElement>(".step-body")) {
      details.open = (details.closest(".step") as HTMLElement | null)?.dataset.step === "1";
    }
  });
}

// ---- Scroll reveal ----

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealEls = document.querySelectorAll<HTMLElement>(".reveal");
if (reduceMotion) {
  for (const el of revealEls) el.classList.add("in-view");
} else {
  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          obs.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
  );
  for (const el of revealEls) revealObserver.observe(el);
}
