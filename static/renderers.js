import { renderEntity as renderStorybookEntity } from "./templates.js";
import { ART_STYLES } from "./art_schema.js";

export function renderArtworkEntity(entity, style = "storybook") {
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");
  const rendered = renderStorybookEntity(entity);
  rendered.setAttribute("data-renderer", style);
  rendered.setAttribute("data-semantic-entity", entity.templateId);
  return rendered;
}
