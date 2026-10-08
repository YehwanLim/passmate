import { requireActiveApplicationUser } from "../../lib/auth.js";
import prisma from "../../lib/prisma.js";
import {
  handleRequestError,
  requestIdFor,
  sendMethodNotAllowed,
} from "../../lib/request-errors.js";
import { createSiteNoticesHandler } from "../../lib/site-notices.js";
import { createSiteVisitHandler } from "../../lib/site-visits.js";

// Vercel Hobby 함수 제한(12개) 때문에 익명 방문 핑(POST /api/visits)과 공개 공지(GET /api/notices)는
// 이 함수에 `?visit=1`·`?notices=1` 로 얹는다. vercel.json rewrite 와 vite.config.ts 의 apiRoute 가 같은 쿼리를 붙인다.
const siteVisitHandler = createSiteVisitHandler();
const siteNoticesHandler = createSiteNoticesHandler();

export default async function handler(req, res) {
  if (req.query?.visit === "1") return siteVisitHandler(req, res);
  if (req.query?.notices === "1") return siteNoticesHandler(req, res);

  const requestId = requestIdFor(req);

  try {
    const { applicationUser } = await requireActiveApplicationUser(req, prisma);
    if (req.method !== "GET") {
      return sendMethodNotAllowed(res, requestId);
    }
    return res.status(200).json({
      id: applicationUser.id,
      role: applicationUser.role,
      deletionPending: false,
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/auth/me");
  }
}
