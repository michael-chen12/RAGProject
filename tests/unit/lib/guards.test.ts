import { requireRole } from '@/lib/auth/guards'

/**
 * Tests for requireRole — 9 cases covering all role × required combinations.
 * Role order: viewer(0) < agent(1) < admin(2)
 */
describe('requireRole', () => {
  // ── admin role ──────────────────────────────────────────────────────────
  describe('when membership is admin', () => {
    it('allows access when required is admin', () => {
      expect(() => requireRole('admin', 'admin')).not.toThrow()
    })
    it('allows access when required is agent', () => {
      expect(() => requireRole('admin', 'agent')).not.toThrow()
    })
    it('allows access when required is viewer', () => {
      expect(() => requireRole('admin', 'viewer')).not.toThrow()
    })
  })

  // ── agent role ──────────────────────────────────────────────────────────
  describe('when membership is agent', () => {
    it('throws 403 when required is admin', () => {
      expect(() => requireRole('agent', 'admin')).toThrow()
      try {
        requireRole('agent', 'admin')
      } catch (e) {
        expect(e).toBeInstanceOf(Response)
        expect((e as Response).status).toBe(403)
      }
    })
    it('allows access when required is agent', () => {
      expect(() => requireRole('agent', 'agent')).not.toThrow()
    })
    it('allows access when required is viewer', () => {
      expect(() => requireRole('agent', 'viewer')).not.toThrow()
    })
  })

  // ── viewer role ──────────────────────────────────────────────────────────
  describe('when membership is viewer', () => {
    it('throws 403 when required is admin', () => {
      expect(() => requireRole('viewer', 'admin')).toThrow()
      try {
        requireRole('viewer', 'admin')
      } catch (e) {
        expect(e).toBeInstanceOf(Response)
        expect((e as Response).status).toBe(403)
      }
    })
    it('throws 403 when required is agent', () => {
      expect(() => requireRole('viewer', 'agent')).toThrow()
      try {
        requireRole('viewer', 'agent')
      } catch (e) {
        expect(e).toBeInstanceOf(Response)
        expect((e as Response).status).toBe(403)
      }
    })
    it('allows access when required is viewer', () => {
      expect(() => requireRole('viewer', 'viewer')).not.toThrow()
    })
  })
})
