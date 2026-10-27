import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";
import { sendRequestError } from "../request-errors.js";
import { PROMPT_TYPES, mapPrompt } from "./prompts.js";

export default createAdminHandler({ route: "api/admin/prompts/[id]", methods: ["GET", "PATCH"] }, async ({ req, requestId, res }) => {
  if (req.method === "GET") {
    const id = String(req.query?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendRequestError(res, 400, requestId);
    const prompt = await prisma.promptTemplate.findUnique({ where: { id } });
    return prompt ? res.status(200).json({ prompt: mapPrompt(prompt) }) : sendRequestError(res, 404, requestId);
  }
  const id = String(req.query?.id ?? "");
  const promptType = req.body?.promptType;
  if (!/^[0-9a-f-]{36}$/i.test(id) || req.body?.action !== "activate" || !PROMPT_TYPES.has(promptType)) return sendRequestError(res, 400, requestId);
  const prompt = await prisma.$transaction(async (tx) => {
    const target = await tx.promptTemplate.findFirst({ where: { id, promptType }, select: { id: true } });
    if (!target) {
      const error = new Error("Prompt not found");
      error.statusCode = 404;
      throw error;
    }
    await tx.promptTemplate.updateMany({ where: { promptType }, data: { isActive: false } });
    return tx.promptTemplate.update({ where: { id }, data: { isActive: true } });
  });
  return res.status(200).json({ prompt: mapPrompt(prompt) });
});
