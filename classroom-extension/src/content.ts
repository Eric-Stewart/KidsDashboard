import { extractPage } from "./extractor";
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    sender.id !== chrome.runtime.id ||
    message?.type !== "READ_VISIBLE_CLASSROOM"
  )
    return;
  try {
    reply({ ok: true, data: extractPage(document, location.href) });
  } catch (error) {
    reply({
      ok: false,
      error:
        error instanceof Error ? error.message : "STRUCTURE_NOT_RECOGNIZED",
    });
  }
});
