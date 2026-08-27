import { z } from "zod";
import { METHOD_IDS } from "./types";
import { isRecipeId } from "./recipes";

const methodOrAuto = z.enum([...METHOD_IDS, "auto"]);

export const generateSchema = z.object({
  theme: z.string().min(2).max(200),
  durationSec: z.number().int().min(30).max(1200).optional(),
  methods: z.array(methodOrAuto).optional(),
  recipeId: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === "auto" || isRecipeId(v), "unknown recipe"),
  affirmationCount: z.number().int().min(8).max(120).optional(),
  name: z.string().max(120).optional(),
  includeStills: z.boolean().optional(),
  renderAudio: z.boolean().optional(),
});

export type GenerateBody = z.infer<typeof generateSchema>;
