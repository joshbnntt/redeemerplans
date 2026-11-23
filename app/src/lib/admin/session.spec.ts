import { describe, expect, it, vi } from 'vitest';

// Fake the Supabase client so we can see what the admin sign-in asks for and how it answers.
const signInWithOtp = vi.fn();
const rpc = vi.fn();
vi.mock('#lib/supabase.ts', () => ({ supabase: { auth: { signInWithOtp }, rpc } }));
vi.stubGlobal('location', { origin: 'https://example.org' });

const { sendSignIn } = await import('./session.svelte.ts');

describe('admin sign-in', () => {
	it('never creates accounts', async () => {
		signInWithOtp.mockResolvedValueOnce({ error: null });
		await sendSignIn('pastor@example.org');
		expect(signInWithOtp.mock.calls[0][0].options).toMatchObject({ shouldCreateUser: false, emailRedirectTo: 'https://example.org/admin/' });
	});

	it('answers the same way for an address with no account, so it doesn’t reveal who has one', async () => {
		signInWithOtp.mockReset();
		signInWithOtp.mockResolvedValueOnce({ error: { code: 'otp_disabled', status: 422, message: 'Signups not allowed for otp' } });
		rpc.mockResolvedValueOnce({ data: false });
		expect(await sendSignIn('stranger@example.org')).toEqual({ error: null });
		expect(signInWithOtp).toHaveBeenCalledTimes(1); // no account created
	});

	it('creates the account only for an invited address', async () => {
		signInWithOtp.mockReset();
		signInWithOtp
			.mockResolvedValueOnce({ error: { code: 'otp_disabled', status: 422, message: 'Signups not allowed for otp' } })
			.mockResolvedValueOnce({ error: null });
		rpc.mockResolvedValueOnce({ data: true });
		expect(await sendSignIn('pastor@example.org')).toEqual({ error: null });
		expect(rpc).toHaveBeenLastCalledWith('is_editor_invite', { editor_email: 'pastor@example.org' });
		expect(signInWithOtp.mock.calls[1][0].options.shouldCreateUser).toBe(true);
	});

	it('still reports real problems', async () => {
		signInWithOtp.mockResolvedValueOnce({ error: { code: 'over_email_send_rate_limit', status: 429, message: 'Email rate limit exceeded' } });
		expect((await sendSignIn('pastor@example.org')).error?.message).toBe('Email rate limit exceeded');
		signInWithOtp.mockResolvedValueOnce({ error: { code: 'email_address_invalid', status: 400, message: 'Email address is invalid' } });
		expect((await sendSignIn('nope')).error).not.toBeNull();
	});
});
