import { defineEventHandler, sendRedirect, createError } from "h3";
import entryPath from "#nuxt-entry-path";
export default defineEventHandler(async (event) => {
  if (!entryPath) {
    throw createError({
      statusCode: 500,
      statusMessage: "CRITICAL: Nuxt entry path not configured."
    });
  }
  await sendRedirect(event, entryPath, 302);
});
