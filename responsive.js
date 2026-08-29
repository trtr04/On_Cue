export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

export function computePhoneScale(viewportWidth, viewportHeight) {
  const width = Math.max(1, Number(viewportWidth) || PHONE_WIDTH);
  const height = Math.max(1, Number(viewportHeight) || PHONE_HEIGHT);
  return Math.min(width / PHONE_WIDTH, height / PHONE_HEIGHT);
}

export function installPhoneViewportFitting(doc = document, win = window) {
  const update = () => {
    const viewport = win.visualViewport;
    const width = viewport?.width || win.innerWidth || doc.documentElement.clientWidth;
    const height = viewport?.height || win.innerHeight || doc.documentElement.clientHeight;
    const coarsePointer = win.matchMedia?.("(pointer: coarse)").matches ?? false;
    const shouldFit = coarsePointer || Math.min(width, height) <= 820;

    doc.body.classList.toggle("mobile-fit", shouldFit);
    doc.documentElement.style.setProperty("--phone-scale", String(computePhoneScale(width, height)));
    doc.documentElement.style.setProperty("--visual-viewport-height", `${height}px`);
  };

  update();
  win.addEventListener("resize", update, { passive: true });
  win.addEventListener("orientationchange", update, { passive: true });
  win.visualViewport?.addEventListener("resize", update, { passive: true });

  return () => {
    win.removeEventListener("resize", update);
    win.removeEventListener("orientationchange", update);
    win.visualViewport?.removeEventListener("resize", update);
  };
}
