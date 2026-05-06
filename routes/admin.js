const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');

function createRouter({ JWT_SECRET }) {
  const router = express.Router();

  function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, async (err, payload) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = payload;
      try {
        const row = await db.getUserById(payload.userId);
        if (!row || row.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required' });
        }
        if (!row.is_active) {
          return res.status(403).json({ error: 'Account disabled' });
        }
        req.dbUser = row;
        next();
      } catch (e) {
        return res.status(500).json({ error: 'Auth failed' });
      }
    });
  }

  router.use(authenticateAdmin);

  router.get('/users', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
      const offset = parseInt(req.query.offset || '0', 10);
      const users = await db.listUsersForAdmin(limit, offset);
      res.json({ users });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  router.patch('/users/:id', async (req, res) => {
    try {
      const patch = {};
      const allowed = ['role', 'is_active', 'ai_daily_token_limit', 'ai_monthly_token_limit', 'ai_allowed_models'];
      for (const k of allowed) {
        if (typeof req.body[k] !== 'undefined') patch[k] = req.body[k];
      }
      const updated = await db.adminUpdateUser(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: 'User not found' });
      const { password_hash: _ph, ...safe } = updated;
      res.json(safe);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  router.get('/conversations', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '80', 10), 200);
      const offset = parseInt(req.query.offset || '0', 10);
      const userId = req.query.userId || null;
      const rows = await db.adminListAllConversations(limit, offset, userId);
      res.json({ conversations: rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
  });

  router.get('/conversations/:id', async (req, res) => {
    try {
      const conv = await db.adminGetConversation(req.params.id);
      if (!conv) return res.status(404).json({ error: 'Not found' });
      const messages = await db.listAiMessagesAsc(conv.id, 500);
      res.json({ conversation: conv, messages });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to load conversation' });
    }
  });

  router.get('/usage/summary', async (req, res) => {
    try {
      const start = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = req.query.end ? new Date(req.query.end) : new Date();
      const rows = await db.adminSumUsageByUser(start, end);
      res.json({ start, end, by_user: rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed usage summary' });
    }
  });

  router.get('/usage/export', async (req, res) => {
    try {
      const start = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = req.query.end ? new Date(req.query.end) : new Date();
      const rows = await db.adminExportUsage(start, end);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="usage-export.csv"');

      const header = ['created_at', 'user_email', 'model', 'prompt_tokens', 'completion_tokens', 'cost_usd', 'conversation_id'];
      res.write(header.join(',') + '\n');
      for (const r of rows) {
        const vals = [
          r.created_at,
          r.user_email,
          r.model,
          r.prompt_tokens,
          r.completion_tokens,
          r.cost_usd,
          r.conversation_id
        ].map((raw) => {
          const s = raw === null || typeof raw === 'undefined' ? '' : String(raw);
          return '"' + s.replace(/"/g, '""') + '"';
        });
        res.write(vals.join(',') + '\n');
      }
      res.end();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  return router;
}

module.exports = { createRouter };
