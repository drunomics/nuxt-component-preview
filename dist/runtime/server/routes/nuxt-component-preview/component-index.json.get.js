import { readFileSync } from "node:fs";
import { defineEventHandler, setHeader, createError } from "h3";
import configPath from "#nuxt-component-preview-config-path";
export default defineEventHandler(async (event) => {
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const { prepareComponentIndex } = await import("../../utils/prepareComponentIndex.js");
  const componentIndexData = prepareComponentIndex(config);
  if (!componentIndexData) {
    throw createError({
      statusCode: 500,
      message: "Component index generation failed."
    });
  }
  setHeader(event, "Content-Type", "application/json");
  setHeader(event, "Cache-Control", "private, must-revalidate, max-age=0");
  return componentIndexData;
});
