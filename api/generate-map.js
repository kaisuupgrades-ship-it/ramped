// api/generate-map.js — disabled (public access removed)
// This endpoint is no longer exposed. All roadmaps are generated
// via the post-booking questionnaire flow (api/questionnaire.js).

export default function handler(req, res) {
  return res.status(410).json({ error: 'This endpoint is no longer available.' });
}
